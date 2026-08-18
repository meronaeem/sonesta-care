/**
 * Server-only Active Directory integration logic.
 *
 * All communication with Active Directory goes through the on-premises
 * AD Bridge Agent (see /ad-bridge-agent). Nothing here ever runs in the browser.
 */

type Admin = typeof import("@/integrations/supabase/client.server")["supabaseAdmin"];

export interface AdUser {
  samAccountName: string;
  userPrincipalName: string | null;
  displayName: string | null;
  givenName: string | null;
  surname: string | null;
  mail: string | null;
  employeeId: string | null;
  department: string | null;
  title: string | null;
  company: string | null;
  telephoneNumber: string | null;
  mobile: string | null;
  office: string | null;
  managerDn: string | null;
  managerName: string | null;
  memberOf: string[];
  memberOfDn: string[];
  userAccountControl: number;
  accountEnabled: boolean;
  accountLocked: boolean;
  lastLogonTimestamp: string | null;
  dn: string | null;
}

export interface AdConfigRow {
  enabled: boolean;
  domain_name: string;
  ldap_host: string;
  ldap_port: number;
  ldaps_port: number;
  base_dn: string;
  bind_username: string;
  users_search_base: string;
  groups_search_base: string;
  ssl_enabled: boolean;
  validate_certificate: boolean;
  sync_interval: string;
  group_mapping_enabled: boolean;
  default_role: string;
}

export function bridgeEnv() {
  const url = process.env["AD_BRIDGE_URL"];
  const token = process.env["AD_BRIDGE_TOKEN"];
  if (!url || !token) {
    throw new Error(
      "The AD Bridge is not configured. Set AD_BRIDGE_URL and AD_BRIDGE_TOKEN, then deploy the on-premises AD Bridge Agent.",
    );
  }
  return { url: url.replace(/\/$/, ""), token };
}

export async function callBridge<T>(path: string, body: unknown): Promise<T> {
  const { url, token } = bridgeEnv();
  let res: Response;
  try {
    res = await fetch(`${url}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify(body ?? {}),
    });
  } catch (e) {
    throw new Error(`Cannot reach the AD Bridge Agent at ${url}. Is the service running and reachable? (${String(e)})`);
  }
  if (res.status === 401) throw new Error("The AD Bridge rejected the token. AD_BRIDGE_TOKEN does not match the agent's .env value.");
  if (!res.ok) throw new Error(`AD Bridge returned HTTP ${res.status}`);
  return (await res.json()) as T;
}

export async function loadAdConfig(admin: Admin): Promise<AdConfigRow> {
  const { data, error } = await admin.from("ad_config" as never).select("*").eq("id", true as never).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Active Directory is not configured yet.");
  return data as unknown as AdConfigRow;
}

export function toBridgeConfig(cfg: AdConfigRow, bindPasswordOverride?: string) {
  return {
    domainName: cfg.domain_name,
    ldapHost: cfg.ldap_host,
    ldapPort: cfg.ldap_port,
    ldapsPort: cfg.ldaps_port,
    baseDn: cfg.base_dn,
    bindUsername: cfg.bind_username,
    usersSearchBase: cfg.users_search_base || cfg.base_dn,
    groupsSearchBase: cfg.groups_search_base || cfg.base_dn,
    sslEnabled: cfg.ssl_enabled,
    validateCertificate: cfg.validate_certificate,
    ...(bindPasswordOverride ? { bindPasswordOverride } : {}),
  };
}

export async function writeAuthAudit(
  admin: Admin,
  entry: { username: string; user_id?: string | null; event: string; success: boolean; reason?: string | null; ip_address?: string | null; user_agent?: string | null },
) {
  await admin.from("auth_audit_log" as never).insert(entry as never);
}

/** Ensures a department row exists for an AD department name; returns its id. */
async function ensureDepartment(admin: Admin, name: string | null, created: { count: number }): Promise<string | null> {
  const clean = (name ?? "").trim();
  if (!clean) return null;
  const { data: existing } = await admin.from("departments").select("id").ilike("name", clean).maybeSingle();
  if (existing) return (existing as { id: string }).id;
  const { data: inserted, error } = await admin.from("departments").insert({ name: clean }).select("id").single();
  if (error) return null;
  created.count += 1;
  return (inserted as { id: string }).id;
}

export interface GroupMapping { ad_group: string; role: string; priority: number }

export interface AdMappingRow { id: string; ad_group: string; role: string; priority: number; created_at: string }

export interface AdConfigFull extends AdConfigRow {
  bind_password_set: boolean;
  connection_status: string;
  connection_checked_at: string | null;
  last_sync_at: string | null;
  last_successful_sync_at: string | null;
  last_sync_status: string | null;
  last_sync_error: string | null;
  updated_at: string;
}

export interface AdSyncRunRow {
  id: string;
  started_at: string;
  finished_at: string | null;
  trigger_source: string;
  status: string;
  users_found: number;
  users_created: number;
  users_updated: number;
  users_disabled: number;
  departments_created: number;
  error_count: number;
  errors: string[];
}

export async function loadGroupMappings(admin: Admin): Promise<GroupMapping[]> {
  const { data } = await admin.from("ad_group_mappings" as never).select("ad_group, role, priority").order("priority", { ascending: true });
  return (data ?? []) as unknown as GroupMapping[];
}

/** Lowest priority number wins. Matches on group CN, case-insensitive. */
export function resolveRoleFromGroups(groups: string[], mappings: GroupMapping[], fallback: string): string {
  const lower = groups.map((g) => g.toLowerCase());
  const hit = mappings
    .slice()
    .sort((a, b) => a.priority - b.priority)
    .find((m) => lower.includes(m.ad_group.toLowerCase()));
  return hit?.role ?? fallback;
}

function emailFor(u: AdUser, domain: string): string {
  return (u.mail || u.userPrincipalName || `${u.samAccountName}@${domain || "local"}`).toLowerCase();
}

export function randomPassword(): string {
  const bytes = new Uint8Array(36);
  crypto.getRandomValues(bytes);
  return `Ad!${btoa(String.fromCharCode(...bytes)).replace(/[^a-zA-Z0-9]/g, "")}9x`;
}

export interface UpsertResult { profileId: string; created: boolean; role: string }

/**
 * Creates or updates the local account mirroring an Active Directory user.
 * Never stores the AD password. Historical records are never deleted.
 */
export async function upsertAdUser(
  admin: Admin,
  adUser: AdUser,
  cfg: AdConfigRow,
  mappings: GroupMapping[],
  deptCounter: { count: number },
): Promise<UpsertResult> {
  const email = emailFor(adUser, cfg.domain_name);
  const sam = adUser.samAccountName;

  const { data: existing } = await admin
    .from("profiles")
    .select("id")
    .ilike("sam_account_name" as never, sam)
    .maybeSingle();

  let profileId = (existing as { id: string } | null)?.id ?? null;
  let created = false;

  if (!profileId) {
    // Fall back to matching an existing local account by email before creating a new one.
    const { data: byEmail } = await admin.from("profiles").select("id").ilike("email", email).maybeSingle();
    profileId = (byEmail as { id: string } | null)?.id ?? null;
  }

  if (!profileId) {
    const { data: authUser, error } = await admin.auth.admin.createUser({
      email,
      password: randomPassword(),
      email_confirm: true,
      user_metadata: { full_name: adUser.displayName ?? sam, username: sam },
    });
    if (error || !authUser?.user) throw new Error(`Could not create local account for ${sam}: ${error?.message ?? "unknown error"}`);
    profileId = authUser.user.id;
    created = true;
  }

  const departmentId = await ensureDepartment(admin, adUser.department, deptCounter);

  const patch: Record<string, unknown> = {
    sam_account_name: sam,
    user_principal_name: adUser.userPrincipalName,
    full_name: adUser.displayName ?? sam,
    first_name: adUser.givenName,
    last_name: adUser.surname,
    username: sam,
    email,
    employee_id: adUser.employeeId,
    job_title: adUser.title,
    company: adUser.company,
    phone: adUser.telephoneNumber,
    mobile: adUser.mobile,
    office: adUser.office,
    manager_name: adUser.managerName,
    ad_dn: adUser.dn,
    ad_groups: adUser.memberOf,
    is_ad_user: true,
    is_active: adUser.accountEnabled,
    last_ad_sync: new Date().toISOString(),
  };
  if (departmentId) patch["department_id"] = departmentId;

  const { error: upErr } = await admin.from("profiles").update(patch as never).eq("id", profileId);
  if (upErr) throw new Error(`Could not update profile for ${sam}: ${upErr.message}`);

  // Mirror the AD account state onto the local login.
  await admin.auth.admin.updateUserById(profileId, {
    ban_duration: adUser.accountEnabled ? "none" : "876000h",
  });

  // Role assignment only when AD group mapping is enabled.
  let role = cfg.default_role;
  if (cfg.group_mapping_enabled && mappings.length) {
    role = resolveRoleFromGroups(adUser.memberOf, mappings, cfg.default_role);
    const { data: currentRoles } = await admin.from("user_roles").select("role").eq("user_id", profileId);
    const rolesNow = ((currentRoles ?? []) as Array<{ role: string }>).map((r) => r.role);
    if (!rolesNow.includes(role)) {
      await admin.from("user_roles").delete().eq("user_id", profileId);
      await admin.from("user_roles").insert({ user_id: profileId, role: role as never });
    }
  }

  return { profileId, created, role };
}

/** Links manager_id using the AD manager distinguished name. */
async function linkManagers(admin: Admin, users: AdUser[]) {
  const withManagers = users.filter((u) => u.managerDn);
  if (!withManagers.length) return;
  const { data: rows } = await admin.from("profiles").select("id, ad_dn" as never);
  const byDn = new Map<string, string>();
  for (const r of (rows ?? []) as unknown as Array<{ id: string; ad_dn: string | null }>) {
    if (r.ad_dn) byDn.set(r.ad_dn.toLowerCase(), r.id);
  }
  for (const u of withManagers) {
    const managerId = byDn.get(String(u.managerDn).toLowerCase());
    const selfId = byDn.get(String(u.dn ?? "").toLowerCase());
    if (managerId && selfId && managerId !== selfId) {
      await admin.from("profiles").update({ manager_id: managerId } as never).eq("id", selfId);
    }
  }
}

export interface SyncOutcome {
  run_id: string;
  users_found: number;
  users_created: number;
  users_updated: number;
  users_disabled: number;
  departments_created: number;
  error_count: number;
  errors: string[];
}

/** Full directory synchronization. Audited in ad_sync_runs. */
export async function runAdSync(
  admin: Admin,
  opts: { source: string; triggeredBy?: string | null },
): Promise<SyncOutcome> {
  const cfg = await loadAdConfig(admin);
  const { data: runRow } = await admin
    .from("ad_sync_runs" as never)
    .insert({ trigger_source: opts.source, triggered_by: opts.triggeredBy ?? null, status: "running" } as never)
    .select("id")
    .single();
  const runId = (runRow as { id: string } | null)?.id ?? "";

  const errors: string[] = [];
  let found = 0, createdCount = 0, updatedCount = 0, disabled = 0;
  const deptCounter = { count: 0 };

  try {
    const result = await callBridge<{ ok: boolean; users?: AdUser[]; error?: string }>("/sync", {
      config: toBridgeConfig(cfg),
    });
    if (!result.ok) throw new Error(result.error || "Directory read failed");

    const users = result.users ?? [];
    found = users.length;
    const mappings = await loadGroupMappings(admin);

    for (const u of users) {
      try {
        const r = await upsertAdUser(admin, u, cfg, mappings, deptCounter);
        if (r.created) createdCount += 1;
        else updatedCount += 1;
        if (!u.accountEnabled) disabled += 1;
      } catch (e) {
        errors.push(`${u.samAccountName}: ${String(e instanceof Error ? e.message : e)}`);
      }
    }

    await linkManagers(admin, users);

    const status = errors.length ? "completed_with_errors" : "success";
    await admin
      .from("ad_sync_runs" as never)
      .update({
        finished_at: new Date().toISOString(),
        status,
        users_found: found,
        users_created: createdCount,
        users_updated: updatedCount,
        users_disabled: disabled,
        departments_created: deptCounter.count,
        error_count: errors.length,
        errors: errors.slice(0, 100),
      } as never)
      .eq("id", runId);

    await admin
      .from("ad_config" as never)
      .update({
        last_sync_at: new Date().toISOString(),
        last_successful_sync_at: new Date().toISOString(),
        last_sync_status: status,
        last_sync_error: errors.length ? errors.slice(0, 5).join(" | ") : null,
        connection_status: "connected",
        connection_checked_at: new Date().toISOString(),
      } as never)
      .eq("id", true as never);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    errors.push(message);
    await admin
      .from("ad_sync_runs" as never)
      .update({ finished_at: new Date().toISOString(), status: "failed", error_count: errors.length, errors } as never)
      .eq("id", runId);
    await admin
      .from("ad_config" as never)
      .update({ last_sync_at: new Date().toISOString(), last_sync_status: "failed", last_sync_error: message } as never)
      .eq("id", true as never);
    throw new Error(message);
  }

  return {
    run_id: runId,
    users_found: found,
    users_created: createdCount,
    users_updated: updatedCount,
    users_disabled: disabled,
    departments_created: deptCounter.count,
    error_count: errors.length,
    errors,
  };
}