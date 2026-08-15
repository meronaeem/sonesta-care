import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, NotebookPen, FileDown, FileSpreadsheet, CalendarDays, ListChecks, AlarmClock, CheckCircle2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { fmtDate, fmtDateTime, labelize } from "@/lib/format";
import { useAuth } from "@/hooks/use-auth";
import { exportToXlsx } from "@/lib/export-xlsx";
import { generateBriefingActionsReport } from "@/lib/pdf-reports";
import {
  MEETING_TYPES, ACTION_STATUSES, PRIORITIES, STATUS_BADGE, PRIORITY_BADGE,
  allowedLabel, effectiveStatus,
} from "@/lib/briefings";

export const Route = createFileRoute("/_authenticated/briefings/")({
  head: () => ({
    meta: [
      { title: "Briefing Minutes • Hotel IT Ops" },
      { name: "description", content: "Record hotel briefings and track every action point to completion." },
      { property: "og:title", content: "Briefing Minutes • Hotel IT Ops" },
      { property: "og:description", content: "Daily briefings, decisions and action point tracking for hotel operations." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: BriefingsPage,
});

const CHART_COLORS = ["#3b82f6", "#8b5cf6", "#10b981", "#f59e0b", "#ef4444", "#06b6d4", "#ec4899"];

interface Briefing {
  id: string; briefing_number: string; title: string; briefing_date: string;
  start_time: string | null; end_time: string | null; location: string | null;
  meeting_type: string; organizer_id: string | null; created_at: string;
}
interface ActionPoint {
  id: string; action_number: string; briefing_id: string; description: string;
  department_id: string | null; responsible_id: string | null; priority: string;
  assigned_at: string; allowed_time: string; custom_minutes: number | null;
  due_at: string; status: string; completed_at: string | null;
}

function Kpi({ title, value, icon: Icon, hint }: { title: string; value: number; icon: React.ElementType; hint?: string }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
      </CardContent>
    </Card>
  );
}

function BriefingsPage() {
  const { user, isIT } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const [q, setQ] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [dept, setDept] = useState("all");
  const [resp, setResp] = useState("all");
  const [status, setStatus] = useState("all");
  const [priority, setPriority] = useState("all");
  const [mtype, setMtype] = useState("all");
  const [overdueOnly, setOverdueOnly] = useState(false);

  const { data: briefings = [] } = useQuery({
    queryKey: ["briefings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("briefings").select("*").order("briefing_date", { ascending: false });
      if (error) throw error;
      return data as unknown as Briefing[];
    },
  });

  const { data: actions = [] } = useQuery({
    queryKey: ["action_points"],
    queryFn: async () => {
      const { data, error } = await supabase.from("briefing_action_points").select("*").order("due_at");
      if (error) throw error;
      return data as unknown as ActionPoint[];
    },
  });

  const { data: departments = [] } = useQuery({
    queryKey: ["departments"],
    queryFn: async () => {
      const { data } = await supabase.from("departments").select("id, name").order("name");
      return (data ?? []) as { id: string; name: string }[];
    },
  });

  const { data: people = [] } = useQuery({
    queryKey: ["profiles_all"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id, full_name, email, department_id").order("full_name");
      return (data ?? []) as { id: string; full_name: string | null; email: string | null; department_id: string | null }[];
    },
  });

  const nameOf = (id: string | null) => people.find((p) => p.id === id)?.full_name ?? people.find((p) => p.id === id)?.email ?? "—";
  const deptOf = (id: string | null) => departments.find((d) => d.id === id)?.name ?? "—";

  const create = useMutation({
    mutationFn: async (payload: {
      briefing: Record<string, unknown>; participants: string[]; depts: string[];
    }) => {
      const { data, error } = await supabase.from("briefings").insert(payload.briefing as never).select("id").single();
      if (error) throw error;
      const id = (data as { id: string }).id;
      if (payload.participants.length) {
        await supabase.from("briefing_participants").insert(payload.participants.map((u) => ({ briefing_id: id, user_id: u })) as never);
      }
      if (payload.depts.length) {
        await supabase.from("briefing_departments").insert(payload.depts.map((d) => ({ briefing_id: id, department_id: d })) as never);
      }
      return id;
    },
    onSuccess: (id) => {
      qc.invalidateQueries({ queryKey: ["briefings"] });
      toast.success("Briefing created");
      setOpen(false);
      navigate({ to: "/briefings/$id", params: { id } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const enriched = useMemo(
    () => actions.map((a) => ({ ...a, live: effectiveStatus(a.status, a.due_at) })),
    [actions],
  );

  const filteredActions = useMemo(() => {
    const byId = new Map(briefings.map((b) => [b.id, b]));
    return enriched.filter((a) => {
      const b = byId.get(a.briefing_id);
      if (from && (!b || b.briefing_date < from)) return false;
      if (to && (!b || b.briefing_date > to)) return false;
      if (mtype !== "all" && b?.meeting_type !== mtype) return false;
      if (dept !== "all" && a.department_id !== dept) return false;
      if (resp !== "all" && a.responsible_id !== resp) return false;
      if (status !== "all" && a.live !== status) return false;
      if (priority !== "all" && a.priority !== priority) return false;
      if (overdueOnly && a.live !== "overdue") return false;
      if (q.trim() && !`${a.action_number} ${a.description}`.toLowerCase().includes(q.trim().toLowerCase())) return false;
      return true;
    });
  }, [enriched, briefings, from, to, mtype, dept, resp, status, priority, overdueOnly, q]);

  const filteredBriefings = useMemo(() => {
    return briefings.filter((b) => {
      if (from && b.briefing_date < from) return false;
      if (to && b.briefing_date > to) return false;
      if (mtype !== "all" && b.meeting_type !== mtype) return false;
      if (q.trim() && !`${b.briefing_number} ${b.title} ${b.location ?? ""}`.toLowerCase().includes(q.trim().toLowerCase())) return false;
      return true;
    });
  }, [briefings, from, to, mtype, q]);

  const today = new Date().toISOString().slice(0, 10);
  const weekEnd = new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10);
  const count = (s: string) => filteredActions.filter((a) => a.live === s).length;
  const dueToday = filteredActions.filter((a) => a.due_at.slice(0, 10) === today && !["completed", "cancelled"].includes(a.live)).length;
  const dueWeek = filteredActions.filter((a) => a.due_at.slice(0, 10) <= weekEnd && a.due_at.slice(0, 10) >= today && !["completed", "cancelled"].includes(a.live)).length;

  const group = (key: (a: (typeof filteredActions)[number]) => string) => {
    const m: Record<string, number> = {};
    filteredActions.forEach((a) => { const k = key(a); m[k] = (m[k] ?? 0) + 1; });
    return Object.entries(m).map(([name, value]) => ({ name, value }));
  };

  const exportExcel = () => {
    exportToXlsx(
      filteredActions.map((a) => {
        const b = briefings.find((x) => x.id === a.briefing_id);
        return {
          Briefing: b?.briefing_number ?? "",
          "Briefing Title": b?.title ?? "",
          Date: b?.briefing_date ?? "",
          "Action Point": a.action_number,
          Description: a.description,
          Department: deptOf(a.department_id),
          Responsible: nameOf(a.responsible_id),
          Priority: labelize(a.priority),
          "Allowed Time": allowedLabel(a.allowed_time, a.custom_minutes),
          "Assigned": fmtDateTime(a.assigned_at),
          "Due": fmtDateTime(a.due_at),
          Status: labelize(a.live),
          Completed: a.completed_at ? fmtDateTime(a.completed_at) : "",
        };
      }),
      `briefing-action-points-${today}`,
      "Action Points",
    );
  };

  const exportPdf = () => {
    generateBriefingActionsReport(
      filteredActions.map((a) => {
        const b = briefings.find((x) => x.id === a.briefing_id);
        return {
          briefing: `${b?.briefing_number ?? ""} ${b?.title ?? ""}`.trim(),
          action_number: a.action_number,
          description: a.description,
          department: deptOf(a.department_id),
          responsible: nameOf(a.responsible_id),
          priority: a.priority,
          allowed: allowedLabel(a.allowed_time, a.custom_minutes),
          due_at: a.due_at,
          status: a.live,
        };
      }),
      `${filteredActions.length} action points`,
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2"><NotebookPen className="h-6 w-6" /> Briefing Minutes</h1>
          <p className="text-sm text-muted-foreground">Meetings, decisions and action points tracked to completion.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={exportExcel}><FileSpreadsheet className="h-4 w-4 mr-2" />Excel</Button>
          <Button variant="outline" size="sm" onClick={exportPdf}><FileDown className="h-4 w-4 mr-2" />PDF</Button>
          {isIT && (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-2" />New Briefing</Button></DialogTrigger>
              <BriefingDialog
                people={people}
                departments={departments}
                defaultOrganizer={user?.id ?? null}
                pending={create.isPending}
                onSubmit={(v) => create.mutate(v)}
              />
            </Dialog>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi title="Today's Briefings" value={briefings.filter((b) => b.briefing_date === today).length} icon={CalendarDays} hint={`${briefings.length} total`} />
        <Kpi title="Total Action Points" value={filteredActions.length} icon={ListChecks} hint={`${count("open")} open · ${count("in_progress")} in progress`} />
        <Kpi title="Overdue" value={count("overdue")} icon={AlarmClock} hint={`${dueToday} due today · ${dueWeek} this week`} />
        <Kpi title="Completed" value={count("completed")} icon={CheckCircle2} hint={`${count("waiting")} waiting · ${count("cancelled")} cancelled`} />
      </div>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Filters</CardTitle></CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-4">
          <Input placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} />
          <div className="flex gap-2">
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="From date" />
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} aria-label="To date" />
          </div>
          <Select value={mtype} onValueChange={setMtype}>
            <SelectTrigger><SelectValue placeholder="Briefing type" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              {MEETING_TYPES.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={dept} onValueChange={setDept}>
            <SelectTrigger><SelectValue placeholder="Department" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All departments</SelectItem>
              {departments.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={resp} onValueChange={setResp}>
            <SelectTrigger><SelectValue placeholder="Responsible" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Anyone</SelectItem>
              {people.map((p) => <SelectItem key={p.id} value={p.id}>{p.full_name ?? p.email}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any status</SelectItem>
              {ACTION_STATUSES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={priority} onValueChange={setPriority}>
            <SelectTrigger><SelectValue placeholder="Priority" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any priority</SelectItem>
              {PRIORITIES.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={overdueOnly} onCheckedChange={(v) => setOverdueOnly(!!v)} /> Overdue only
          </label>
        </CardContent>
      </Card>

      <Tabs defaultValue="briefings">
        <TabsList>
          <TabsTrigger value="briefings">Briefings ({filteredBriefings.length})</TabsTrigger>
          <TabsTrigger value="actions">Action Points ({filteredActions.length})</TabsTrigger>
          <TabsTrigger value="charts">Charts</TabsTrigger>
        </TabsList>

        <TabsContent value="briefings" className="mt-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {filteredBriefings.length === 0 && <p className="text-sm text-muted-foreground">No briefings match the filters.</p>}
            {filteredBriefings.map((b) => {
              const aps = enriched.filter((a) => a.briefing_id === b.id);
              return (
                <Link key={b.id} to="/briefings/$id" params={{ id: b.id }}>
                  <Card className="h-full hover:border-primary transition-colors">
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-xs text-muted-foreground">{b.briefing_number}</span>
                        <Badge variant="outline" className="text-[10px]">{labelize(b.meeting_type)}</Badge>
                      </div>
                      <CardTitle className="text-base leading-snug">{b.title}</CardTitle>
                      <CardDescription>
                        {fmtDate(b.briefing_date)}{b.start_time ? ` · ${b.start_time.slice(0, 5)}` : ""}{b.end_time ? `–${b.end_time.slice(0, 5)}` : ""}
                        {b.location ? ` · ${b.location}` : ""}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-wrap gap-1.5 text-xs">
                      <Badge variant="secondary">{aps.length} action points</Badge>
                      {aps.filter((a) => a.live === "overdue").length > 0 && (
                        <Badge className={STATUS_BADGE.overdue}>{aps.filter((a) => a.live === "overdue").length} overdue</Badge>
                      )}
                      {aps.filter((a) => a.live === "completed").length > 0 && (
                        <Badge className={STATUS_BADGE.completed}>{aps.filter((a) => a.live === "completed").length} done</Badge>
                      )}
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="actions" className="mt-4">
          <div className="rounded-md border bg-card overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/40">
                <tr className="text-left">
                  {["Action", "Briefing", "Department", "Responsible", "Priority", "Due", "Status"].map((h) => (
                    <th key={h} className="px-3 py-2 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredActions.length === 0 && (
                  <tr><td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">No action points match the filters.</td></tr>
                )}
                {filteredActions.map((a) => {
                  const b = briefings.find((x) => x.id === a.briefing_id);
                  return (
                    <tr key={a.id} className="border-b last:border-0">
                      <td className="px-3 py-2">
                        <div className="font-mono text-[11px] text-muted-foreground">{a.action_number}</div>
                        <div className="max-w-md truncate">{a.description}</div>
                      </td>
                      <td className="px-3 py-2">
                        {b && <Link to="/briefings/$id" params={{ id: b.id }} className="text-primary hover:underline">{b.briefing_number}</Link>}
                      </td>
                      <td className="px-3 py-2">{deptOf(a.department_id)}</td>
                      <td className="px-3 py-2">{nameOf(a.responsible_id)}</td>
                      <td className="px-3 py-2"><Badge className={PRIORITY_BADGE[a.priority]}>{labelize(a.priority)}</Badge></td>
                      <td className="px-3 py-2 whitespace-nowrap">{fmtDateTime(a.due_at)}</td>
                      <td className="px-3 py-2"><Badge className={STATUS_BADGE[a.live]}>{labelize(a.live)}</Badge></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="charts" className="mt-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <ChartCard title="By department" desc="Action points per department">
              <BarChart data={group((a) => deptOf(a.department_id))}>
                <XAxis dataKey="name" fontSize={11} /><YAxis fontSize={11} allowDecimals={false} /><Tooltip />
                <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartCard>
            <ChartCard title="By status" desc="Current distribution">
              <PieChart>
                <Pie data={group((a) => labelize(a.live))} dataKey="value" nameKey="name" outerRadius={90} innerRadius={45}>
                  {group((a) => labelize(a.live)).map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                </Pie>
                <Tooltip /><Legend />
              </PieChart>
            </ChartCard>
            <ChartCard title="By priority" desc="Urgency mix">
              <BarChart data={group((a) => labelize(a.priority))}>
                <XAxis dataKey="name" fontSize={11} /><YAxis fontSize={11} allowDecimals={false} /><Tooltip />
                <Bar dataKey="value" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartCard>
            <ChartCard title="By responsible person" desc="Workload per person">
              <BarChart data={group((a) => nameOf(a.responsible_id))}>
                <XAxis dataKey="name" fontSize={11} /><YAxis fontSize={11} allowDecimals={false} /><Tooltip />
                <Bar dataKey="value" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartCard>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ChartCard({ title, desc, children }: { title: string; desc: string; children: React.ReactElement }) {
  return (
    <Card>
      <CardHeader><CardTitle>{title}</CardTitle><CardDescription>{desc}</CardDescription></CardHeader>
      <CardContent className="h-72">
        <ResponsiveContainer width="100%" height="100%">{children}</ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

export function BriefingDialog({
  people, departments, defaultOrganizer, pending, onSubmit, initial,
}: {
  people: { id: string; full_name: string | null; email: string | null }[];
  departments: { id: string; name: string }[];
  defaultOrganizer: string | null;
  pending: boolean;
  onSubmit: (v: { briefing: Record<string, unknown>; participants: string[]; depts: string[] }) => void;
  initial?: { briefing: Record<string, unknown>; participants: string[]; depts: string[] };
}) {
  const b = initial?.briefing ?? {};
  const [participants, setParticipants] = useState<string[]>(initial?.participants ?? []);
  const [depts, setDepts] = useState<string[]>(initial?.depts ?? []);
  const [meetingType, setMeetingType] = useState(String(b.meeting_type ?? "daily_briefing"));
  const [organizer, setOrganizer] = useState(String(b.organizer_id ?? defaultOrganizer ?? ""));

  const toggle = (list: string[], set: (v: string[]) => void, id: string) =>
    set(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const val = (k: string) => (String(f.get(k) ?? "").trim() || null);
    onSubmit({
      briefing: {
        title: val("title"),
        briefing_date: val("briefing_date"),
        start_time: val("start_time"),
        end_time: val("end_time"),
        location: val("location"),
        meeting_type: meetingType,
        organizer_id: organizer || null,
        general_notes: val("general_notes"),
      },
      participants,
      depts,
    });
  };

  return (
    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
      <DialogHeader><DialogTitle>{initial ? "Edit briefing" : "New briefing"}</DialogTitle></DialogHeader>
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="title">Title</Label>
          <Input id="title" name="title" required defaultValue={String(b.title ?? "")} placeholder="e.g. Morning operations briefing" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="space-y-1.5"><Label htmlFor="briefing_date">Date</Label>
            <Input id="briefing_date" name="briefing_date" type="date" required defaultValue={String(b.briefing_date ?? new Date().toISOString().slice(0, 10))} /></div>
          <div className="space-y-1.5"><Label htmlFor="start_time">Start time</Label>
            <Input id="start_time" name="start_time" type="time" defaultValue={String(b.start_time ?? "").slice(0, 5)} /></div>
          <div className="space-y-1.5"><Label htmlFor="end_time">End time</Label>
            <Input id="end_time" name="end_time" type="time" defaultValue={String(b.end_time ?? "").slice(0, 5)} /></div>
          <div className="space-y-1.5"><Label htmlFor="location">Location</Label>
            <Input id="location" name="location" defaultValue={String(b.location ?? "")} placeholder="Board room" /></div>
        </div>
        <div className="grid md:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Meeting type</Label>
            <Select value={meetingType} onValueChange={setMeetingType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{MEETING_TYPES.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Organizer</Label>
            <Select value={organizer} onValueChange={setOrganizer}>
              <SelectTrigger><SelectValue placeholder="Select organizer" /></SelectTrigger>
              <SelectContent>{people.map((p) => <SelectItem key={p.id} value={p.id}>{p.full_name ?? p.email}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid md:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Participants</Label>
            <div className="max-h-40 overflow-y-auto rounded border p-2 space-y-1">
              {people.map((p) => (
                <label key={p.id} className="flex items-center gap-2 text-sm">
                  <Checkbox checked={participants.includes(p.id)} onCheckedChange={() => toggle(participants, setParticipants, p.id)} />
                  {p.full_name ?? p.email}
                </label>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Participating departments</Label>
            <div className="max-h-40 overflow-y-auto rounded border p-2 space-y-1">
              {departments.length === 0 && <p className="text-xs text-muted-foreground">No departments defined yet.</p>}
              {departments.map((d) => (
                <label key={d.id} className="flex items-center gap-2 text-sm">
                  <Checkbox checked={depts.includes(d.id)} onCheckedChange={() => toggle(depts, setDepts, d.id)} />
                  {d.name}
                </label>
              ))}
            </div>
          </div>
        </div>
        <div className="space-y-1.5"><Label htmlFor="general_notes">General notes</Label>
          <Textarea id="general_notes" name="general_notes" rows={3} defaultValue={String(b.general_notes ?? "")} /></div>
        <p className="text-xs text-muted-foreground">
          Discussion &amp; action points are added one by one inside the briefing after it is saved.
        </p>
        <DialogFooter><Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save briefing"}</Button></DialogFooter>
      </form>
    </DialogContent>
  );
}
