
-- 1) Tighten storage read policy on attachments bucket to mirror att_read
DROP POLICY IF EXISTS "attachments_read" ON storage.objects;
CREATE POLICY "attachments_read" ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'attachments'
  AND (
    public.is_it_staff(auth.uid())
    OR (storage.foldername(name))[1] = auth.uid()::text
    OR EXISTS (
      SELECT 1 FROM public.attachments a
      WHERE a.storage_path = storage.objects.name
        AND (
          a.uploaded_by = auth.uid()
          OR (a.entity_type = 'ticket' AND EXISTS (
            SELECT 1 FROM public.tickets t
            WHERE t.id = a.entity_id
              AND (t.requester_id = auth.uid() OR t.assignee_id = auth.uid())
          ))
          OR (a.entity_type = 'pm_task' AND EXISTS (
            SELECT 1 FROM public.pm_tasks pt
            WHERE pt.id = a.entity_id AND pt.assigned_to = auth.uid()
          ))
        )
    )
  )
);

-- 2) Split roles_admin_all into explicit per-action policies and block self-modification
DROP POLICY IF EXISTS "roles_admin_all" ON public.user_roles;

CREATE POLICY "roles_admin_select" ON public.user_roles
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'administrator') OR user_id = auth.uid());

CREATE POLICY "roles_admin_insert" ON public.user_roles
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'administrator')
    AND user_id <> auth.uid()
  );

CREATE POLICY "roles_admin_update" ON public.user_roles
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'administrator') AND user_id <> auth.uid())
  WITH CHECK (public.has_role(auth.uid(), 'administrator') AND user_id <> auth.uid());

CREATE POLICY "roles_admin_delete" ON public.user_roles
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'administrator') AND user_id <> auth.uid());
