CREATE TABLE public.action_point_reminders_sent (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    action_point_id uuid NOT NULL,
    recipient_email text NOT NULL,
    reminder_type text NOT NULL,
    success boolean DEFAULT true NOT NULL,
    error text,
    sent_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE SEQUENCE public.action_point_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
CREATE TABLE public.activity_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    actor_id uuid,
    action text NOT NULL,
    entity_type text NOT NULL,
    entity_id uuid,
    details jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.ad_config (
    id boolean DEFAULT true NOT NULL,
    enabled boolean DEFAULT false NOT NULL,
    domain_name text DEFAULT ''::text NOT NULL,
    ldap_host text DEFAULT ''::text NOT NULL,
    ldap_port integer DEFAULT 389 NOT NULL,
    ldaps_port integer DEFAULT 636 NOT NULL,
    base_dn text DEFAULT ''::text NOT NULL,
    bind_username text DEFAULT ''::text NOT NULL,
    users_search_base text DEFAULT ''::text NOT NULL,
    groups_search_base text DEFAULT ''::text NOT NULL,
    ssl_enabled boolean DEFAULT true NOT NULL,
    validate_certificate boolean DEFAULT true NOT NULL,
    sync_interval text DEFAULT 'manual'::text NOT NULL,
    group_mapping_enabled boolean DEFAULT true NOT NULL,
    default_role public.app_role DEFAULT 'employee'::public.app_role NOT NULL,
    bind_password_set boolean DEFAULT false NOT NULL,
    connection_status text DEFAULT 'unknown'::text NOT NULL,
    connection_checked_at timestamp with time zone,
    last_sync_at timestamp with time zone,
    last_successful_sync_at timestamp with time zone,
    last_sync_status text,
    last_sync_error text,
    updated_by uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ad_config_id_check CHECK (id)
);
CREATE TABLE public.ad_group_mappings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    ad_group text NOT NULL,
    role public.app_role NOT NULL,
    priority integer DEFAULT 100 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.ad_sync_runs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    finished_at timestamp with time zone,
    trigger_source text DEFAULT 'manual'::text NOT NULL,
    triggered_by uuid,
    status text DEFAULT 'running'::text NOT NULL,
    users_found integer DEFAULT 0 NOT NULL,
    users_created integer DEFAULT 0 NOT NULL,
    users_updated integer DEFAULT 0 NOT NULL,
    users_disabled integer DEFAULT 0 NOT NULL,
    departments_created integer DEFAULT 0 NOT NULL,
    roles_applied integer DEFAULT 0 NOT NULL,
    error_count integer DEFAULT 0 NOT NULL,
    errors jsonb DEFAULT '[]'::jsonb NOT NULL
);
CREATE TABLE public.asset_movements (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    asset_id uuid NOT NULL,
    from_user_id uuid,
    to_user_id uuid,
    from_location_id uuid,
    to_location_id uuid,
    notes text,
    moved_by uuid,
    moved_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE SEQUENCE public.asset_seq
    START WITH 1000
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
CREATE TABLE public.assets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    asset_tag text DEFAULT ('AST-'::text || lpad((nextval('public.asset_seq'::regclass))::text, 6, '0'::text)) NOT NULL,
    barcode text,
    qr_code text,
    asset_type public.asset_type NOT NULL,
    serial_number text,
    manufacturer text,
    model text,
    cpu text,
    ram text,
    storage text,
    gpu text,
    operating_system text,
    windows_version text,
    office_version text,
    hostname text,
    ip_address text,
    mac_address text,
    ad_computer_name text,
    warranty_start date,
    warranty_end date,
    purchase_date date,
    purchase_cost numeric(12,2),
    vendor text,
    invoice_number text,
    status public.asset_status DEFAULT 'in_stock'::public.asset_status NOT NULL,
    assigned_user_id uuid,
    department_id uuid,
    location_id uuid,
    notes text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    location_text text
);
CREATE TABLE public.attachments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    entity_type text NOT NULL,
    entity_id uuid NOT NULL,
    storage_path text NOT NULL,
    file_name text NOT NULL,
    mime_type text,
    size_bytes bigint,
    uploaded_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT attachments_entity_type_check CHECK ((entity_type = ANY (ARRAY['asset'::text, 'ticket'::text, 'pm_task'::text, 'software'::text, 'briefing'::text, 'action_point'::text])))
);
CREATE TABLE public.auth_audit_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    username text NOT NULL,
    user_id uuid,
    event text NOT NULL,
    success boolean DEFAULT false NOT NULL,
    reason text,
    ip_address text,
    user_agent text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.briefing_action_points (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    action_number text DEFAULT ('AP-'::text || lpad((nextval('public.action_point_seq'::regclass))::text, 6, '0'::text)) NOT NULL,
    briefing_id uuid NOT NULL,
    description text NOT NULL,
    department_id uuid,
    responsible_id uuid,
    priority public.ticket_priority DEFAULT 'medium'::public.ticket_priority NOT NULL,
    assigned_at timestamp with time zone DEFAULT now() NOT NULL,
    allowed_time public.allowed_time_option DEFAULT '1d'::public.allowed_time_option NOT NULL,
    custom_minutes integer,
    due_at timestamp with time zone NOT NULL,
    status public.action_status DEFAULT 'open'::public.action_status NOT NULL,
    comments text,
    completed_at timestamp with time zone,
    completed_by uuid,
    completion_notes text,
    reminder_minutes_before integer DEFAULT 60 NOT NULL,
    created_by uuid DEFAULT auth.uid(),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    point_number integer
);
CREATE TABLE public.briefing_departments (
    briefing_id uuid NOT NULL,
    department_id uuid NOT NULL
);
CREATE TABLE public.briefing_participants (
    briefing_id uuid NOT NULL,
    user_id uuid NOT NULL
);
CREATE TABLE public.briefing_rooms (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    briefing_id uuid NOT NULL,
    occupancy_today integer DEFAULT 0 NOT NULL,
    occupancy_rate_today numeric(5,2) DEFAULT 0 NOT NULL,
    breakfast_pax_tomorrow integer DEFAULT 0 NOT NULL,
    duty_manager_id uuid,
    vip0_rooms integer DEFAULT 0 NOT NULL,
    vip1_rooms integer DEFAULT 0 NOT NULL,
    vip2_rooms integer DEFAULT 0 NOT NULL,
    vip3_rooms integer DEFAULT 0 NOT NULL,
    occupancy_mtd numeric(5,2) DEFAULT 0 NOT NULL,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT briefing_rooms_breakfast_pax_tomorrow_check CHECK ((breakfast_pax_tomorrow >= 0)),
    CONSTRAINT briefing_rooms_occupancy_mtd_check CHECK (((occupancy_mtd >= (0)::numeric) AND (occupancy_mtd <= (100)::numeric))),
    CONSTRAINT briefing_rooms_occupancy_rate_today_check CHECK (((occupancy_rate_today >= (0)::numeric) AND (occupancy_rate_today <= (100)::numeric))),
    CONSTRAINT briefing_rooms_occupancy_today_check CHECK ((occupancy_today >= 0)),
    CONSTRAINT briefing_rooms_vip0_rooms_check CHECK ((vip0_rooms >= 0)),
    CONSTRAINT briefing_rooms_vip1_rooms_check CHECK ((vip1_rooms >= 0)),
    CONSTRAINT briefing_rooms_vip2_rooms_check CHECK ((vip2_rooms >= 0)),
    CONSTRAINT briefing_rooms_vip3_rooms_check CHECK ((vip3_rooms >= 0))
);
CREATE SEQUENCE public.briefing_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
CREATE TABLE public.briefings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    briefing_number text DEFAULT ('BRF-'::text || lpad((nextval('public.briefing_seq'::regclass))::text, 6, '0'::text)) NOT NULL,
    title text NOT NULL,
    briefing_date date DEFAULT CURRENT_DATE NOT NULL,
    start_time time without time zone,
    end_time time without time zone,
    location text,
    meeting_type public.briefing_type DEFAULT 'daily_briefing'::public.briefing_type NOT NULL,
    organizer_id uuid,
    general_notes text,
    discussion_points text,
    created_by uuid DEFAULT auth.uid(),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.departments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    code text,
    manager_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.locations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    building text NOT NULL,
    floor text,
    room text,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.network_devices (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    device_type text NOT NULL,
    manufacturer text,
    model text,
    serial_number text,
    ip_address text,
    mac_address text,
    firmware text,
    rack text,
    location_id uuid,
    warranty_end date,
    support_info text,
    config_backup_url text,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.notification_preferences (
    user_id uuid NOT NULL,
    email_pm_reminders boolean DEFAULT true NOT NULL,
    email_ticket_updates boolean DEFAULT true NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.pm_reminders_sent (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    task_id uuid NOT NULL,
    recipient_email text NOT NULL,
    reminder_type text NOT NULL,
    sent_at timestamp with time zone DEFAULT now() NOT NULL,
    success boolean DEFAULT true NOT NULL,
    error text
);
CREATE TABLE public.pm_schedules (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title text NOT NULL,
    description text,
    target_type public.pm_target NOT NULL,
    target_id uuid NOT NULL,
    frequency public.pm_frequency NOT NULL,
    interval_days integer,
    next_due date NOT NULL,
    last_completed date,
    assigned_to uuid,
    reminder_days_before integer DEFAULT 3 NOT NULL,
    checklist jsonb DEFAULT '[]'::jsonb NOT NULL,
    active boolean DEFAULT true NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.pm_tasks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    schedule_id uuid,
    title text NOT NULL,
    target_type public.pm_target NOT NULL,
    target_id uuid NOT NULL,
    due_date date NOT NULL,
    status public.pm_task_status DEFAULT 'open'::public.pm_task_status NOT NULL,
    assigned_to uuid,
    checklist jsonb DEFAULT '[]'::jsonb NOT NULL,
    completion_notes text,
    completed_at timestamp with time zone,
    completed_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.profiles (
    id uuid NOT NULL,
    username text,
    full_name text,
    email text,
    phone text,
    job_title text,
    department_id uuid,
    avatar_url text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    sam_account_name text,
    user_principal_name text,
    first_name text,
    last_name text,
    employee_id text,
    mobile text,
    office text,
    company text,
    manager_name text,
    manager_id uuid,
    ad_dn text,
    ad_groups text[] DEFAULT '{}'::text[] NOT NULL,
    is_ad_user boolean DEFAULT false NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    last_login timestamp with time zone,
    last_ad_sync timestamp with time zone
);
CREATE TABLE public.servers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    hostname text,
    server_kind text DEFAULT 'physical'::text NOT NULL,
    hypervisor text,
    cluster text,
    cpu text,
    ram text,
    storage text,
    operating_system text,
    ip_address text,
    purpose text,
    backup_status text,
    vm_count integer DEFAULT 0,
    snapshot_info text,
    location_id uuid,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.software (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    version text,
    vendor text,
    license_type text,
    license_key text,
    expiration_date date,
    seats integer,
    seats_used integer DEFAULT 0,
    support_contact text,
    notes text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    license_delivery text,
    CONSTRAINT software_license_delivery_check CHECK (((license_delivery IS NULL) OR (license_delivery = ANY (ARRAY['key'::text, 'file'::text]))))
);
CREATE TABLE public.ticket_comments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    ticket_id uuid NOT NULL,
    author_id uuid NOT NULL,
    body text NOT NULL,
    is_internal boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE SEQUENCE public.ticket_seq
    START WITH 1000
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
CREATE TABLE public.tickets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    ticket_number text DEFAULT ('TKT-'::text || lpad((nextval('public.ticket_seq'::regclass))::text, 6, '0'::text)) NOT NULL,
    title text NOT NULL,
    description text,
    category text,
    department_id uuid,
    priority public.ticket_priority DEFAULT 'medium'::public.ticket_priority NOT NULL,
    status public.ticket_status DEFAULT 'open'::public.ticket_status NOT NULL,
    requester_id uuid NOT NULL,
    assignee_id uuid,
    asset_id uuid,
    resolution text,
    sla_due_at timestamp with time zone,
    resolved_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    action_point_id uuid
);
CREATE TABLE public.user_roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    role public.app_role NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);