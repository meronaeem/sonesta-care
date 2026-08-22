CREATE TYPE public.action_status AS ENUM ('open','in_progress','waiting','completed','overdue','cancelled');
CREATE TYPE public.allowed_time_option AS ENUM ('30m','1h','2h','4h','8h','1d','2d','3d','1w','custom');
CREATE TYPE public.app_role AS ENUM ('administrator','it_manager','it_supervisor','it_engineer','helpdesk','department_manager','employee','read_only');
CREATE TYPE public.asset_status AS ENUM ('in_use','in_stock','in_repair','retired','lost','disposed');
CREATE TYPE public.asset_type AS ENUM ('pc','laptop','server','printer','switch','firewall','router','access_point','ups','nas','phone','tablet','tv','pos','scanner','other');
CREATE TYPE public.briefing_type AS ENUM ('daily_briefing','management_meeting','department_meeting','it_meeting','emergency_meeting','followup_meeting','other');
CREATE TYPE public.pm_frequency AS ENUM ('weekly','monthly','quarterly','semiannual','annual','custom_days');
CREATE TYPE public.pm_target AS ENUM ('asset','server','network_device');
CREATE TYPE public.pm_task_status AS ENUM ('open','in_progress','done','skipped','overdue');
CREATE TYPE public.ticket_priority AS ENUM ('low','medium','high','critical');
CREATE TYPE public.ticket_status AS ENUM ('open','in_progress','on_hold','resolved','closed','cancelled');

SET check_function_bodies = false;

CREATE FUNCTION public.has_role(_user_id uuid, _role public.app_role) RETURNS boolean LANGUAGE sql STABLE SET search_path TO 'public' AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE FUNCTION public.is_it_staff(_user_id uuid) RETURNS boolean LANGUAGE sql STABLE SET search_path TO 'public' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('administrator','it_manager','it_supervisor','it_engineer','helpdesk')
  );
$$;

CREATE FUNCTION public.can_see_briefing(_briefing_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
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

CREATE FUNCTION public.bap_set_point_number() RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.point_number IS NULL THEN
    SELECT COALESCE(MAX(point_number), 0) + 1 INTO NEW.point_number
    FROM public.briefing_action_points
    WHERE briefing_id = NEW.briefing_id;
  END IF;
  RETURN NEW;
END; $$;

CREATE FUNCTION public.bap_stamp_completion() RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
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

CREATE FUNCTION public.handle_new_user() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, username)
  VALUES (NEW.id, NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email,'@',1)))
  ON CONFLICT (id) DO NOTHING;

  IF (SELECT COUNT(*) FROM public.user_roles) = 0 THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'administrator');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'employee');
  END IF;
  RETURN NEW;
END; $$;

CREATE FUNCTION public.log_activity(_entity_type text, _entity_id uuid, _action text, _details jsonb) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  INSERT INTO public.activity_log (actor_id, action, entity_type, entity_id, details)
  VALUES (auth.uid(), _action, _entity_type, _entity_id, COALESCE(_details, '{}'::jsonb));
END; $$;

CREATE FUNCTION public.pm_advance_schedule() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
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

CREATE FUNCTION public.pm_ensure_task() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
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

CREATE FUNCTION public.set_updated_at() RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE FUNCTION public.trg_log_action_point_change() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
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

CREATE FUNCTION public.trg_log_asset_change() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE changes JSONB := '{}'::jsonb;
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.log_activity('asset', NEW.id, 'created', jsonb_build_object('asset_tag', NEW.asset_tag, 'status', NEW.status));
    RETURN NEW;
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status THEN changes := changes || jsonb_build_object('status', jsonb_build_array(OLD.status, NEW.status)); END IF;
  IF NEW.assigned_user_id IS DISTINCT FROM OLD.assigned_user_id THEN changes := changes || jsonb_build_object('assigned_user_id', jsonb_build_array(OLD.assigned_user_id, NEW.assigned_user_id)); END IF;
  IF NEW.location_id IS DISTINCT FROM OLD.location_id THEN changes := changes || jsonb_build_object('location_id', jsonb_build_array(OLD.location_id, NEW.location_id)); END IF;
  IF NEW.department_id IS DISTINCT FROM OLD.department_id THEN changes := changes || jsonb_build_object('department_id', jsonb_build_array(OLD.department_id, NEW.department_id)); END IF;
  IF changes <> '{}'::jsonb THEN PERFORM public.log_activity('asset', NEW.id, 'updated', changes); END IF;
  RETURN NEW;
END; $$;

CREATE FUNCTION public.trg_log_briefing_change() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
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

CREATE FUNCTION public.trg_log_pm_task_change() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    PERFORM public.log_activity('pm_task', NEW.id, 'status_change', jsonb_build_object('status', jsonb_build_array(OLD.status, NEW.status), 'title', NEW.title));
  END IF;
  RETURN NEW;
END; $$;

CREATE FUNCTION public.trg_log_ticket_change() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE changes JSONB := '{}'::jsonb;
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.log_activity('ticket', NEW.id, 'created', jsonb_build_object('title', NEW.title, 'priority', NEW.priority));
    RETURN NEW;
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status THEN changes := changes || jsonb_build_object('status', jsonb_build_array(OLD.status, NEW.status)); END IF;
  IF NEW.priority IS DISTINCT FROM OLD.priority THEN changes := changes || jsonb_build_object('priority', jsonb_build_array(OLD.priority, NEW.priority)); END IF;
  IF NEW.assignee_id IS DISTINCT FROM OLD.assignee_id THEN changes := changes || jsonb_build_object('assignee_id', jsonb_build_array(OLD.assignee_id, NEW.assignee_id)); END IF;
  IF changes <> '{}'::jsonb THEN PERFORM public.log_activity('ticket', NEW.id, 'updated', changes); END IF;
  RETURN NEW;
END; $$;

GRANT ALL ON FUNCTION public.bap_set_point_number() TO service_role;
GRANT ALL ON FUNCTION public.bap_stamp_completion() TO authenticated, service_role;
GRANT ALL ON FUNCTION public.can_see_briefing(uuid) TO authenticated, service_role;
GRANT ALL ON FUNCTION public.handle_new_user() TO service_role;
GRANT ALL ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;
GRANT ALL ON FUNCTION public.is_it_staff(uuid) TO authenticated, service_role;
GRANT ALL ON FUNCTION public.log_activity(text, uuid, text, jsonb) TO authenticated, service_role;
GRANT ALL ON FUNCTION public.pm_advance_schedule() TO service_role;
GRANT ALL ON FUNCTION public.pm_ensure_task() TO service_role;
GRANT ALL ON FUNCTION public.set_updated_at() TO service_role;
GRANT ALL ON FUNCTION public.trg_log_action_point_change() TO service_role;
GRANT ALL ON FUNCTION public.trg_log_asset_change() TO service_role;
GRANT ALL ON FUNCTION public.trg_log_briefing_change() TO service_role;
GRANT ALL ON FUNCTION public.trg_log_pm_task_change() TO service_role;
GRANT ALL ON FUNCTION public.trg_log_ticket_change() TO service_role;