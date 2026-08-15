-- Enums
CREATE TYPE public.briefing_type AS ENUM ('daily_briefing','management_meeting','department_meeting','it_meeting','emergency_meeting','followup_meeting','other');
CREATE TYPE public.action_status AS ENUM ('open','in_progress','waiting','completed','overdue','cancelled');
CREATE TYPE public.allowed_time_option AS ENUM ('30m','1h','2h','4h','8h','1d','2d','3d','1w','custom');

CREATE SEQUENCE public.briefing_seq START 1;
CREATE SEQUENCE public.action_point_seq START 1;

-- Briefings
CREATE TABLE public.briefings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  briefing_number text NOT NULL UNIQUE DEFAULT ('BRF-' || lpad(nextval('public.briefing_seq')::text, 6, '0')),
  title text NOT NULL,
  briefing_date date NOT NULL DEFAULT current_date,
  start_time time,
  end_time time,
  location text,
  meeting_type public.briefing_type NOT NULL DEFAULT 'daily_briefing',
  organizer_id uuid REFERENCES auth.users(id),
  general_notes text,
  discussion_points text,
  created_by uuid REFERENCES auth.users(id) DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.briefings TO authenticated;
GRANT ALL ON public.briefings TO service_role;
GRANT USAGE ON SEQUENCE public.briefing_seq TO authenticated, service_role;
GRANT USAGE ON SEQUENCE public.action_point_seq TO authenticated, service_role;
ALTER TABLE public.briefings ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.briefing_participants (
  briefing_id uuid NOT NULL REFERENCES public.briefings(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  PRIMARY KEY (briefing_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.briefing_participants TO authenticated;
GRANT ALL ON public.briefing_participants TO service_role;
ALTER TABLE public.briefing_participants ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.briefing_departments (
  briefing_id uuid NOT NULL REFERENCES public.briefings(id) ON DELETE CASCADE,
  department_id uuid NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
  PRIMARY KEY (briefing_id, department_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.briefing_departments TO authenticated;
GRANT ALL ON public.briefing_departments TO service_role;
ALTER TABLE public.briefing_departments ENABLE ROW LEVEL SECURITY;

-- Action points
CREATE TABLE public.briefing_action_points (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action_number text NOT NULL UNIQUE DEFAULT ('AP-' || lpad(nextval('public.action_point_seq')::text, 6, '0')),
  briefing_id uuid NOT NULL REFERENCES public.briefings(id) ON DELETE CASCADE,
  description text NOT NULL,
  department_id uuid REFERENCES public.departments(id),
  responsible_id uuid REFERENCES auth.users(id),
  priority public.ticket_priority NOT NULL DEFAULT 'medium',
  assigned_at timestamptz NOT NULL DEFAULT now(),
  allowed_time public.allowed_time_option NOT NULL DEFAULT '1d',
  custom_minutes integer,
  due_at timestamptz NOT NULL,
  status public.action_status NOT NULL DEFAULT 'open',
  comments text,
  completed_at timestamptz,
  completed_by uuid REFERENCES auth.users(id),
  completion_notes text,
  reminder_minutes_before integer NOT NULL DEFAULT 60,
  created_by uuid REFERENCES auth.users(id) DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.briefing_action_points TO authenticated;
GRANT ALL ON public.briefing_action_points TO service_role;
ALTER TABLE public.briefing_action_points ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.action_point_reminders_sent (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action_point_id uuid NOT NULL REFERENCES public.briefing_action_points(id) ON DELETE CASCADE,
  recipient_email text NOT NULL,
  reminder_type text NOT NULL,
  success boolean NOT NULL DEFAULT true,
  error text,
  sent_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.action_point_reminders_sent TO authenticated;
GRANT ALL ON public.action_point_reminders_sent TO service_role;
ALTER TABLE public.action_point_reminders_sent ENABLE ROW LEVEL SECURITY;
CREATE POLICY apr_read ON public.action_point_reminders_sent FOR SELECT TO authenticated USING (public.is_it_staff(auth.uid()));

-- Ticket link
ALTER TABLE public.tickets ADD COLUMN action_point_id uuid REFERENCES public.briefing_action_points(id) ON DELETE SET NULL;
CREATE INDEX idx_tickets_action_point ON public.tickets(action_point_id);
CREATE INDEX idx_bap_briefing ON public.briefing_action_points(briefing_id);
CREATE INDEX idx_bap_responsible ON public.briefing_action_points(responsible_id);

-- Visibility helper
CREATE OR REPLACE FUNCTION public.can_see_briefing(_briefing_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_it_staff(auth.uid())
      OR EXISTS (SELECT 1 FROM public.briefings b WHERE b.id = _briefing_id AND (b.created_by = auth.uid() OR b.organizer_id = auth.uid()))
      OR EXISTS (SELECT 1 FROM public.briefing_participants p WHERE p.briefing_id = _briefing_id AND p.user_id = auth.uid())
      OR EXISTS (SELECT 1 FROM public.briefing_action_points a WHERE a.briefing_id = _briefing_id AND a.responsible_id = auth.uid())
      OR EXISTS (
        SELECT 1 FROM public.briefing_departments bd
        JOIN public.profiles pr ON pr.id = auth.uid()
        WHERE bd.briefing_id = _briefing_id AND bd.department_id = pr.department_id
      );
$$;
REVOKE EXECUTE ON FUNCTION public.can_see_briefing(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.can_see_briefing(uuid) TO authenticated, service_role;

CREATE POLICY brf_read ON public.briefings FOR SELECT TO authenticated USING (public.can_see_briefing(id));
CREATE POLICY brf_write ON public.briefings FOR ALL TO authenticated
  USING (public.is_it_staff(auth.uid()) OR created_by = auth.uid() OR organizer_id = auth.uid())
  WITH CHECK (public.is_it_staff(auth.uid()) OR created_by = auth.uid() OR organizer_id = auth.uid());

CREATE POLICY bp_read ON public.briefing_participants FOR SELECT TO authenticated USING (public.can_see_briefing(briefing_id));
CREATE POLICY bp_write ON public.briefing_participants FOR ALL TO authenticated
  USING (public.is_it_staff(auth.uid()) OR EXISTS (SELECT 1 FROM public.briefings b WHERE b.id = briefing_id AND (b.created_by = auth.uid() OR b.organizer_id = auth.uid())))
  WITH CHECK (public.is_it_staff(auth.uid()) OR EXISTS (SELECT 1 FROM public.briefings b WHERE b.id = briefing_id AND (b.created_by = auth.uid() OR b.organizer_id = auth.uid())));

CREATE POLICY bd_read ON public.briefing_departments FOR SELECT TO authenticated USING (public.can_see_briefing(briefing_id));
CREATE POLICY bd_write ON public.briefing_departments FOR ALL TO authenticated
  USING (public.is_it_staff(auth.uid()) OR EXISTS (SELECT 1 FROM public.briefings b WHERE b.id = briefing_id AND (b.created_by = auth.uid() OR b.organizer_id = auth.uid())))
  WITH CHECK (public.is_it_staff(auth.uid()) OR EXISTS (SELECT 1 FROM public.briefings b WHERE b.id = briefing_id AND (b.created_by = auth.uid() OR b.organizer_id = auth.uid())));

CREATE POLICY bap_read ON public.briefing_action_points FOR SELECT TO authenticated
  USING (responsible_id = auth.uid() OR public.can_see_briefing(briefing_id));
CREATE POLICY bap_insert ON public.briefing_action_points FOR INSERT TO authenticated
  WITH CHECK (public.is_it_staff(auth.uid()) OR EXISTS (SELECT 1 FROM public.briefings b WHERE b.id = briefing_id AND (b.created_by = auth.uid() OR b.organizer_id = auth.uid())));
CREATE POLICY bap_update ON public.briefing_action_points FOR UPDATE TO authenticated
  USING (public.is_it_staff(auth.uid()) OR responsible_id = auth.uid() OR EXISTS (SELECT 1 FROM public.briefings b WHERE b.id = briefing_id AND (b.created_by = auth.uid() OR b.organizer_id = auth.uid())))
  WITH CHECK (public.is_it_staff(auth.uid()) OR responsible_id = auth.uid() OR EXISTS (SELECT 1 FROM public.briefings b WHERE b.id = briefing_id AND (b.created_by = auth.uid() OR b.organizer_id = auth.uid())));
CREATE POLICY bap_delete ON public.briefing_action_points FOR DELETE TO authenticated
  USING (public.is_it_staff(auth.uid()) OR EXISTS (SELECT 1 FROM public.briefings b WHERE b.id = briefing_id AND (b.created_by = auth.uid() OR b.organizer_id = auth.uid())));

-- updated_at
CREATE TRIGGER trg_brf_updated BEFORE UPDATE ON public.briefings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_bap_updated BEFORE UPDATE ON public.briefing_action_points FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Audit triggers
CREATE OR REPLACE FUNCTION public.trg_log_briefing_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.log_activity('briefing', NEW.id, 'created', jsonb_build_object('title', NEW.title, 'number', NEW.briefing_number));
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM public.log_activity('briefing', OLD.id, 'deleted', jsonb_build_object('number', OLD.briefing_number));
    RETURN OLD;
  END IF;
  PERFORM public.log_activity('briefing', NEW.id, 'updated', jsonb_build_object('number', NEW.briefing_number, 'title', NEW.title));
  RETURN NEW;
END; $$;
REVOKE EXECUTE ON FUNCTION public.trg_log_briefing_change() FROM public;

CREATE OR REPLACE FUNCTION public.trg_log_action_point_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE changes jsonb := '{}'::jsonb;
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.log_activity('action_point', NEW.id, 'created', jsonb_build_object('number', NEW.action_number, 'briefing_id', NEW.briefing_id, 'responsible_id', NEW.responsible_id));
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM public.log_activity('action_point', OLD.id, 'deleted', jsonb_build_object('number', OLD.action_number));
    RETURN OLD;
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status THEN changes := changes || jsonb_build_object('status', jsonb_build_array(OLD.status, NEW.status)); END IF;
  IF NEW.due_at IS DISTINCT FROM OLD.due_at THEN changes := changes || jsonb_build_object('due_at', jsonb_build_array(OLD.due_at, NEW.due_at)); END IF;
  IF NEW.responsible_id IS DISTINCT FROM OLD.responsible_id THEN changes := changes || jsonb_build_object('responsible_id', jsonb_build_array(OLD.responsible_id, NEW.responsible_id)); END IF;
  IF NEW.priority IS DISTINCT FROM OLD.priority THEN changes := changes || jsonb_build_object('priority', jsonb_build_array(OLD.priority, NEW.priority)); END IF;
  IF NEW.description IS DISTINCT FROM OLD.description THEN changes := changes || jsonb_build_object('description', jsonb_build_array(OLD.description, NEW.description)); END IF;
  IF changes <> '{}'::jsonb THEN
    PERFORM public.log_activity('action_point', NEW.id, CASE WHEN NEW.status = 'completed' AND OLD.status <> 'completed' THEN 'completed' ELSE 'updated' END, changes || jsonb_build_object('number', NEW.action_number));
  END IF;
  RETURN NEW;
END; $$;
REVOKE EXECUTE ON FUNCTION public.trg_log_action_point_change() FROM public;

CREATE TRIGGER briefing_activity_log AFTER INSERT OR UPDATE OR DELETE ON public.briefings FOR EACH ROW EXECUTE FUNCTION public.trg_log_briefing_change();
CREATE TRIGGER action_point_activity_log AFTER INSERT OR UPDATE OR DELETE ON public.briefing_action_points FOR EACH ROW EXECUTE FUNCTION public.trg_log_action_point_change();

-- Completion stamping
CREATE OR REPLACE FUNCTION public.bap_stamp_completion()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS DISTINCT FROM 'completed') THEN
    NEW.completed_at := COALESCE(NEW.completed_at, now());
    NEW.completed_by := COALESCE(NEW.completed_by, auth.uid());
  ELSIF NEW.status <> 'completed' THEN
    NEW.completed_at := NULL;
    NEW.completed_by := NULL;
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_bap_completion BEFORE UPDATE ON public.briefing_action_points FOR EACH ROW EXECUTE FUNCTION public.bap_stamp_completion();

-- Attachments support for new entity types
ALTER TABLE public.attachments DROP CONSTRAINT IF EXISTS attachments_entity_type_check;
ALTER TABLE public.attachments ADD CONSTRAINT attachments_entity_type_check
  CHECK (entity_type IN ('asset','ticket','pm_task','software','briefing','action_point'));