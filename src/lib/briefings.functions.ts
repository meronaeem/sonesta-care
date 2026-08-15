import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Kind = "assigned" | "completed";

/** Sends an assignment / completion notification for a briefing action point. */
export const notifyActionPoint = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { actionPointId: string; kind: Kind }) => d)
  .handler(async ({ data, context }) => {
    const { sendEmail } = await import("./email.server");
    const supabase = context.supabase;

    const { data: ap } = await supabase
      .from("briefing_action_points" as never)
      .select("id, action_number, description, due_at, priority, status, responsible_id, briefing_id")
      .eq("id", data.actionPointId)
      .maybeSingle();
    const row = ap as unknown as {
      id: string; action_number: string; description: string; due_at: string; priority: string; status: string;
      responsible_id: string | null; briefing_id: string;
    } | null;
    if (!row?.responsible_id) return { sent: false, reason: "no recipient" };

    const { data: profile } = await supabase.from("profiles").select("email, full_name").eq("id", row.responsible_id).maybeSingle();
    const email = profile?.email;
    if (!email) return { sent: false, reason: "no email" };

    const { data: brf } = await supabase.from("briefings" as never).select("briefing_number, title").eq("id", row.briefing_id).maybeSingle();
    const meeting = brf as unknown as { briefing_number: string; title: string } | null;

    const subject = data.kind === "assigned"
      ? `New action point ${row.action_number}: ${row.description.slice(0, 60)}`
      : `Action point ${row.action_number} completed`;

    const html = `
      <div style="font-family:system-ui,sans-serif;color:#0f172a">
        <h2 style="margin:0 0 8px">${subject}</h2>
        <p>Hi ${profile.full_name ?? "there"},</p>
        <table style="border-collapse:collapse;margin:12px 0">
          <tr><td style="padding:4px 12px 4px 0;color:#64748b">Briefing</td><td style="padding:4px 0">${meeting?.briefing_number ?? ""} — ${meeting?.title ?? ""}</td></tr>
          <tr><td style="padding:4px 12px 4px 0;color:#64748b">Action</td><td style="padding:4px 0"><strong>${row.description}</strong></td></tr>
          <tr><td style="padding:4px 12px 4px 0;color:#64748b">Priority</td><td style="padding:4px 0">${row.priority}</td></tr>
          <tr><td style="padding:4px 12px 4px 0;color:#64748b">Deadline</td><td style="padding:4px 0">${new Date(row.due_at).toLocaleString()}</td></tr>
        </table>
        <p style="color:#64748b;font-size:12px">Hotel IT Operations · Briefing Minutes</p>
      </div>`;

    const result = await sendEmail({ to: email, subject, html });
    await supabase.from("action_point_reminders_sent" as never).insert({
      action_point_id: row.id,
      recipient_email: email,
      reminder_type: data.kind,
      success: result.sent,
      error: result.error ?? null,
    } as never);
    return { sent: result.sent, reason: result.error ?? "ok" };
  });
