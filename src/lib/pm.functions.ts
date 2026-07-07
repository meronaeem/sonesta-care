import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Sends PM reminder emails for tasks due within their reminder_days_before window.
// Safe to call repeatedly — the reminders log de-duplicates.
export const runPmReminders = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { sendEmail } = await import("./email.server");
    const supabase = context.supabase;

    // Verify caller is IT
    const { data: staff } = await supabase.rpc("is_it_staff", { _user_id: context.userId });
    if (!staff) throw new Error("Forbidden");

    const today = new Date();
    const in14 = new Date(today.getTime() + 14 * 864e5);
    const dueBy = in14.toISOString().slice(0, 10);

    const { data: tasks, error } = await supabase
      .from("pm_tasks" as never)
      .select("id, title, due_date, assigned_to, status, schedule_id")
      .in("status", ["open", "in_progress", "overdue"])
      .lte("due_date", dueBy);
    if (error) throw new Error(error.message);

    let sent = 0;
    let skipped = 0;
    let failed = 0;
    const results: Array<{ task_id: string; email: string; ok: boolean; note: string }> = [];

    for (const t of (tasks ?? []) as Array<{ id: string; title: string; due_date: string; assigned_to: string | null; status: string; schedule_id: string | null }>) {
      if (!t.assigned_to) { skipped++; continue; }

      // Look up schedule reminder window
      let daysBefore = 3;
      if (t.schedule_id) {
        const { data: s } = await supabase.from("pm_schedules" as never).select("reminder_days_before").eq("id", t.schedule_id).maybeSingle();
        const rec = s as { reminder_days_before?: number } | null;
        if (rec?.reminder_days_before != null) daysBefore = rec.reminder_days_before;
      }
      const due = new Date(t.due_date);
      const daysToDue = Math.round((due.getTime() - today.getTime()) / 864e5);
      const reminderType = daysToDue < 0 ? "overdue" : daysToDue <= daysBefore ? "upcoming" : null;
      if (!reminderType) { skipped++; continue; }

      // Dedupe: has this reminderType already been sent for this task in the last 24h?
      const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
      const { data: existing } = await supabase
        .from("pm_reminders_sent" as never)
        .select("id")
        .eq("task_id", t.id)
        .eq("reminder_type", reminderType)
        .gte("sent_at", since)
        .limit(1);
      if (existing && existing.length > 0) { skipped++; continue; }

      const { data: profile } = await supabase.from("profiles").select("email, full_name").eq("id", t.assigned_to).maybeSingle();
      const email = profile?.email;
      if (!email) { skipped++; continue; }

      const subject = reminderType === "overdue"
        ? `⚠ PM Overdue: ${t.title}`
        : `PM Due ${daysToDue === 0 ? "today" : `in ${daysToDue}d`}: ${t.title}`;
      const html = `
        <div style="font-family:system-ui,sans-serif;color:#0f172a">
          <h2 style="margin:0 0 8px">${subject}</h2>
          <p>Hi ${profile.full_name ?? "there"},</p>
          <p>You have a preventive maintenance task <strong>${reminderType === "overdue" ? "overdue" : "coming up"}</strong>:</p>
          <table style="border-collapse:collapse;margin:12px 0">
            <tr><td style="padding:4px 12px 4px 0;color:#64748b">Task</td><td style="padding:4px 0"><strong>${t.title}</strong></td></tr>
            <tr><td style="padding:4px 12px 4px 0;color:#64748b">Due</td><td style="padding:4px 0">${t.due_date}</td></tr>
            <tr><td style="padding:4px 12px 4px 0;color:#64748b">Status</td><td style="padding:4px 0">${t.status}</td></tr>
          </table>
          <p style="color:#64748b;font-size:12px">Hotel IT Operations · automated reminder</p>
        </div>`;
      const result = await sendEmail({ to: email, subject, html });

      await supabase.from("pm_reminders_sent" as never).insert({
        task_id: t.id,
        recipient_email: email,
        reminder_type: reminderType,
        success: result.sent,
        error: result.error ?? null,
      } as never);

      if (result.sent) sent++;
      else if (result.skipped) skipped++;
      else failed++;
      results.push({ task_id: t.id, email, ok: result.sent, note: result.error ?? "ok" });
    }

    // Also flip past-due tasks to 'overdue' status
    const todayIso = today.toISOString().slice(0, 10);
    await supabase
      .from("pm_tasks" as never)
      .update({ status: "overdue" } as never)
      .in("status", ["open", "in_progress"])
      .lt("due_date", todayIso);

    return { sent, skipped, failed, total: (tasks ?? []).length, results };
  });