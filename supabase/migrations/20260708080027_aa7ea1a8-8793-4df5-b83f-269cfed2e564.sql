
CREATE TABLE public.attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL CHECK (entity_type IN ('asset','ticket','pm_task')),
  entity_id UUID NOT NULL,
  storage_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  mime_type TEXT,
  size_bytes BIGINT,
  uploaded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_attachments_entity ON public.attachments(entity_type, entity_id);

GRANT SELECT, INSERT, DELETE ON public.attachments TO authenticated;
GRANT ALL ON public.attachments TO service_role;

ALTER TABLE public.attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY att_read ON public.attachments FOR SELECT TO authenticated USING (
  public.is_it_staff(auth.uid())
  OR uploaded_by = auth.uid()
  OR (entity_type = 'ticket' AND EXISTS (
    SELECT 1 FROM public.tickets t WHERE t.id = entity_id
      AND (t.requester_id = auth.uid() OR t.assignee_id = auth.uid())
  ))
  OR (entity_type = 'pm_task' AND EXISTS (
    SELECT 1 FROM public.pm_tasks pt WHERE pt.id = entity_id AND pt.assigned_to = auth.uid()
  ))
);

CREATE POLICY att_insert ON public.attachments FOR INSERT TO authenticated WITH CHECK (
  uploaded_by = auth.uid() AND (
    public.is_it_staff(auth.uid())
    OR (entity_type = 'ticket' AND EXISTS (
      SELECT 1 FROM public.tickets t WHERE t.id = entity_id
        AND (t.requester_id = auth.uid() OR t.assignee_id = auth.uid())
    ))
    OR (entity_type = 'pm_task' AND EXISTS (
      SELECT 1 FROM public.pm_tasks pt WHERE pt.id = entity_id AND pt.assigned_to = auth.uid()
    ))
  )
);

CREATE POLICY att_delete ON public.attachments FOR DELETE TO authenticated USING (
  public.is_it_staff(auth.uid()) OR uploaded_by = auth.uid()
);

CREATE POLICY "attachments_read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'attachments');
CREATE POLICY "attachments_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'attachments' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "attachments_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'attachments' AND ((storage.foldername(name))[1] = auth.uid()::text OR public.is_it_staff(auth.uid())));

CREATE OR REPLACE FUNCTION public.log_activity(_entity_type TEXT, _entity_id UUID, _action TEXT, _details JSONB)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.activity_log (actor_id, action, entity_type, entity_id, details)
  VALUES (auth.uid(), _action, _entity_type, _entity_id, COALESCE(_details, '{}'::jsonb));
END; $$;
GRANT EXECUTE ON FUNCTION public.log_activity(TEXT, UUID, TEXT, JSONB) TO authenticated;

CREATE OR REPLACE FUNCTION public.trg_log_asset_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
DROP TRIGGER IF EXISTS asset_activity_log ON public.assets;
CREATE TRIGGER asset_activity_log AFTER INSERT OR UPDATE ON public.assets
  FOR EACH ROW EXECUTE FUNCTION public.trg_log_asset_change();

CREATE OR REPLACE FUNCTION public.trg_log_ticket_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
DROP TRIGGER IF EXISTS ticket_activity_log ON public.tickets;
CREATE TRIGGER ticket_activity_log AFTER INSERT OR UPDATE ON public.tickets
  FOR EACH ROW EXECUTE FUNCTION public.trg_log_ticket_change();

CREATE OR REPLACE FUNCTION public.trg_log_pm_task_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    PERFORM public.log_activity('pm_task', NEW.id, 'status_change', jsonb_build_object('status', jsonb_build_array(OLD.status, NEW.status), 'title', NEW.title));
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS pm_task_activity_log ON public.pm_tasks;
CREATE TRIGGER pm_task_activity_log AFTER UPDATE ON public.pm_tasks
  FOR EACH ROW EXECUTE FUNCTION public.trg_log_pm_task_change();
