import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Public: tells the sign-in screen whether Active Directory login is available. */
export const getAdLoginMode = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("ad_config" as never)
      .select("enabled, domain_name")
      .eq("id", true as never)
      .maybeSingle();
    const row = data as unknown as { enabled: boolean; domain_name: string } | null;
    return { adEnabled: Boolean(row?.enabled), domain: row?.domain_name ?? "" };
  } catch {
    return { adEnabled: false, domain: "" };
  }
});

/**
 * Public: authenticates a user against the local Active Directory through the
 * on-premises bridge, mirrors their directory record locally and hands back a
 * one-time credential the browser exchanges for a session.
 * The Active Directory password is never stored.
 */
export const adLogin = createServerFn({ method: "POST" })
  .inputValidator((input: { username: string; password: string }) => {
    if (!input?.username || !input?.password) throw new Error("Username and password are required");
    return { username: String(input.username).trim(), password: String(input.password) };
  })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const ad = await import("./ad.server");

    const ip = getRequestHeader("cf-connecting-ip") ?? getRequestHeader("x-forwarded-for") ?? null;
    const ua = getRequestHeader("user-agent") ?? null;
    const audit = (success: boolean, reason: string | null, userId?: string | null) =>
      ad.writeAuthAudit(supabaseAdmin, {
        username: data.username,
        user_id: userId ?? null,
        event: "ad_login",
        success,
        reason,
        ip_address: ip,
        user_agent: ua,
      });

    const cfg = await ad.loadAdConfig(supabaseAdmin);
    if (!cfg.enabled) {
      await audit(false, "Active Directory login is disabled");
      throw new Error("Active Directory login is disabled.");
    }

    let result: { ok: boolean; user?: ad.AdUser; message?: string; code?: string };
    try {
      result = await ad.callBridge("/authenticate", {
        config: ad.toBridgeConfig(cfg),
        username: data.username,
        password: data.password,
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      await audit(false, message);
      throw new Error(message);
    }

    if (!result.ok || !result.user) {
      await audit(false, result.message ?? "Authentication failed");
      throw new Error(result.message ?? "Invalid username or password.");
    }

    const mappings = await ad.loadGroupMappings(supabaseAdmin);
    const upserted = await ad.upsertAdUser(supabaseAdmin, result.user, cfg, mappings, { count: 0 });

    const oneTime = ad.randomPassword();
    const email = (result.user.mail || result.user.userPrincipalName || `${result.user.samAccountName}@${cfg.domain_name}`).toLowerCase();
    const { error } = await supabaseAdmin.auth.admin.updateUserById(upserted.profileId, { password: oneTime, email });
    if (error) {
      await audit(false, `Session creation failed: ${error.message}`, upserted.profileId);
      throw new Error("Signed in to Active Directory, but the application session could not be created.");
    }

    await supabaseAdmin
      .from("profiles")
      .update({ last_login: new Date().toISOString() } as never)
      .eq("id", upserted.profileId);
    await audit(true, null, upserted.profileId);

    return { email, oneTime, displayName: result.user.displayName ?? result.user.samAccountName, role: upserted.role };
  });

/** Configuration, live status and recent synchronization history. */
export const getAdOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: staff } = await context.supabase.rpc("is_it_staff", { _user_id: context.userId });
    if (!staff) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [config, runs, mappings, counts] = await Promise.all([
      supabaseAdmin.from("ad_config" as never).select("*").eq("id", true as never).maybeSingle(),
      supabaseAdmin.from("ad_sync_runs" as never).select("*").order("started_at", { ascending: false }).limit(10),
      supabaseAdmin.from("ad_group_mappings" as never).select("*").order("priority", { ascending: true }),
      supabaseAdmin.from("profiles").select("id, is_active, is_ad_user" as never),
    ]);

    const profiles = (counts.data ?? []) as unknown as Array<{ is_active: boolean; is_ad_user: boolean }>;
    const adUsers = profiles.filter((p) => p.is_ad_user);

    return {
      config: config.data as unknown,
      runs: (runs.data ?? []) as unknown,
      mappings: (mappings.data ?? []) as unknown,
      stats: {
        total: adUsers.length,
        active: adUsers.filter((p) => p.is_active).length,
        disabled: adUsers.filter((p) => !p.is_active).length,
      },
      bridgeConfigured: Boolean(process.env["AD_BRIDGE_URL"] && process.env["AD_BRIDGE_TOKEN"]),
    };
  });

/** Administrators only: save the Active Directory connection settings. */
export const saveAdConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: Record<string, unknown>) => input)
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "administrator" });
    if (!isAdmin) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("ad_config" as never)
      .update({ ...data, updated_by: context.userId } as never)
      .eq("id", true as never);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Administrators only: bind with the service account and read the directory. */
export const testAdConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { bindPassword?: string }) => input ?? {})
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "administrator" });
    if (!isAdmin) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const ad = await import("./ad.server");
    const cfg = await ad.loadAdConfig(supabaseAdmin);
    const res = await ad.callBridge<{ ok: boolean; url?: string; error?: string; tookMs?: number }>("/test-connection", {
      config: ad.toBridgeConfig(cfg, data.bindPassword),
    });
    await supabaseAdmin
      .from("ad_config" as never)
      .update({
        connection_status: res.ok ? "connected" : "error",
        connection_checked_at: new Date().toISOString(),
        ...(res.ok ? {} : { last_sync_error: res.error ?? "Connection failed" }),
        ...(data.bindPassword ? { bind_password_set: true } : {}),
      } as never)
      .eq("id", true as never);
    return res;
  });

/** Administrators only: verify a real user's credentials without signing in. */
export const testAdAuthentication = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { username: string; password: string }) => input)
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "administrator" });
    if (!isAdmin) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const ad = await import("./ad.server");
    const cfg = await ad.loadAdConfig(supabaseAdmin);
    const res = await ad.callBridge<{ ok: boolean; message?: string; code?: string }>("/test-authentication", {
      config: ad.toBridgeConfig(cfg),
      username: data.username,
      password: data.password,
    });
    await ad.writeAuthAudit(supabaseAdmin, {
      username: data.username,
      event: "ad_test_authentication",
      success: Boolean(res.ok),
      reason: res.ok ? null : (res.message ?? "failed"),
    });
    return res;
  });

/** Administrators only: run a full directory synchronization now. */
export const syncAdNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "administrator" });
    if (!isAdmin) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const ad = await import("./ad.server");
    return ad.runAdSync(supabaseAdmin, { source: "manual", triggeredBy: context.userId });
  });

/** Administrators only: list AD security groups for role mapping. */
export const listAdGroups = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "administrator" });
    if (!isAdmin) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const ad = await import("./ad.server");
    const cfg = await ad.loadAdConfig(supabaseAdmin);
    return ad.callBridge<{ ok: boolean; groups?: Array<{ name: string; dn: string; description: string | null }>; error?: string }>(
      "/groups",
      { config: ad.toBridgeConfig(cfg) },
    );
  });