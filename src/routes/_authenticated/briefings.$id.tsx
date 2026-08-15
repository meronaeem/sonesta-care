import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft, Plus, Pencil, Trash2, Ticket as TicketIcon, ExternalLink, CheckCircle2,
  Paperclip, FileDown, MapPin, Clock, User as UserIcon, Users,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { fmtDate, fmtDateTime, labelize } from "@/lib/format";
import { useAuth } from "@/hooks/use-auth";
import { AttachmentsPanel } from "@/components/attachments-panel";
import { ActivityTimeline } from "@/components/activity-timeline";
import { generateBriefingReport } from "@/lib/pdf-reports";
import { notifyActionPoint } from "@/lib/briefings.functions";
import { BriefingDialog } from "./briefings.index";
import {
  ALLOWED_TIMES, ACTION_STATUSES, PRIORITIES, REMINDER_OPTIONS, STATUS_BADGE, PRIORITY_BADGE,
  allowedLabel, computeDue, effectiveStatus, fromLocalInput, toLocalInput,
} from "@/lib/briefings";

export const Route = createFileRoute("/_authenticated/briefings/$id")({
  head: () => ({
    meta: [
      { title: "Briefing Details • Hotel IT Ops" },
      { name: "description", content: "Full briefing minutes with participants, notes and tracked action points." },
      { property: "og:title", content: "Briefing Details • Hotel IT Ops" },
      { property: "og:description", content: "Minutes, decisions and action points for a hotel operations briefing." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: BriefingDetail,
  errorComponent: () => <p className="text-sm text-destructive">Could not load this briefing.</p>,
  notFoundComponent: () => <p className="text-sm text-muted-foreground">Briefing not found.</p>,
});

interface ActionPoint {
  id: string; action_number: string; briefing_id: string; description: string;
  point_number: number | null;
  department_id: string | null; responsible_id: string | null; priority: string;
  assigned_at: string; allowed_time: string; custom_minutes: number | null; due_at: string;
  status: string; comments: string | null; completed_at: string | null; completion_notes: string | null;
  reminder_minutes_before: number;
}
interface LinkedTicket { id: string; ticket_number: string; status: string; resolution: string | null; action_point_id: string }

function BriefingDetail() {
  const { id } = Route.useParams();
  const { user, isIT } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [editBriefing, setEditBriefing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [viewFor, setViewFor] = useState<ActionPoint | null>(null);
  const [attachFor, setAttachFor] = useState<{ type: "briefing" | "action_point"; id: string; label: string } | null>(null);
  const [completeFor, setCompleteFor] = useState<ActionPoint | null>(null);

  const { data: briefing } = useQuery({
    queryKey: ["briefing", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("briefings").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data as unknown as Record<string, unknown> | null;
    },
  });

  const { data: actions = [] } = useQuery({
    queryKey: ["action_points", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("briefing_action_points").select("*").eq("briefing_id", id).order("point_number", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return data as unknown as ActionPoint[];
    },
  });

  const { data: tickets = [] } = useQuery({
    queryKey: ["briefing_tickets", id],
    queryFn: async () => {
      const { data } = await supabase.from("tickets").select("id, ticket_number, status, resolution, action_point_id").not("action_point_id", "is", null);
      return (data ?? []) as unknown as LinkedTicket[];
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

  const { data: participants = [] } = useQuery({
    queryKey: ["briefing_participants", id],
    queryFn: async () => {
      const { data } = await supabase.from("briefing_participants").select("user_id").eq("briefing_id", id);
      return (data ?? []).map((r) => (r as { user_id: string }).user_id);
    },
  });

  const { data: briefDepts = [] } = useQuery({
    queryKey: ["briefing_departments", id],
    queryFn: async () => {
      const { data } = await supabase.from("briefing_departments").select("department_id").eq("briefing_id", id);
      return (data ?? []).map((r) => (r as { department_id: string }).department_id);
    },
  });

  const nameOf = (uid: string | null) => people.find((p) => p.id === uid)?.full_name ?? people.find((p) => p.id === uid)?.email ?? "—";
  const deptOf = (did: string | null) => departments.find((d) => d.id === did)?.name ?? "—";
  const ticketFor = (apId: string) => tickets.find((t) => t.action_point_id === apId);

  const saveBriefing = useMutation({
    mutationFn: async (v: { briefing: Record<string, unknown>; participants: string[]; depts: string[] }) => {
      const { error } = await supabase.from("briefings").update(v.briefing as never).eq("id", id);
      if (error) throw error;
      await supabase.from("briefing_participants").delete().eq("briefing_id", id);
      if (v.participants.length) await supabase.from("briefing_participants").insert(v.participants.map((u) => ({ briefing_id: id, user_id: u })) as never);
      await supabase.from("briefing_departments").delete().eq("briefing_id", id);
      if (v.depts.length) await supabase.from("briefing_departments").insert(v.depts.map((d) => ({ briefing_id: id, department_id: d })) as never);
    },
    onSuccess: () => {
      ["briefing", "briefing_participants", "briefing_departments"].forEach((k) => qc.invalidateQueries({ queryKey: [k, id] }));
      qc.invalidateQueries({ queryKey: ["briefings"] });
      toast.success("Briefing updated");
      setEditBriefing(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteBriefing = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("briefings").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["briefings"] }); toast.success("Briefing deleted"); navigate({ to: "/briefings" }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveAction = useMutation({
    mutationFn: async ({ payload, editId }: { payload: Record<string, unknown>; editId?: string }) => {
      if (editId) {
        const { error } = await supabase.from("briefing_action_points").update(payload as never).eq("id", editId);
        if (error) throw error;
        return editId;
      }
      const { data, error } = await supabase
        .from("briefing_action_points")
        .insert({ ...payload, briefing_id: id } as never)
        .select("id")
        .single();
      if (error) throw error;
      return (data as { id: string }).id;
    },
    onSuccess: (apId, vars) => {
      qc.invalidateQueries({ queryKey: ["action_points"] });
      toast.success(vars.editId ? "Point updated" : "Point added");
      setAdding(false);
      setEditingId(null);
      if (!vars.editId) notifyActionPoint({ data: { actionPointId: apId, kind: "assigned" } }).catch(() => {});
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteAction = useMutation({
    mutationFn: async (apId: string) => {
      const { error } = await supabase.from("briefing_action_points").delete().eq("id", apId);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["action_points"] }); toast.success("Action point deleted"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const complete = useMutation({
    mutationFn: async ({ ap, notes }: { ap: ActionPoint; notes: string }) => {
      const { error } = await supabase
        .from("briefing_action_points")
        .update({ status: "completed", completion_notes: notes || null, completed_at: new Date().toISOString(), completed_by: user?.id ?? null } as never)
        .eq("id", ap.id);
      if (error) throw error;
      return ap.id;
    },
    onSuccess: (apId) => {
      qc.invalidateQueries({ queryKey: ["action_points"] });
      toast.success("Action point completed");
      setCompleteFor(null);
      notifyActionPoint({ data: { actionPointId: apId, kind: "completed" } }).catch(() => {});
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const createTask = useMutation({
    mutationFn: async (ap: ActionPoint) => {
      const b = briefing as Record<string, unknown> | null | undefined;
      const title = ap.description.length > 70 ? `${ap.description.slice(0, 67)}…` : ap.description;
      const { data, error } = await supabase
        .from("tickets")
        .insert({
          title: `[${ap.action_number}] ${title}`,
          description: `Briefing: ${b?.briefing_number ?? ""} — ${b?.title ?? ""}\nAction point: ${ap.action_number}\n\n${ap.description}`,
          category: "Briefing Action Point",
          department_id: ap.department_id,
          priority: ap.priority,
          requester_id: user!.id,
          assignee_id: ap.responsible_id,
          sla_due_at: ap.due_at,
          action_point_id: ap.id,
        } as never)
        .select("id, ticket_number")
        .single();
      if (error) throw error;
      const ticket = data as { id: string; ticket_number: string };

      // Carry the action point's attachments over to the new task
      const { data: files } = await supabase.from("attachments" as never).select("*").eq("entity_type", "action_point").eq("entity_id", ap.id);
      for (const f of (files ?? []) as unknown as Array<{ storage_path: string; file_name: string; mime_type: string | null; size_bytes: number | null }>) {
        await supabase.from("attachments" as never).insert({
          entity_type: "ticket", entity_id: ticket.id, storage_path: f.storage_path,
          file_name: f.file_name, mime_type: f.mime_type, size_bytes: f.size_bytes, uploaded_by: user!.id,
        } as never);
      }
      return ticket;
    },
    onSuccess: (t) => {
      qc.invalidateQueries({ queryKey: ["briefing_tickets", id] });
      qc.invalidateQueries({ queryKey: ["tickets"] });
      toast.success(`IT task ${t.ticket_number} created`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const b = briefing as Record<string, string | null> | null | undefined;
  const canEdit = isIT || b?.created_by === user?.id || b?.organizer_id === user?.id;

  const rows = useMemo(() => actions.map((a) => ({ ...a, live: effectiveStatus(a.status, a.due_at) })), [actions]);

  if (!briefing) return <p className="text-sm text-muted-foreground">Loading briefing…</p>;

  const exportPdf = () =>
    generateBriefingReport({
      briefing_number: String(b?.briefing_number ?? ""),
      title: String(b?.title ?? ""),
      briefing_date: String(b?.briefing_date ?? ""),
      start_time: b?.start_time ?? null,
      end_time: b?.end_time ?? null,
      location: b?.location ?? null,
      meeting_type: String(b?.meeting_type ?? ""),
      organizer: nameOf(b?.organizer_id ?? null),
      participants: participants.map(nameOf),
      departments: briefDepts.map(deptOf),
      general_notes: b?.general_notes ?? null,
      discussion_points: b?.discussion_points ?? null,
      actions: rows.map((a) => ({
        action_number: a.action_number, description: a.description,
        department: deptOf(a.department_id), responsible: nameOf(a.responsible_id),
        priority: a.priority, allowed: allowedLabel(a.allowed_time, a.custom_minutes),
        due_at: a.due_at, status: a.live, ticket: ticketFor(a.id)?.ticket_number ?? "—",
      })),
    });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button variant="ghost" size="sm" asChild><Link to="/briefings"><ArrowLeft className="h-4 w-4 mr-2" />All briefings</Link></Button>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={exportPdf}><FileDown className="h-4 w-4 mr-2" />Export PDF</Button>
          <Button variant="outline" size="sm" onClick={() => setAttachFor({ type: "briefing", id, label: String(b?.title ?? "Briefing") })}>
            <Paperclip className="h-4 w-4 mr-2" />Attachments
          </Button>
          {canEdit && <Button variant="outline" size="sm" onClick={() => setEditBriefing(true)}><Pencil className="h-4 w-4 mr-2" />Edit</Button>}
          {canEdit && (
            <Button variant="outline" size="sm" onClick={() => { if (confirm("Delete this briefing and all its action points?")) deleteBriefing.mutate(); }}>
              <Trash2 className="h-4 w-4 mr-2 text-destructive" />Delete
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs text-muted-foreground">{b?.briefing_number}</span>
            <Badge variant="outline">{labelize(String(b?.meeting_type ?? ""))}</Badge>
          </div>
          <CardTitle className="text-2xl">{b?.title}</CardTitle>
          <CardDescription className="flex flex-wrap gap-x-4 gap-y-1 pt-1">
            <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{fmtDate(b?.briefing_date)}
              {b?.start_time ? ` · ${String(b.start_time).slice(0, 5)}` : ""}{b?.end_time ? `–${String(b.end_time).slice(0, 5)}` : ""}</span>
            {b?.location && <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{b.location}</span>}
            <span className="flex items-center gap-1"><UserIcon className="h-3.5 w-3.5" />Organizer: {nameOf(b?.organizer_id ?? null)}</span>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex flex-wrap gap-1.5 items-center">
            <Users className="h-3.5 w-3.5 text-muted-foreground" />
            {participants.length === 0 ? <span className="text-muted-foreground">No participants recorded</span>
              : participants.map((p) => <Badge key={p} variant="secondary">{nameOf(p)}</Badge>)}
          </div>
          {briefDepts.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {briefDepts.map((d) => <Badge key={d} variant="outline">{deptOf(d)}</Badge>)}
            </div>
          )}
          {b?.general_notes && (<><Separator /><div><div className="font-medium mb-1">General notes</div><p className="whitespace-pre-wrap text-muted-foreground">{b.general_notes}</p></div></>)}
          {b?.discussion_points && (<><Separator /><div><div className="font-medium mb-1">Discussion summary</div><p className="whitespace-pre-wrap text-muted-foreground">{b.discussion_points}</p></div></>)}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>Discussion &amp; Action Points</CardTitle>
            <CardDescription>{rows.length} recorded · {rows.filter((r) => r.live === "overdue").length} overdue</CardDescription>
          </div>
          {canEdit && !adding && <Button size="sm" onClick={() => { setEditingId(null); setAdding(true); }}><Plus className="h-4 w-4 mr-2" />Add Point</Button>}
        </CardHeader>
        <CardContent className="space-y-4">
          {adding && (
            <PointForm
              pointNumber={(rows.reduce((m, r) => Math.max(m, r.point_number ?? 0), 0) || 0) + 1}
              people={people}
              departments={departments}
              pending={saveAction.isPending}
              onCancel={() => setAdding(false)}
              onSubmit={(payload) => saveAction.mutate({ payload })}
            />
          )}
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40">
              <tr className="text-left">
                {["#", "Discussion Point", "Action By", "Target Date", "Priority", "Status", "Related Task", "Actions"].map((h) => (
                  <th key={h} className="px-2 py-2 font-medium whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && !adding && <tr><td colSpan={8} className="py-8 text-center text-muted-foreground">No discussion points yet — click “Add Point”.</td></tr>}
              {rows.map((a) => {
                const t = ticketFor(a.id);
                const resolved = t && ["resolved", "closed"].includes(t.status);
                if (editingId === a.id) {
                  return (
                    <tr key={a.id}><td colSpan={8} className="py-3">
                      <PointForm
                        initial={a}
                        pointNumber={a.point_number ?? 0}
                        people={people}
                        departments={departments}
                        pending={saveAction.isPending}
                        onCancel={() => setEditingId(null)}
                        onSubmit={(payload) => saveAction.mutate({ payload, editId: a.id })}
                      />
                    </td></tr>
                  );
                }
                return (
                  <tr key={a.id} className="border-b last:border-0 align-top">
                    <td className="px-2 py-2 font-semibold tabular-nums">{a.point_number ?? "—"}</td>
                    <td className="px-2 py-2">
                      <div className="max-w-sm">{a.description}</div>
                      <div className="font-mono text-[11px] text-muted-foreground">{a.action_number}</div>
                      {a.comments && <div className="text-xs text-muted-foreground mt-1">💬 {a.comments}</div>}
                      {a.completion_notes && <div className="text-xs text-emerald-600 mt-1">✓ {a.completion_notes}</div>}
                    </td>
                    <td className="px-2 py-2 whitespace-nowrap">
                      <div>{deptOf(a.department_id)}</div>
                      <div className="text-xs text-muted-foreground">{nameOf(a.responsible_id)}</div>
                    </td>
                    <td className="px-2 py-2 whitespace-nowrap">{fmtDate(a.due_at)}</td>
                    <td className="px-2 py-2"><Badge className={PRIORITY_BADGE[a.priority]}>{labelize(a.priority)}</Badge></td>
                    <td className="px-2 py-2"><Badge className={STATUS_BADGE[a.live]}>{labelize(a.live)}</Badge></td>
                    <td className="px-2 py-2 whitespace-nowrap">
                      {t ? (
                        <div className="space-y-1">
                          <Link to="/tickets" className="text-primary hover:underline font-mono text-xs flex items-center gap-1">
                            {t.ticket_number}<ExternalLink className="h-3 w-3" />
                          </Link>
                          <div className="text-[11px] text-muted-foreground">{labelize(t.status)}</div>
                          {resolved && a.live !== "completed" && canEdit && (
                            <Button size="sm" variant="secondary" className="h-6 text-[11px]" onClick={() => complete.mutate({ ap: a, notes: t.resolution ?? "Resolved via IT task" })}>
                              Mark completed
                            </Button>
                          )}
                        </div>
                      ) : canEdit ? (
                        <Button size="sm" variant="outline" className="h-7 text-xs" disabled={createTask.isPending} onClick={() => createTask.mutate(a)}>
                          <TicketIcon className="h-3.5 w-3.5 mr-1" />Create Task
                        </Button>
                      ) : "—"}
                    </td>
                    <td className="px-2 py-2">
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" aria-label="View" onClick={() => setViewFor(a)}><Eye className="h-4 w-4" /></Button>
                        <Button size="sm" variant="ghost" aria-label="Attachments" onClick={() => setAttachFor({ type: "action_point", id: a.id, label: a.action_number })}><Paperclip className="h-4 w-4" /></Button>
                        {canEdit && <Button size="sm" variant="ghost" aria-label="Edit" onClick={() => { setAdding(false); setEditingId(a.id); }}><Pencil className="h-4 w-4" /></Button>}
                        {a.live !== "completed" && (isIT || a.responsible_id === user?.id || canEdit) && (
                          <Button size="sm" variant="ghost" aria-label="Mark completed" onClick={() => setCompleteFor(a)}><CheckCircle2 className="h-4 w-4 text-emerald-600" /></Button>
                        )}
                        {canEdit && <Button size="sm" variant="ghost" aria-label="Delete" onClick={() => { if (confirm("Delete this action point?")) deleteAction.mutate(a.id); }}><Trash2 className="h-4 w-4 text-destructive" /></Button>}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Audit trail</CardTitle><CardDescription>Every change to this briefing and its action points</CardDescription></CardHeader>
        <CardContent><ActivityTimeline entityType="briefing" entityId={id} /></CardContent>
      </Card>

      {editBriefing && (
        <Dialog open onOpenChange={(o) => !o && setEditBriefing(false)}>
          <BriefingDialog
            people={people}
            departments={departments}
            defaultOrganizer={user?.id ?? null}
            pending={saveBriefing.isPending}
            onSubmit={(v) => saveBriefing.mutate(v)}
            initial={{ briefing: (briefing ?? {}) as Record<string, unknown>, participants, depts: briefDepts }}
          />
        </Dialog>
      )}

      {viewFor && (
        <Dialog open onOpenChange={(o) => !o && setViewFor(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Point #{viewFor.point_number ?? "—"} · {viewFor.action_number}</DialogTitle></DialogHeader>
            <div className="space-y-3 text-sm">
              <div><div className="font-medium">Discussion point</div><p className="whitespace-pre-wrap text-muted-foreground">{viewFor.description}</p></div>
              <div className="grid grid-cols-2 gap-3">
                <div><div className="font-medium">Action by</div><p className="text-muted-foreground">{deptOf(viewFor.department_id)} · {nameOf(viewFor.responsible_id)}</p></div>
                <div><div className="font-medium">Target date</div><p className="text-muted-foreground">{fmtDate(viewFor.due_at)}</p></div>
                <div><div className="font-medium">Status</div><Badge className={STATUS_BADGE[effectiveStatus(viewFor.status, viewFor.due_at)]}>{labelize(effectiveStatus(viewFor.status, viewFor.due_at))}</Badge></div>
                <div><div className="font-medium">Priority</div><Badge className={PRIORITY_BADGE[viewFor.priority]}>{labelize(viewFor.priority)}</Badge></div>
              </div>
              {viewFor.comments && <div><div className="font-medium">Action / notes</div><p className="whitespace-pre-wrap text-muted-foreground">{viewFor.comments}</p></div>}
              {viewFor.completed_at && <div><div className="font-medium">Completed</div><p className="text-muted-foreground">{fmtDateTime(viewFor.completed_at)} — {viewFor.completion_notes ?? "—"}</p></div>}
              <div><div className="font-medium mb-1">Attachments</div><AttachmentsPanel entityType="action_point" entityId={viewFor.id} /></div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {attachFor && (
        <Dialog open onOpenChange={(o) => !o && setAttachFor(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Attachments — {attachFor.label}</DialogTitle></DialogHeader>
            <AttachmentsPanel entityType={attachFor.type} entityId={attachFor.id} />
          </DialogContent>
        </Dialog>
      )}

      {completeFor && (
        <Dialog open onOpenChange={(o) => !o && setCompleteFor(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Complete {completeFor.action_number}</DialogTitle></DialogHeader>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const notes = String(new FormData(e.currentTarget).get("notes") ?? "");
                complete.mutate({ ap: completeFor, notes });
              }}
              className="space-y-3"
            >
              <div className="space-y-1.5"><Label htmlFor="notes">Completion notes</Label><Textarea id="notes" name="notes" rows={4} /></div>
              <DialogFooter><Button type="submit" disabled={complete.isPending}>Mark completed</Button></DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

function ActionPointDialog({
  initial, people, departments, pending, onSubmit,
}: {
  initial?: ActionPoint;
  people: { id: string; full_name: string | null; email: string | null; department_id: string | null }[];
  departments: { id: string; name: string }[];
  pending: boolean;
  onSubmit: (payload: Record<string, unknown>) => void;
}) {
  const [dept, setDept] = useState(initial?.department_id ?? "");
  const [resp, setResp] = useState(initial?.responsible_id ?? "");
  const [priority, setPriority] = useState(initial?.priority ?? "medium");
  const [status, setStatus] = useState(initial?.status ?? "open");
  const [allowed, setAllowed] = useState(initial?.allowed_time ?? "1d");
  const [custom, setCustom] = useState(initial?.custom_minutes ? String(initial.custom_minutes) : "");
  const [assigned, setAssigned] = useState(toLocalInput(initial?.assigned_at ?? new Date().toISOString()));
  const [due, setDue] = useState(toLocalInput(initial?.due_at ?? computeDue(new Date().toISOString(), "1d")));
  const [manualDue, setManualDue] = useState(false);
  const [reminder, setReminder] = useState(String(initial?.reminder_minutes_before ?? 60));
  const [showAll, setShowAll] = useState(false);

  const recalc = (a: string, opt: string, cm: string) => {
    if (manualDue || !a) return;
    setDue(toLocalInput(computeDue(fromLocalInput(a), opt, cm ? Number(cm) : null)));
  };

  const candidates = showAll || !dept ? people : people.filter((p) => p.department_id === dept);

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    onSubmit({
      description: String(f.get("description") ?? "").trim(),
      department_id: dept || null,
      responsible_id: resp || null,
      priority,
      status,
      assigned_at: fromLocalInput(assigned),
      allowed_time: allowed,
      custom_minutes: allowed === "custom" && custom ? Number(custom) : null,
      due_at: fromLocalInput(due),
      reminder_minutes_before: Number(reminder),
      comments: String(f.get("comments") ?? "").trim() || null,
    });
  };

  return (
    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
      <DialogHeader><DialogTitle>{initial ? `Edit ${initial.action_number}` : "New action point"}</DialogTitle></DialogHeader>
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="description">Description</Label>
          <Textarea id="description" name="description" required rows={3} defaultValue={initial?.description ?? ""} placeholder="What needs to be done?" />
        </div>
        <div className="grid md:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Related department</Label>
            <Select value={dept} onValueChange={(v) => { setDept(v); setResp(""); }}>
              <SelectTrigger><SelectValue placeholder="Select department" /></SelectTrigger>
              <SelectContent>{departments.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label>Responsible person</Label>
              <button type="button" className="text-[11px] text-muted-foreground underline" onClick={() => setShowAll((s) => !s)}>
                {showAll ? "Filter by department" : "Show all users"}
              </button>
            </div>
            <Select value={resp} onValueChange={setResp}>
              <SelectTrigger><SelectValue placeholder="Select person" /></SelectTrigger>
              <SelectContent>
                {candidates.length === 0 && <div className="px-2 py-1.5 text-xs text-muted-foreground">No users in this department</div>}
                {candidates.map((p) => <SelectItem key={p.id} value={p.id}>{p.full_name ?? p.email}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid md:grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <Label>Priority</Label>
            <Select value={priority} onValueChange={setPriority}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{PRIORITIES.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{ACTION_STATUSES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Reminder</Label>
            <Select value={reminder} onValueChange={setReminder}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{REMINDER_OPTIONS.map((r) => <SelectItem key={r.value} value={String(r.value)}>{r.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid md:grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="assigned">Assigned date/time</Label>
            <Input id="assigned" type="datetime-local" value={assigned} onChange={(e) => { setAssigned(e.target.value); recalc(e.target.value, allowed, custom); }} />
          </div>
          <div className="space-y-1.5">
            <Label>Allowed completion time</Label>
            <Select value={allowed} onValueChange={(v) => { setAllowed(v); recalc(assigned, v, custom); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{ALLOWED_TIMES.map((a) => <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>)}</SelectContent>
            </Select>
            {allowed === "custom" && (
              <Input className="mt-2" type="number" min={1} placeholder="Minutes" value={custom}
                onChange={(e) => { setCustom(e.target.value); recalc(assigned, "custom", e.target.value); }} />
            )}
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="due">Due date/time</Label>
              <button type="button" className="text-[11px] text-muted-foreground underline" onClick={() => setManualDue((m) => !m)}>
                {manualDue ? "Auto-calculate" : "Override"}
              </button>
            </div>
            <Input id="due" type="datetime-local" value={due} readOnly={!manualDue} onChange={(e) => setDue(e.target.value)} />
            <p className="text-[11px] text-muted-foreground">{manualDue ? "Manual deadline" : "Assigned time + allowed time"}</p>
          </div>
        </div>
        <div className="space-y-1.5"><Label htmlFor="comments">Comments</Label><Textarea id="comments" name="comments" rows={2} defaultValue={initial?.comments ?? ""} /></div>
        <DialogFooter><Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save action point"}</Button></DialogFooter>
      </form>
    </DialogContent>
  );
}
