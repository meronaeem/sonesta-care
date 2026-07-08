import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, BellRing, CheckCircle2, Play, FileDown } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { DataTable, type Column } from "@/components/data-table";
import { fmtDate, labelize, daysUntil } from "@/lib/format";
import { useAuth } from "@/hooks/use-auth";
import { runPmReminders } from "@/lib/pm.functions";
import { generatePmComplianceReport } from "@/lib/pdf-reports";
import { BulkEditBar } from "@/components/bulk-edit-bar";

export const Route = createFileRoute("/_authenticated/pm")({
  head: () => ({ meta: [{ title: "Preventive Maintenance • Hotel IT Ops" }] }),
  component: PmPage,
});

type Target = "asset" | "server" | "network_device";
type Frequency = "weekly" | "monthly" | "quarterly" | "semiannual" | "annual" | "custom_days";

interface Schedule {
  id: string; title: string; description: string | null; target_type: Target; target_id: string;
  frequency: Frequency; interval_days: number | null; next_due: string; last_completed: string | null;
  assigned_to: string | null; reminder_days_before: number; active: boolean;
}
interface Task {
  id: string; schedule_id: string | null; title: string; target_type: Target; target_id: string;
  due_date: string; status: string; assigned_to: string | null; completion_notes: string | null; completed_at: string | null;
}
interface TargetOption { id: string; label: string; type: Target }
interface UserOption { id: string; full_name: string | null; email: string | null }

function PmPage() {
  const { isIT, user } = useAuth();
  const qc = useQueryClient();
  const runReminders = useServerFn(runPmReminders);

  const { data: schedules = [], isLoading: sLoading } = useQuery({
    queryKey: ["pm_schedules"],
    queryFn: async () => {
      const { data, error } = await supabase.from("pm_schedules" as never).select("*").order("next_due");
      if (error) throw error;
      return (data ?? []) as unknown as Schedule[];
    },
  });

  const { data: tasks = [], isLoading: tLoading } = useQuery({
    queryKey: ["pm_tasks"],
    queryFn: async () => {
      const { data, error } = await supabase.from("pm_tasks" as never).select("*").order("due_date");
      if (error) throw error;
      return (data ?? []) as unknown as Task[];
    },
  });

  const { data: targets = [] } = useQuery({
    queryKey: ["pm_targets"],
    queryFn: async () => {
      const [a, s, n] = await Promise.all([
        supabase.from("assets").select("id, asset_tag, model"),
        supabase.from("servers").select("id, hostname"),
        supabase.from("network_devices").select("id, name, device_type"),
      ]);
      const out: TargetOption[] = [];
      for (const r of (a.data ?? [])) out.push({ id: r.id, type: "asset", label: `${r.asset_tag}${r.model ? ` · ${r.model}` : ""}` });
      for (const r of (s.data ?? [])) out.push({ id: r.id, type: "server", label: `Server · ${r.hostname}` });
      for (const r of (n.data ?? [])) out.push({ id: r.id, type: "network_device", label: `${r.device_type ?? "Network"} · ${r.name}` });
      return out;
    },
  });

  const { data: users = [] } = useQuery({
    queryKey: ["pm_users"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id, full_name, email");
      return (data ?? []) as UserOption[];
    },
  });

  const usersById = useMemo(() => Object.fromEntries(users.map((u) => [u.id, u])), [users]);
  const targetsById = useMemo(() => {
    const m: Record<string, TargetOption> = {};
    for (const t of targets) m[`${t.type}:${t.id}`] = t;
    return m;
  }, [targets]);

  const [openSched, setOpenSched] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const createSchedule = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const { error } = await supabase.from("pm_schedules" as never).insert({ ...payload, created_by: user!.id } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pm_schedules"] });
      qc.invalidateQueries({ queryKey: ["pm_tasks"] });
      toast.success("Schedule created");
      setOpenSched(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const completeTask = useMutation({
    mutationFn: async ({ id, notes }: { id: string; notes: string }) => {
      const { error } = await supabase.from("pm_tasks" as never).update({
        status: "done", completion_notes: notes, completed_at: new Date().toISOString(), completed_by: user!.id,
      } as never).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pm_tasks"] });
      qc.invalidateQueries({ queryKey: ["pm_schedules"] });
      toast.success("Task completed");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const startTask = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("pm_tasks" as never).update({ status: "in_progress" } as never).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pm_tasks"] }),
  });

  const bulkTasks = useMutation({
    mutationFn: async (updates: Record<string, string>) => {
      const ids = Array.from(selected);
      const patch: Record<string, unknown> = { ...updates };
      if (patch.assigned_to === "__unassigned__") patch.assigned_to = null;
      const { error } = await supabase.from("pm_tasks" as never).update(patch as never).in("id", ids);
      if (error) throw error;
      return ids.length;
    },
    onSuccess: (n) => {
      qc.invalidateQueries({ queryKey: ["pm_tasks"] });
      toast.success(`Updated ${n} task${n === 1 ? "" : "s"}`);
      setSelected(new Set());
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleRunReminders = async () => {
    try {
      const res = await runReminders({ data: undefined as never }) as { sent: number; failed: number; skipped: number; total: number };
      toast.success(`Reminders: ${res.sent} sent, ${res.skipped} skipped, ${res.failed} failed`);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const handleExportCompliance = () => {
    const from = new Date(Date.now() - 90 * 864e5).toISOString().slice(0, 10);
    const to = new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10);
    generatePmComplianceReport(
      tasks.map((t) => ({
        title: t.title, target_type: t.target_type, due_date: t.due_date, status: t.status,
        assignee: t.assigned_to ? (usersById[t.assigned_to]?.full_name ?? usersById[t.assigned_to]?.email ?? null) : null,
        completed_at: t.completed_at,
      })),
      from, to,
    );
  };

  const openTasks = tasks.filter((t) => t.status !== "done" && t.status !== "skipped");
  const overdue = openTasks.filter((t) => new Date(t.due_date) < new Date());
  const upcoming = openTasks.filter((t) => new Date(t.due_date) >= new Date());

  const schedCols: Column<Schedule>[] = [
    { key: "title", label: "Title", render: (s) => <span className="font-medium">{s.title}</span> },
    { key: "target_type", label: "Target", render: (s) => targetsById[`${s.target_type}:${s.target_id}`]?.label ?? labelize(s.target_type) },
    { key: "frequency", label: "Frequency", render: (s) => <Badge variant="secondary">{s.frequency === "custom_days" ? `${s.interval_days}d` : labelize(s.frequency)}</Badge> },
    { key: "next_due", label: "Next Due", render: (s) => fmtDate(s.next_due) },
    { key: "assigned_to", label: "Assignee", render: (s) => s.assigned_to ? (usersById[s.assigned_to]?.full_name ?? usersById[s.assigned_to]?.email) : "—" },
    { key: "active", label: "Active", render: (s) => <Badge variant={s.active ? "default" : "outline"}>{s.active ? "Yes" : "No"}</Badge> },
  ];

  const taskCols: Column<Task>[] = [
    { key: "title", label: "Task", render: (t) => <span className="font-medium">{t.title}</span> },
    { key: "target_type", label: "Target", render: (t) => targetsById[`${t.target_type}:${t.target_id}`]?.label ?? labelize(t.target_type) },
    { key: "due_date", label: "Due", render: (t) => {
      const d = daysUntil(t.due_date) ?? 0;
      const cls = d < 0 ? "text-red-600 font-medium" : d <= 3 ? "text-amber-600" : "";
      return <span className={cls}>{fmtDate(t.due_date)}{d < 0 ? ` (${-d}d late)` : d === 0 ? " (today)" : ` (${d}d)`}</span>;
    } },
    { key: "status", label: "Status", render: (t) => <Badge variant={t.status === "overdue" ? "destructive" : t.status === "done" ? "default" : "outline"}>{labelize(t.status)}</Badge> },
    { key: "assigned_to", label: "Assignee", render: (t) => t.assigned_to ? (usersById[t.assigned_to]?.full_name ?? usersById[t.assigned_to]?.email) : "—" },
    { key: "id", label: "Actions", render: (t) => (
      <div className="flex gap-1">
        {t.status === "open" && <Button size="sm" variant="outline" onClick={() => startTask.mutate(t.id)}><Play className="h-3 w-3" /></Button>}
        {t.status !== "done" && <CompleteButton onDone={(notes) => completeTask.mutate({ id: t.id, notes })} />}
      </div>
    ) },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Preventive Maintenance</h1>
          <p className="text-sm text-muted-foreground">Schedules, work orders, and reminders.</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={handleExportCompliance}><FileDown className="h-4 w-4 mr-2" /> Compliance PDF</Button>
          {isIT && <Button variant="outline" size="sm" onClick={handleRunReminders}><BellRing className="h-4 w-4 mr-2" /> Run reminders</Button>}
          {isIT && (
            <Dialog open={openSched} onOpenChange={setOpenSched}>
              <DialogTrigger asChild>
                <Button size="sm"><Plus className="h-4 w-4 mr-2" /> New schedule</Button>
              </DialogTrigger>
              <ScheduleDialog targets={targets} users={users} onSubmit={(v) => createSchedule.mutate(v)} pending={createSchedule.isPending} />
            </Dialog>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Active schedules" value={schedules.filter((s) => s.active).length} />
        <StatCard title="Open tasks" value={openTasks.length} />
        <StatCard title="Overdue" value={overdue.length} accent="text-red-600" />
        <StatCard title="Due next 7 days" value={upcoming.filter((t) => (daysUntil(t.due_date) ?? 99) <= 7).length} accent="text-amber-600" />
      </div>

      <Tabs defaultValue="tasks">
        <TabsList>
          <TabsTrigger value="tasks">Work Orders ({openTasks.length})</TabsTrigger>
          <TabsTrigger value="schedules">Schedules ({schedules.length})</TabsTrigger>
          <TabsTrigger value="history">Completed</TabsTrigger>
        </TabsList>
        <TabsContent value="tasks" className="mt-4">
          {isIT && (
            <BulkEditBar
              count={selected.size}
              pending={bulkTasks.isPending}
              onClear={() => setSelected(new Set())}
              onApply={(u) => bulkTasks.mutate(u)}
              fields={[
                { key: "status", label: "Status", options: ["open","in_progress","done","skipped","overdue"].map((s) => ({ value: s, label: labelize(s) })) },
                { key: "assigned_to", label: "Assignee", options: [{ value: "__unassigned__", label: "Unassigned" }, ...users.map((u) => ({ value: u.id, label: u.full_name ?? u.email ?? u.id }))] },
              ]}
            />
          )}
          {tLoading ? <div className="text-sm text-muted-foreground">Loading…</div> : (
            <DataTable
              rows={openTasks}
              columns={taskCols}
              selectable={isIT}
              selectedIds={selected}
              onSelectionChange={setSelected}
            />
          )}
        </TabsContent>
        <TabsContent value="schedules" className="mt-4">
          {sLoading ? <div className="text-sm text-muted-foreground">Loading…</div> : <DataTable rows={schedules} columns={schedCols} />}
        </TabsContent>
        <TabsContent value="history" className="mt-4">
          <DataTable rows={tasks.filter((t) => t.status === "done")} columns={taskCols} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function StatCard({ title, value, accent }: { title: string; value: number; accent?: string }) {
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle></CardHeader>
      <CardContent><div className={`text-2xl font-bold ${accent ?? ""}`}>{value}</div></CardContent>
    </Card>
  );
}

function CompleteButton({ onDone }: { onDone: (notes: string) => void }) {
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState("");
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm" variant="default"><CheckCircle2 className="h-3 w-3" /></Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Complete task</DialogTitle></DialogHeader>
        <div><Label>Completion notes</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} placeholder="What was done…" /></div>
        <DialogFooter><Button onClick={() => { onDone(notes); setOpen(false); setNotes(""); }}>Mark done</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ScheduleDialog({ targets, users, onSubmit, pending }: { targets: TargetOption[]; users: UserOption[]; onSubmit: (v: Record<string, unknown>) => void; pending: boolean }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [targetKey, setTargetKey] = useState("");
  const [frequency, setFrequency] = useState<Frequency>("monthly");
  const [intervalDays, setIntervalDays] = useState("30");
  const [nextDue, setNextDue] = useState(new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10));
  const [assignedTo, setAssignedTo] = useState<string>("");
  const [reminderDays, setReminderDays] = useState("3");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const [target_type, target_id] = targetKey.split(":") as [Target, string];
    onSubmit({
      title, description: description || null, target_type, target_id,
      frequency, interval_days: frequency === "custom_days" ? parseInt(intervalDays) : null,
      next_due: nextDue, assigned_to: assignedTo || null, reminder_days_before: parseInt(reminderDays),
    });
  };

  return (
    <DialogContent className="max-w-2xl">
      <DialogHeader><DialogTitle>New PM schedule</DialogTitle></DialogHeader>
      <form onSubmit={submit} className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="md:col-span-2"><Label>Title</Label><Input required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Quarterly server dust cleanup" /></div>
        <div className="md:col-span-2"><Label>Target</Label>
          <Select value={targetKey} onValueChange={setTargetKey}>
            <SelectTrigger><SelectValue placeholder="Choose asset / server / network device…" /></SelectTrigger>
            <SelectContent className="max-h-72">
              {targets.map((t) => <SelectItem key={`${t.type}:${t.id}`} value={`${t.type}:${t.id}`}>{t.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div><Label>Frequency</Label>
          <Select value={frequency} onValueChange={(v) => setFrequency(v as Frequency)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {(["weekly", "monthly", "quarterly", "semiannual", "annual", "custom_days"] as Frequency[]).map((f) => <SelectItem key={f} value={f}>{labelize(f)}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        {frequency === "custom_days" && <div><Label>Every N days</Label><Input type="number" min="1" value={intervalDays} onChange={(e) => setIntervalDays(e.target.value)} /></div>}
        <div><Label>Next due</Label><Input type="date" required value={nextDue} onChange={(e) => setNextDue(e.target.value)} /></div>
        <div><Label>Reminder days before</Label><Input type="number" min="0" value={reminderDays} onChange={(e) => setReminderDays(e.target.value)} /></div>
        <div className="md:col-span-2"><Label>Assign to</Label>
          <Select value={assignedTo} onValueChange={setAssignedTo}>
            <SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger>
            <SelectContent>{users.map((u) => <SelectItem key={u.id} value={u.id}>{u.full_name ?? u.email}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="md:col-span-2"><Label>Description</Label><Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} /></div>
        <DialogFooter className="md:col-span-2"><Button type="submit" disabled={pending || !title || !targetKey}>{pending ? "Saving…" : "Create schedule"}</Button></DialogFooter>
      </form>
    </DialogContent>
  );
}