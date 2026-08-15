
-- 1) Re-scope policies from role "public" to "authenticated"
DROP POLICY IF EXISTS assets_read ON public.assets;
CREATE POLICY assets_read ON public.assets FOR SELECT TO authenticated
  USING (is_it_staff(auth.uid()) OR assigned_user_id = auth.uid());

DROP POLICY IF EXISTS moves_read ON public.asset_movements;
CREATE POLICY moves_read ON public.asset_movements FOR SELECT TO authenticated
  USING (is_it_staff(auth.uid()) OR from_user_id = auth.uid() OR to_user_id = auth.uid());

DROP POLICY IF EXISTS net_read ON public.network_devices;
CREATE POLICY net_read ON public.network_devices FOR SELECT TO authenticated
  USING (is_it_staff(auth.uid()));

DROP POLICY IF EXISTS srv_read ON public.servers;
CREATE POLICY srv_read ON public.servers FOR SELECT TO authenticated
  USING (is_it_staff(auth.uid()));

DROP POLICY IF EXISTS sw_read ON public.software;
CREATE POLICY sw_read ON public.software FOR SELECT TO authenticated
  USING (is_it_staff(auth.uid()));

DROP POLICY IF EXISTS profiles_read_own_or_it ON public.profiles;
CREATE POLICY profiles_read_own_or_it ON public.profiles FOR SELECT TO authenticated
  USING (auth.uid() = id OR is_it_staff(auth.uid()));

DROP POLICY IF EXISTS pms_read ON public.pm_schedules;
CREATE POLICY pms_read ON public.pm_schedules FOR SELECT TO authenticated
  USING (is_it_staff(auth.uid()) OR assigned_to = auth.uid());

DROP POLICY IF EXISTS pms_write ON public.pm_schedules;
CREATE POLICY pms_write ON public.pm_schedules FOR ALL TO authenticated
  USING (is_it_staff(auth.uid())) WITH CHECK (is_it_staff(auth.uid()));

DROP POLICY IF EXISTS pmt_read ON public.pm_tasks;
CREATE POLICY pmt_read ON public.pm_tasks FOR SELECT TO authenticated
  USING (is_it_staff(auth.uid()) OR assigned_to = auth.uid());

DROP POLICY IF EXISTS pmt_it_write ON public.pm_tasks;
CREATE POLICY pmt_it_write ON public.pm_tasks FOR ALL TO authenticated
  USING (is_it_staff(auth.uid())) WITH CHECK (is_it_staff(auth.uid()));

DROP POLICY IF EXISTS pmt_assignee_update ON public.pm_tasks;
CREATE POLICY pmt_assignee_update ON public.pm_tasks FOR UPDATE TO authenticated
  USING (assigned_to = auth.uid()) WITH CHECK (assigned_to = auth.uid());

DROP POLICY IF EXISTS prs_read_it ON public.pm_reminders_sent;
CREATE POLICY prs_read_it ON public.pm_reminders_sent FOR SELECT TO authenticated
  USING (is_it_staff(auth.uid()));

DROP POLICY IF EXISTS prs_insert_it ON public.pm_reminders_sent;
CREATE POLICY prs_insert_it ON public.pm_reminders_sent FOR INSERT TO authenticated
  WITH CHECK (is_it_staff(auth.uid()));

DROP POLICY IF EXISTS np_read_own ON public.notification_preferences;
CREATE POLICY np_read_own ON public.notification_preferences FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR is_it_staff(auth.uid()));

DROP POLICY IF EXISTS np_write_own ON public.notification_preferences;
CREATE POLICY np_write_own ON public.notification_preferences FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- 2) Storage upload policy must verify access to the referenced entity
DROP POLICY IF EXISTS attachments_insert ON storage.objects;
CREATE POLICY attachments_insert ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'attachments'
  AND (storage.foldername(name))[1] = (auth.uid())::text
  AND (storage.foldername(name))[3] IS NOT NULL
  AND (
    public.is_it_staff(auth.uid())
    OR (
      (storage.foldername(name))[2] = 'ticket'
      AND EXISTS (
        SELECT 1 FROM public.tickets t
        WHERE t.id = ((storage.foldername(name))[3])::uuid
          AND (t.requester_id = auth.uid() OR t.assignee_id = auth.uid())
      )
    )
    OR (
      (storage.foldername(name))[2] = 'pm_task'
      AND EXISTS (
        SELECT 1 FROM public.pm_tasks pt
        WHERE pt.id = ((storage.foldername(name))[3])::uuid
          AND pt.assigned_to = auth.uid()
      )
    )
  )
);
