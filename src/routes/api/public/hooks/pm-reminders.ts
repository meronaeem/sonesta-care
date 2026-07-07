import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

// Cron entry point. Uses service role because pg_cron cannot carry an app user session.
// Auth: caller must present the Supabase anon key in `apikey` (pg_cron pattern).
export const Route = createFileRoute("/api/public/hooks/pm-reminders")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apikey = request.headers.get("apikey") ?? "";
        if (!apikey || apikey !== process.env.SUPABASE_PUBLISHABLE_KEY) {
          return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { "content-type": "application/json" } });
        }

        const { sendEmail } = await import("@/lib/email.server");
        const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
          auth: { persistSession: false, autoRefreshToken: false },
        });

        const today = new Date();
        const dueBy = new Date(today.getTime() + 14 * 864e5).toISOString().slice(0, 10);

        const { data: tasks, error } = await supabase
          .from("pm_tasks")
          .select("id, title, due_date, assigned_to, status, schedule_id, pm_schedules(reminder_days_before)")
          .in("status", ["open", "in_progress", "overdue"])
          .lte("due_date", dueBy);
        if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });

        let sent = 0, skipped = 0, failed = 0;
        for (const t of (tasks ?? []) as Array<{
          id: string; title: string; due_date: string; assigned_to: string | null; status: string;
          pm_schedules: { reminder_days_before: number } | null;
        }>) {
          if (!t.assigned_to) { skipped++; continue; }
          const daysBefore = t.pm_schedules?.reminder_days_before ?? 3;
          const daysToDue = Math.round((new Date(t.due_date).getTime() - today.getTime()) / 864e5);
          const reminderType = daysToDue < 0 ? "overdue" : daysToDue <= daysBefore ? "upcoming" : null;
          if (!reminderType) { skipped++; continue; }

          const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
          const { data: existing } = await supabase.from("pm_reminders_sent").select("id")
            .eq("task_id", t.id).eq("reminder_type", reminderType).gte("sent_at", since).limit(1);
          if (existing && existing.length > 0) { skipped++; continue; }

          const { data: profile } = await supabase.from("profiles").select("email, full_name").eq("id", t.assigned_to).maybeSingle();
          const email = profile?.email;
          if (!email) { skipped++; continue; }

          const subject = reminderType === "overdue"
            ? `⚠ PM Overdue: ${t.title}`
            : `PM Due ${daysToDue === 0 ? "today" : `in ${daysToDue}d`}: ${t.title}`;
          const html = `<div style="font-family:system-ui,sans-serif"><h2>${subject}</h2><p>Hi ${profile.full_name ?? "there"},</p><p>You have a preventive maintenance task <strong>${reminderType}</strong>: <strong>${t.title}</strong> (due ${t.due_date}).</p></div>`;
          const result = await sendEmail({ to: email, subject, html });
          await supabase.from("pm_reminders_sent").insert({
            task_id: t.id, recipient_email: email, reminder_type: reminderType,
            success: result.sent, error: result.error ?? null,
          });
          if (result.sent) sent++; else if (result.skipped) skipped++; else failed++;
        }

        // Auto-flag overdue
        await supabase.from("pm_tasks").update({ status: "overdue" })
          .in("status", ["open", "in_progress"]).lt("due_date", today.toISOString().slice(0, 10));

        return Response.json({ sent, skipped, failed, total: (tasks ?? []).length });
      },
    },
  },
});