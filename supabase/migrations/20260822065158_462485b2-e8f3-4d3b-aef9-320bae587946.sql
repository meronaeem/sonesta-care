ALTER TABLE ONLY public.action_point_reminders_sent
    ADD CONSTRAINT action_point_reminders_sent_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.activity_log
    ADD CONSTRAINT activity_log_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.ad_config
    ADD CONSTRAINT ad_config_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.ad_group_mappings
    ADD CONSTRAINT ad_group_mappings_ad_group_key UNIQUE (ad_group);
ALTER TABLE ONLY public.ad_group_mappings
    ADD CONSTRAINT ad_group_mappings_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.ad_sync_runs
    ADD CONSTRAINT ad_sync_runs_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.asset_movements
    ADD CONSTRAINT asset_movements_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.assets
    ADD CONSTRAINT assets_asset_tag_key UNIQUE (asset_tag);
ALTER TABLE ONLY public.assets
    ADD CONSTRAINT assets_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.attachments
    ADD CONSTRAINT attachments_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.auth_audit_log
    ADD CONSTRAINT auth_audit_log_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.briefing_action_points
    ADD CONSTRAINT briefing_action_points_action_number_key UNIQUE (action_number);
ALTER TABLE ONLY public.briefing_action_points
    ADD CONSTRAINT briefing_action_points_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.briefing_departments
    ADD CONSTRAINT briefing_departments_pkey PRIMARY KEY (briefing_id, department_id);
ALTER TABLE ONLY public.briefing_participants
    ADD CONSTRAINT briefing_participants_pkey PRIMARY KEY (briefing_id, user_id);
ALTER TABLE ONLY public.briefing_rooms
    ADD CONSTRAINT briefing_rooms_briefing_id_key UNIQUE (briefing_id);
ALTER TABLE ONLY public.briefing_rooms
    ADD CONSTRAINT briefing_rooms_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.briefings
    ADD CONSTRAINT briefings_briefing_number_key UNIQUE (briefing_number);
ALTER TABLE ONLY public.briefings
    ADD CONSTRAINT briefings_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.departments
    ADD CONSTRAINT departments_code_key UNIQUE (code);
ALTER TABLE ONLY public.departments
    ADD CONSTRAINT departments_name_key UNIQUE (name);
ALTER TABLE ONLY public.departments
    ADD CONSTRAINT departments_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.locations
    ADD CONSTRAINT locations_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.network_devices
    ADD CONSTRAINT network_devices_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.notification_preferences
    ADD CONSTRAINT notification_preferences_pkey PRIMARY KEY (user_id);
ALTER TABLE ONLY public.pm_reminders_sent
    ADD CONSTRAINT pm_reminders_sent_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.pm_schedules
    ADD CONSTRAINT pm_schedules_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.pm_tasks
    ADD CONSTRAINT pm_tasks_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_username_key UNIQUE (username);
ALTER TABLE ONLY public.servers
    ADD CONSTRAINT servers_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.software
    ADD CONSTRAINT software_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.ticket_comments
    ADD CONSTRAINT ticket_comments_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.tickets
    ADD CONSTRAINT tickets_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.tickets
    ADD CONSTRAINT tickets_ticket_number_key UNIQUE (ticket_number);
ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_role_key UNIQUE (user_id, role);
CREATE INDEX auth_audit_log_created_idx ON public.auth_audit_log USING btree (created_at DESC);
CREATE INDEX idx_activity_created ON public.activity_log USING btree (created_at DESC);
CREATE INDEX idx_assets_assigned ON public.assets USING btree (assigned_user_id);
CREATE INDEX idx_assets_dept ON public.assets USING btree (department_id);
CREATE INDEX idx_assets_status ON public.assets USING btree (status);
CREATE INDEX idx_assets_type ON public.assets USING btree (asset_type);
CREATE INDEX idx_attachments_entity ON public.attachments USING btree (entity_type, entity_id);
CREATE INDEX idx_bap_briefing ON public.briefing_action_points USING btree (briefing_id);
CREATE INDEX idx_bap_responsible ON public.briefing_action_points USING btree (responsible_id);
CREATE INDEX idx_tickets_action_point ON public.tickets USING btree (action_point_id);
CREATE INDEX idx_tickets_assignee ON public.tickets USING btree (assignee_id);
CREATE INDEX idx_tickets_requester ON public.tickets USING btree (requester_id);
CREATE INDEX idx_tickets_status ON public.tickets USING btree (status);
CREATE INDEX pms_next_due_idx ON public.pm_schedules USING btree (next_due) WHERE active;
CREATE INDEX pmt_assignee_idx ON public.pm_tasks USING btree (assigned_to);
CREATE INDEX pmt_due_idx ON public.pm_tasks USING btree (due_date, status);
CREATE UNIQUE INDEX profiles_sam_account_name_key ON public.profiles USING btree (lower(sam_account_name)) WHERE (sam_account_name IS NOT NULL);
CREATE TRIGGER action_point_activity_log AFTER INSERT OR DELETE OR UPDATE ON public.briefing_action_points FOR EACH ROW EXECUTE FUNCTION public.trg_log_action_point_change();
CREATE TRIGGER asset_activity_log AFTER INSERT OR UPDATE ON public.assets FOR EACH ROW EXECUTE FUNCTION public.trg_log_asset_change();
CREATE TRIGGER briefing_activity_log AFTER INSERT OR DELETE OR UPDATE ON public.briefings FOR EACH ROW EXECUTE FUNCTION public.trg_log_briefing_change();
CREATE TRIGGER pm_task_activity_log AFTER UPDATE ON public.pm_tasks FOR EACH ROW EXECUTE FUNCTION public.trg_log_pm_task_change();
CREATE TRIGGER pms_ensure_task_ins AFTER INSERT ON public.pm_schedules FOR EACH ROW EXECUTE FUNCTION public.pm_ensure_task();
CREATE TRIGGER pms_ensure_task_upd AFTER UPDATE OF next_due, active ON public.pm_schedules FOR EACH ROW WHEN ((new.active AND ((old.next_due IS DISTINCT FROM new.next_due) OR (old.active IS DISTINCT FROM new.active)))) EXECUTE FUNCTION public.pm_ensure_task();
CREATE TRIGGER pms_updated BEFORE UPDATE ON public.pm_schedules FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER pmt_advance AFTER UPDATE OF status ON public.pm_tasks FOR EACH ROW EXECUTE FUNCTION public.pm_advance_schedule();
CREATE TRIGGER pmt_updated BEFORE UPDATE ON public.pm_tasks FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER ticket_activity_log AFTER INSERT OR UPDATE ON public.tickets FOR EACH ROW EXECUTE FUNCTION public.trg_log_ticket_change();
CREATE TRIGGER trg_ad_config_updated BEFORE UPDATE ON public.ad_config FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_assets_updated BEFORE UPDATE ON public.assets FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_bap_completion BEFORE UPDATE ON public.briefing_action_points FOR EACH ROW EXECUTE FUNCTION public.bap_stamp_completion();
CREATE TRIGGER trg_bap_point_number BEFORE INSERT ON public.briefing_action_points FOR EACH ROW EXECUTE FUNCTION public.bap_set_point_number();
CREATE TRIGGER trg_bap_updated BEFORE UPDATE ON public.briefing_action_points FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_brf_updated BEFORE UPDATE ON public.briefings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_briefing_rooms_updated BEFORE UPDATE ON public.briefing_rooms FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_net_updated BEFORE UPDATE ON public.network_devices FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_srv_updated BEFORE UPDATE ON public.servers FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_sw_updated BEFORE UPDATE ON public.software FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_tk_updated BEFORE UPDATE ON public.tickets FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
ALTER TABLE ONLY public.action_point_reminders_sent
    ADD CONSTRAINT action_point_reminders_sent_action_point_id_fkey FOREIGN KEY (action_point_id) REFERENCES public.briefing_action_points(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.activity_log
    ADD CONSTRAINT activity_log_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.ad_config
    ADD CONSTRAINT ad_config_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.ad_sync_runs
    ADD CONSTRAINT ad_sync_runs_triggered_by_fkey FOREIGN KEY (triggered_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.asset_movements
    ADD CONSTRAINT asset_movements_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.assets(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.asset_movements
    ADD CONSTRAINT asset_movements_from_location_id_fkey FOREIGN KEY (from_location_id) REFERENCES public.locations(id);
ALTER TABLE ONLY public.asset_movements
    ADD CONSTRAINT asset_movements_from_user_id_fkey FOREIGN KEY (from_user_id) REFERENCES auth.users(id);
ALTER TABLE ONLY public.asset_movements
    ADD CONSTRAINT asset_movements_moved_by_fkey FOREIGN KEY (moved_by) REFERENCES auth.users(id);
ALTER TABLE ONLY public.asset_movements
    ADD CONSTRAINT asset_movements_to_location_id_fkey FOREIGN KEY (to_location_id) REFERENCES public.locations(id);
ALTER TABLE ONLY public.asset_movements
    ADD CONSTRAINT asset_movements_to_user_id_fkey FOREIGN KEY (to_user_id) REFERENCES auth.users(id);
ALTER TABLE ONLY public.assets
    ADD CONSTRAINT assets_assigned_user_id_fkey FOREIGN KEY (assigned_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.assets
    ADD CONSTRAINT assets_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);
ALTER TABLE ONLY public.assets
    ADD CONSTRAINT assets_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.assets
    ADD CONSTRAINT assets_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.locations(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.attachments
    ADD CONSTRAINT attachments_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES auth.users(id);
ALTER TABLE ONLY public.auth_audit_log
    ADD CONSTRAINT auth_audit_log_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.briefing_action_points
    ADD CONSTRAINT briefing_action_points_briefing_id_fkey FOREIGN KEY (briefing_id) REFERENCES public.briefings(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.briefing_action_points
    ADD CONSTRAINT briefing_action_points_completed_by_fkey FOREIGN KEY (completed_by) REFERENCES auth.users(id);
ALTER TABLE ONLY public.briefing_action_points
    ADD CONSTRAINT briefing_action_points_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);
ALTER TABLE ONLY public.briefing_action_points
    ADD CONSTRAINT briefing_action_points_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id);
ALTER TABLE ONLY public.briefing_action_points
    ADD CONSTRAINT briefing_action_points_responsible_id_fkey FOREIGN KEY (responsible_id) REFERENCES auth.users(id);
ALTER TABLE ONLY public.briefing_departments
    ADD CONSTRAINT briefing_departments_briefing_id_fkey FOREIGN KEY (briefing_id) REFERENCES public.briefings(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.briefing_departments
    ADD CONSTRAINT briefing_departments_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.briefing_participants
    ADD CONSTRAINT briefing_participants_briefing_id_fkey FOREIGN KEY (briefing_id) REFERENCES public.briefings(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.briefing_participants
    ADD CONSTRAINT briefing_participants_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.briefing_rooms
    ADD CONSTRAINT briefing_rooms_briefing_id_fkey FOREIGN KEY (briefing_id) REFERENCES public.briefings(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.briefing_rooms
    ADD CONSTRAINT briefing_rooms_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);
ALTER TABLE ONLY public.briefing_rooms
    ADD CONSTRAINT briefing_rooms_duty_manager_id_fkey FOREIGN KEY (duty_manager_id) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.briefing_rooms
    ADD CONSTRAINT briefing_rooms_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id);
ALTER TABLE ONLY public.briefings
    ADD CONSTRAINT briefings_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);
ALTER TABLE ONLY public.briefings
    ADD CONSTRAINT briefings_organizer_id_fkey FOREIGN KEY (organizer_id) REFERENCES auth.users(id);
ALTER TABLE ONLY public.departments
    ADD CONSTRAINT departments_manager_id_fkey FOREIGN KEY (manager_id) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.network_devices
    ADD CONSTRAINT network_devices_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.locations(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.notification_preferences
    ADD CONSTRAINT notification_preferences_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.pm_reminders_sent
    ADD CONSTRAINT pm_reminders_sent_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.pm_tasks(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.pm_schedules
    ADD CONSTRAINT pm_schedules_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.pm_tasks
    ADD CONSTRAINT pm_tasks_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.pm_tasks
    ADD CONSTRAINT pm_tasks_schedule_id_fkey FOREIGN KEY (schedule_id) REFERENCES public.pm_schedules(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_dept_fk FOREIGN KEY (department_id) REFERENCES public.departments(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_manager_id_fkey FOREIGN KEY (manager_id) REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.servers
    ADD CONSTRAINT servers_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.locations(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.software
    ADD CONSTRAINT software_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);
ALTER TABLE ONLY public.ticket_comments
    ADD CONSTRAINT ticket_comments_author_id_fkey FOREIGN KEY (author_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.ticket_comments
    ADD CONSTRAINT ticket_comments_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES public.tickets(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.tickets
    ADD CONSTRAINT tickets_action_point_id_fkey FOREIGN KEY (action_point_id) REFERENCES public.briefing_action_points(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.tickets
    ADD CONSTRAINT tickets_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.assets(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.tickets
    ADD CONSTRAINT tickets_assignee_id_fkey FOREIGN KEY (assignee_id) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.tickets
    ADD CONSTRAINT tickets_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.tickets
    ADD CONSTRAINT tickets_requester_id_fkey FOREIGN KEY (requester_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;