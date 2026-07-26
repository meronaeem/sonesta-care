
ALTER TABLE public.software ADD COLUMN IF NOT EXISTS license_delivery text;
ALTER TABLE public.software ADD CONSTRAINT software_license_delivery_check CHECK (license_delivery IS NULL OR license_delivery IN ('key','file'));

ALTER TABLE public.attachments DROP CONSTRAINT IF EXISTS attachments_entity_type_check;
ALTER TABLE public.attachments ADD CONSTRAINT attachments_entity_type_check CHECK (entity_type = ANY (ARRAY['asset','ticket','pm_task','software']));

DROP POLICY IF EXISTS att_insert ON public.attachments;
CREATE POLICY att_insert ON public.attachments FOR INSERT TO authenticated
WITH CHECK (
  uploaded_by = auth.uid() AND (
    is_it_staff(auth.uid())
    OR (entity_type = 'ticket' AND EXISTS (SELECT 1 FROM tickets t WHERE t.id = attachments.entity_id AND (t.requester_id = auth.uid() OR t.assignee_id = auth.uid())))
    OR (entity_type = 'pm_task' AND EXISTS (SELECT 1 FROM pm_tasks pt WHERE pt.id = attachments.entity_id AND pt.assigned_to = auth.uid()))
  )
);

DROP POLICY IF EXISTS att_read ON public.attachments;
CREATE POLICY att_read ON public.attachments FOR SELECT TO authenticated
USING (
  is_it_staff(auth.uid())
  OR uploaded_by = auth.uid()
  OR (entity_type = 'ticket' AND EXISTS (SELECT 1 FROM tickets t WHERE t.id = attachments.entity_id AND (t.requester_id = auth.uid() OR t.assignee_id = auth.uid())))
  OR (entity_type = 'pm_task' AND EXISTS (SELECT 1 FROM pm_tasks pt WHERE pt.id = attachments.entity_id AND pt.assigned_to = auth.uid()))
);
