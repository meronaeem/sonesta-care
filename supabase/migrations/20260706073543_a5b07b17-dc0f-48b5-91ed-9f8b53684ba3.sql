
-- ===== ENUMS =====
CREATE TYPE public.app_role AS ENUM ('administrator','it_manager','it_supervisor','it_engineer','helpdesk','department_manager','employee');
CREATE TYPE public.asset_type AS ENUM ('pc','laptop','server','printer','switch','firewall','router','access_point','ups','nas','phone','tablet','tv','pos','scanner','other');
CREATE TYPE public.asset_status AS ENUM ('in_use','in_stock','in_repair','retired','lost','disposed');
CREATE TYPE public.ticket_status AS ENUM ('open','in_progress','on_hold','resolved','closed','cancelled');
CREATE TYPE public.ticket_priority AS ENUM ('low','medium','high','critical');

-- ===== UPDATED_AT HELPER =====
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- ===== PROFILES =====
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE,
  full_name TEXT,
  email TEXT,
  phone TEXT,
  job_title TEXT,
  department_id UUID,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_read_all" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ===== USER ROLES =====
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "roles_read_own" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.is_it_staff(_user_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('administrator','it_manager','it_supervisor','it_engineer','helpdesk')
  );
$$;

CREATE POLICY "roles_admin_all" ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'administrator'))
  WITH CHECK (public.has_role(auth.uid(),'administrator'));

-- Auto-create profile + default role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, username)
  VALUES (NEW.id, NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email,'@',1)))
  ON CONFLICT (id) DO NOTHING;

  -- First user becomes administrator, others become employee
  IF (SELECT COUNT(*) FROM public.user_roles) = 0 THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'administrator');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'employee');
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ===== DEPARTMENTS =====
CREATE TABLE public.departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  code TEXT UNIQUE,
  manager_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.departments TO authenticated;
GRANT ALL ON public.departments TO service_role;
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dept_read" ON public.departments FOR SELECT TO authenticated USING (true);
CREATE POLICY "dept_it_write" ON public.departments FOR ALL TO authenticated
  USING (public.is_it_staff(auth.uid())) WITH CHECK (public.is_it_staff(auth.uid()));

ALTER TABLE public.profiles ADD CONSTRAINT profiles_dept_fk
  FOREIGN KEY (department_id) REFERENCES public.departments(id) ON DELETE SET NULL;

-- ===== LOCATIONS =====
CREATE TABLE public.locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  building TEXT NOT NULL,
  floor TEXT,
  room TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.locations TO authenticated;
GRANT ALL ON public.locations TO service_role;
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "loc_read" ON public.locations FOR SELECT TO authenticated USING (true);
CREATE POLICY "loc_it_write" ON public.locations FOR ALL TO authenticated
  USING (public.is_it_staff(auth.uid())) WITH CHECK (public.is_it_staff(auth.uid()));

-- ===== ASSETS =====
CREATE SEQUENCE IF NOT EXISTS public.asset_seq START 1000;
CREATE TABLE public.assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_tag TEXT NOT NULL UNIQUE DEFAULT ('AST-' || lpad(nextval('public.asset_seq')::text, 6, '0')),
  barcode TEXT,
  qr_code TEXT,
  asset_type public.asset_type NOT NULL,
  serial_number TEXT,
  manufacturer TEXT,
  model TEXT,
  cpu TEXT,
  ram TEXT,
  storage TEXT,
  gpu TEXT,
  operating_system TEXT,
  windows_version TEXT,
  office_version TEXT,
  hostname TEXT,
  ip_address TEXT,
  mac_address TEXT,
  ad_computer_name TEXT,
  warranty_start DATE,
  warranty_end DATE,
  purchase_date DATE,
  purchase_cost NUMERIC(12,2),
  vendor TEXT,
  invoice_number TEXT,
  status public.asset_status NOT NULL DEFAULT 'in_stock',
  assigned_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
  location_id UUID REFERENCES public.locations(id) ON DELETE SET NULL,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_assets_type ON public.assets(asset_type);
CREATE INDEX idx_assets_status ON public.assets(status);
CREATE INDEX idx_assets_assigned ON public.assets(assigned_user_id);
CREATE INDEX idx_assets_dept ON public.assets(department_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.assets TO authenticated;
GRANT ALL ON public.assets TO service_role;
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "assets_read" ON public.assets FOR SELECT TO authenticated USING (true);
CREATE POLICY "assets_it_write" ON public.assets FOR ALL TO authenticated
  USING (public.is_it_staff(auth.uid())) WITH CHECK (public.is_it_staff(auth.uid()));
CREATE TRIGGER trg_assets_updated BEFORE UPDATE ON public.assets FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Asset movement history
CREATE TABLE public.asset_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  from_user_id UUID REFERENCES auth.users(id),
  to_user_id UUID REFERENCES auth.users(id),
  from_location_id UUID REFERENCES public.locations(id),
  to_location_id UUID REFERENCES public.locations(id),
  notes TEXT,
  moved_by UUID REFERENCES auth.users(id),
  moved_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.asset_movements TO authenticated;
GRANT ALL ON public.asset_movements TO service_role;
ALTER TABLE public.asset_movements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "moves_read" ON public.asset_movements FOR SELECT TO authenticated USING (true);
CREATE POLICY "moves_it_insert" ON public.asset_movements FOR INSERT TO authenticated
  WITH CHECK (public.is_it_staff(auth.uid()));

-- ===== SOFTWARE =====
CREATE TABLE public.software (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  version TEXT,
  vendor TEXT,
  license_type TEXT,
  license_key TEXT,
  expiration_date DATE,
  seats INTEGER,
  seats_used INTEGER DEFAULT 0,
  support_contact TEXT,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.software TO authenticated;
GRANT ALL ON public.software TO service_role;
ALTER TABLE public.software ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sw_read" ON public.software FOR SELECT TO authenticated USING (true);
CREATE POLICY "sw_it_write" ON public.software FOR ALL TO authenticated
  USING (public.is_it_staff(auth.uid())) WITH CHECK (public.is_it_staff(auth.uid()));
CREATE TRIGGER trg_sw_updated BEFORE UPDATE ON public.software FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ===== NETWORK DEVICES =====
CREATE TABLE public.network_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  device_type TEXT NOT NULL,
  manufacturer TEXT,
  model TEXT,
  serial_number TEXT,
  ip_address TEXT,
  mac_address TEXT,
  firmware TEXT,
  rack TEXT,
  location_id UUID REFERENCES public.locations(id) ON DELETE SET NULL,
  warranty_end DATE,
  support_info TEXT,
  config_backup_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.network_devices TO authenticated;
GRANT ALL ON public.network_devices TO service_role;
ALTER TABLE public.network_devices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "net_read" ON public.network_devices FOR SELECT TO authenticated USING (true);
CREATE POLICY "net_it_write" ON public.network_devices FOR ALL TO authenticated
  USING (public.is_it_staff(auth.uid())) WITH CHECK (public.is_it_staff(auth.uid()));
CREATE TRIGGER trg_net_updated BEFORE UPDATE ON public.network_devices FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ===== SERVERS =====
CREATE TABLE public.servers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  hostname TEXT,
  server_kind TEXT NOT NULL DEFAULT 'physical',
  hypervisor TEXT,
  cluster TEXT,
  cpu TEXT,
  ram TEXT,
  storage TEXT,
  operating_system TEXT,
  ip_address TEXT,
  purpose TEXT,
  backup_status TEXT,
  vm_count INTEGER DEFAULT 0,
  snapshot_info TEXT,
  location_id UUID REFERENCES public.locations(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.servers TO authenticated;
GRANT ALL ON public.servers TO service_role;
ALTER TABLE public.servers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "srv_read" ON public.servers FOR SELECT TO authenticated USING (true);
CREATE POLICY "srv_it_write" ON public.servers FOR ALL TO authenticated
  USING (public.is_it_staff(auth.uid())) WITH CHECK (public.is_it_staff(auth.uid()));
CREATE TRIGGER trg_srv_updated BEFORE UPDATE ON public.servers FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ===== TICKETS =====
CREATE SEQUENCE IF NOT EXISTS public.ticket_seq START 1000;
CREATE TABLE public.tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_number TEXT NOT NULL UNIQUE DEFAULT ('TKT-' || lpad(nextval('public.ticket_seq')::text, 6, '0')),
  title TEXT NOT NULL,
  description TEXT,
  category TEXT,
  department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
  priority public.ticket_priority NOT NULL DEFAULT 'medium',
  status public.ticket_status NOT NULL DEFAULT 'open',
  requester_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  assignee_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  asset_id UUID REFERENCES public.assets(id) ON DELETE SET NULL,
  resolution TEXT,
  sla_due_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_tickets_status ON public.tickets(status);
CREATE INDEX idx_tickets_requester ON public.tickets(requester_id);
CREATE INDEX idx_tickets_assignee ON public.tickets(assignee_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tickets TO authenticated;
GRANT ALL ON public.tickets TO service_role;
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;
-- Anyone signed-in can view their own tickets; IT staff view all
CREATE POLICY "tk_read_own_or_it" ON public.tickets FOR SELECT TO authenticated
  USING (requester_id = auth.uid() OR assignee_id = auth.uid() OR public.is_it_staff(auth.uid()));
CREATE POLICY "tk_insert_self" ON public.tickets FOR INSERT TO authenticated
  WITH CHECK (requester_id = auth.uid());
CREATE POLICY "tk_update_own_or_it" ON public.tickets FOR UPDATE TO authenticated
  USING (requester_id = auth.uid() OR public.is_it_staff(auth.uid()))
  WITH CHECK (requester_id = auth.uid() OR public.is_it_staff(auth.uid()));
CREATE POLICY "tk_delete_it" ON public.tickets FOR DELETE TO authenticated
  USING (public.is_it_staff(auth.uid()));
CREATE TRIGGER trg_tk_updated BEFORE UPDATE ON public.tickets FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Ticket comments
CREATE TABLE public.ticket_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  is_internal BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.ticket_comments TO authenticated;
GRANT ALL ON public.ticket_comments TO service_role;
ALTER TABLE public.ticket_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tc_read" ON public.ticket_comments FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.tickets t WHERE t.id = ticket_id
    AND (t.requester_id = auth.uid() OR t.assignee_id = auth.uid() OR public.is_it_staff(auth.uid()))));
CREATE POLICY "tc_insert" ON public.ticket_comments FOR INSERT TO authenticated
  WITH CHECK (author_id = auth.uid() AND EXISTS (
    SELECT 1 FROM public.tickets t WHERE t.id = ticket_id
      AND (t.requester_id = auth.uid() OR t.assignee_id = auth.uid() OR public.is_it_staff(auth.uid()))));

-- ===== ACTIVITY LOG =====
CREATE TABLE public.activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_activity_created ON public.activity_log(created_at DESC);
GRANT SELECT, INSERT ON public.activity_log TO authenticated;
GRANT ALL ON public.activity_log TO service_role;
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "act_read_it" ON public.activity_log FOR SELECT TO authenticated
  USING (public.is_it_staff(auth.uid()) OR actor_id = auth.uid());
CREATE POLICY "act_insert_self" ON public.activity_log FOR INSERT TO authenticated
  WITH CHECK (actor_id = auth.uid());
