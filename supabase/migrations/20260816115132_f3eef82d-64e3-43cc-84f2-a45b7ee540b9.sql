-- ============ AD identity columns on profiles ============
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS sam_account_name text,
  ADD COLUMN IF NOT EXISTS user_principal_name text,
  ADD COLUMN IF NOT EXISTS first_name text,
  ADD COLUMN IF NOT EXISTS last_name text,
  ADD COLUMN IF NOT EXISTS employee_id text,
  ADD COLUMN IF NOT EXISTS mobile text,
  ADD COLUMN IF NOT EXISTS office text,
  ADD COLUMN IF NOT EXISTS company text,
  ADD COLUMN IF NOT EXISTS manager_name text,
  ADD COLUMN IF NOT EXISTS manager_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS ad_dn text,
  ADD COLUMN IF NOT EXISTS ad_groups text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS is_ad_user boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS last_login timestamptz,
  ADD COLUMN IF NOT EXISTS last_ad_sync timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_sam_account_name_key
  ON public.profiles (lower(sam_account_name)) WHERE sam_account_name IS NOT NULL;

-- ============ AD configuration (single row) ============
CREATE TABLE IF NOT EXISTS public.ad_config (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  enabled boolean NOT NULL DEFAULT false,
  domain_name text NOT NULL DEFAULT '',
  ldap_host text NOT NULL DEFAULT '',
  ldap_port integer NOT NULL DEFAULT 389,
  ldaps_port integer NOT NULL DEFAULT 636,
  base_dn text NOT NULL DEFAULT '',
  bind_username text NOT NULL DEFAULT '',
  users_search_base text NOT NULL DEFAULT '',
  groups_search_base text NOT NULL DEFAULT '',
  ssl_enabled boolean NOT NULL DEFAULT true,
  validate_certificate boolean NOT NULL DEFAULT true,
  sync_interval text NOT NULL DEFAULT 'manual',
  group_mapping_enabled boolean NOT NULL DEFAULT true,
  default_role app_role NOT NULL DEFAULT 'employee',
  bind_password_set boolean NOT NULL DEFAULT false,
  connection_status text NOT NULL DEFAULT 'unknown',
  connection_checked_at timestamptz,
  last_sync_at timestamptz,
  last_successful_sync_at timestamptz,
  last_sync_status text,
  last_sync_error text,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.ad_config TO authenticated;
GRANT ALL ON public.ad_config TO service_role;
ALTER TABLE public.ad_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "IT staff can view AD config" ON public.ad_config
  FOR SELECT TO authenticated USING (public.is_it_staff(auth.uid()));
CREATE POLICY "Admins can insert AD config" ON public.ad_config
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'administrator'));
CREATE POLICY "Admins can update AD config" ON public.ad_config
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'administrator'))
  WITH CHECK (public.has_role(auth.uid(), 'administrator'));
CREATE TRIGGER trg_ad_config_updated BEFORE UPDATE ON public.ad_config
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
INSERT INTO public.ad_config (id) VALUES (true) ON CONFLICT DO NOTHING;

-- ============ AD group -> application role mapping ============
CREATE TABLE IF NOT EXISTS public.ad_group_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ad_group text NOT NULL,
  role app_role NOT NULL,
  priority integer NOT NULL DEFAULT 100,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (ad_group)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ad_group_mappings TO authenticated;
GRANT ALL ON public.ad_group_mappings TO service_role;
ALTER TABLE public.ad_group_mappings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "IT staff can view group mappings" ON public.ad_group_mappings
  FOR SELECT TO authenticated USING (public.is_it_staff(auth.uid()));
CREATE POLICY "Admins manage group mappings" ON public.ad_group_mappings
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'administrator'))
  WITH CHECK (public.has_role(auth.uid(), 'administrator'));

-- ============ Synchronization audit log ============
CREATE TABLE IF NOT EXISTS public.ad_sync_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  trigger_source text NOT NULL DEFAULT 'manual',
  triggered_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'running',
  users_found integer NOT NULL DEFAULT 0,
  users_created integer NOT NULL DEFAULT 0,
  users_updated integer NOT NULL DEFAULT 0,
  users_disabled integer NOT NULL DEFAULT 0,
  departments_created integer NOT NULL DEFAULT 0,
  roles_applied integer NOT NULL DEFAULT 0,
  error_count integer NOT NULL DEFAULT 0,
  errors jsonb NOT NULL DEFAULT '[]'::jsonb
);
GRANT SELECT ON public.ad_sync_runs TO authenticated;
GRANT ALL ON public.ad_sync_runs TO service_role;
ALTER TABLE public.ad_sync_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "IT staff can view sync runs" ON public.ad_sync_runs
  FOR SELECT TO authenticated USING (public.is_it_staff(auth.uid()));

-- ============ Authentication audit log ============
CREATE TABLE IF NOT EXISTS public.auth_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username text NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  event text NOT NULL,
  success boolean NOT NULL DEFAULT false,
  reason text,
  ip_address text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS auth_audit_log_created_idx ON public.auth_audit_log (created_at DESC);
GRANT SELECT ON public.auth_audit_log TO authenticated;
GRANT ALL ON public.auth_audit_log TO service_role;
ALTER TABLE public.auth_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can view auth audit log" ON public.auth_audit_log
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'administrator'));