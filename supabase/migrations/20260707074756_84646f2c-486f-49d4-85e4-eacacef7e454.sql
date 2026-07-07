
-- Enums
CREATE TYPE public.pm_frequency AS ENUM ('weekly','monthly','quarterly','semiannual','annual','custom_days');
CREATE TYPE public.pm_target AS ENUM ('asset','server','network_device');
CREATE TYPE public.pm_task_status AS ENUM ('open','in_progress','done','skipped','overdue');

-- Schedules
CREATE TABLE public.pm_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  target_type public.pm_target NOT NULL,
  target_id uuid NOT NULL,
  frequency public.pm_frequency NOT NULL,
  interval_days integer,
  next_due date NOT NULL,
  last_completed date,
  assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reminder_days_before integer NOT NULL DEFAULT 3,
  checklist jsonb NOT NULL DEFAULT '[]'::jsonb,
  active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pm_schedules TO authenticated;
GRANT ALL ON public.pm_schedules TO service_role;
ALTER TABLE public.pm_schedules ENABLE ROW LEVEL SECURITY;
CREATE POLICY pms_read ON public.pm_schedules FOR SELECT
  USING (public.is_it_staff(auth.uid()) OR assigned_to = auth.uid());
CREATE POLICY pms_write ON public.pm_schedules FOR ALL
  USING (public.is_it_staff(auth.uid())) WITH CHECK (public.is_it_staff(auth.uid()));
CREATE TRIGGER pms_updated BEFORE UPDATE ON public.pm_schedules
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX pms_next_due_idx ON public.pm_schedules(next_due) WHERE active;

-- Tasks (work orders)
CREATE TABLE public.pm_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id uuid REFERENCES public.pm_schedules(id) ON DELETE CASCADE,
  title text NOT NULL,
  target_type public.pm_target NOT NULL,
  target_id uuid NOT NULL,
  due_date date NOT NULL,
  status public.pm_task_status NOT NULL DEFAULT 'open',
  assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  checklist jsonb NOT NULL DEFAULT '[]'::jsonb,
  completion_notes text,
  completed_at timestamptz,
  completed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pm_tasks TO authenticated;
GRANT ALL ON public.pm_tasks TO service_role;
ALTER TABLE public.pm_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY pmt_read ON public.pm_tasks FOR SELECT
  USING (public.is_it_staff(auth.uid()) OR assigned_to = auth.uid());
CREATE POLICY pmt_it_write ON public.pm_tasks FOR ALL
  USING (public.is_it_staff(auth.uid())) WITH CHECK (public.is_it_staff(auth.uid()));
CREATE POLICY pmt_assignee_update ON public.pm_tasks FOR UPDATE
  USING (assigned_to = auth.uid()) WITH CHECK (assigned_to = auth.uid());
CREATE TRIGGER pmt_updated BEFORE UPDATE ON public.pm_tasks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX pmt_due_idx ON public.pm_tasks(due_date, status);
CREATE INDEX pmt_assignee_idx ON public.pm_tasks(assigned_to);

-- Reminder log
CREATE TABLE public.pm_reminders_sent (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.pm_tasks(id) ON DELETE CASCADE,
  recipient_email text NOT NULL,
  reminder_type text NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  success boolean NOT NULL DEFAULT true,
  error text
);
GRANT SELECT, INSERT ON public.pm_reminders_sent TO authenticated;
GRANT ALL ON public.pm_reminders_sent TO service_role;
ALTER TABLE public.pm_reminders_sent ENABLE ROW LEVEL SECURITY;
CREATE POLICY prs_read_it ON public.pm_reminders_sent FOR SELECT
  USING (public.is_it_staff(auth.uid()));
CREATE POLICY prs_insert_it ON public.pm_reminders_sent FOR INSERT
  WITH CHECK (public.is_it_staff(auth.uid()));

-- Notification preferences
CREATE TABLE public.notification_preferences (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email_pm_reminders boolean NOT NULL DEFAULT true,
  email_ticket_updates boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notification_preferences TO authenticated;
GRANT ALL ON public.notification_preferences TO service_role;
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY np_read_own ON public.notification_preferences FOR SELECT
  USING (user_id = auth.uid() OR public.is_it_staff(auth.uid()));
CREATE POLICY np_write_own ON public.notification_preferences FOR ALL
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Auto-generate the next PM task when a schedule is created or its next_due changes
CREATE OR REPLACE FUNCTION public.pm_ensure_task()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.active THEN
    INSERT INTO public.pm_tasks (schedule_id, title, target_type, target_id, due_date, assigned_to, checklist)
    SELECT NEW.id, NEW.title, NEW.target_type, NEW.target_id, NEW.next_due, NEW.assigned_to, NEW.checklist
    WHERE NOT EXISTS (
      SELECT 1 FROM public.pm_tasks
      WHERE schedule_id = NEW.id
        AND due_date = NEW.next_due
        AND status IN ('open','in_progress','overdue')
    );
  END IF;
  RETURN NEW;
END; $$;
REVOKE EXECUTE ON FUNCTION public.pm_ensure_task() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER pms_ensure_task_ins AFTER INSERT ON public.pm_schedules
  FOR EACH ROW EXECUTE FUNCTION public.pm_ensure_task();
CREATE TRIGGER pms_ensure_task_upd AFTER UPDATE OF next_due, active ON public.pm_schedules
  FOR EACH ROW WHEN (NEW.active AND (OLD.next_due IS DISTINCT FROM NEW.next_due OR OLD.active IS DISTINCT FROM NEW.active))
  EXECUTE FUNCTION public.pm_ensure_task();

-- When task completes, advance the schedule
CREATE OR REPLACE FUNCTION public.pm_advance_schedule()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  s RECORD;
  new_due date;
BEGIN
  IF NEW.status = 'done' AND OLD.status <> 'done' AND NEW.schedule_id IS NOT NULL THEN
    SELECT * INTO s FROM public.pm_schedules WHERE id = NEW.schedule_id;
    IF FOUND AND s.active THEN
      new_due := CASE s.frequency
        WHEN 'weekly' THEN NEW.due_date + INTERVAL '7 days'
        WHEN 'monthly' THEN NEW.due_date + INTERVAL '1 month'
        WHEN 'quarterly' THEN NEW.due_date + INTERVAL '3 months'
        WHEN 'semiannual' THEN NEW.due_date + INTERVAL '6 months'
        WHEN 'annual' THEN NEW.due_date + INTERVAL '1 year'
        WHEN 'custom_days' THEN NEW.due_date + (COALESCE(s.interval_days, 30) || ' days')::INTERVAL
      END::date;
      UPDATE public.pm_schedules
        SET last_completed = NEW.due_date, next_due = new_due
        WHERE id = s.id;
    END IF;
  END IF;
  RETURN NEW;
END; $$;
REVOKE EXECUTE ON FUNCTION public.pm_advance_schedule() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER pmt_advance AFTER UPDATE OF status ON public.pm_tasks
  FOR EACH ROW EXECUTE FUNCTION public.pm_advance_schedule();
