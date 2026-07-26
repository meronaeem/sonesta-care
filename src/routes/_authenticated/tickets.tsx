import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { Plus, Paperclip, X, Pencil } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { DataTable, type Column } from "@/components/data-table";
import { fmtDateTime, labelize } from "@/lib/format";
import { useAuth } from "@/hooks/use-auth";
import { AttachmentsPanel } from "@/components/attachments-panel";
import { ActivityTimeline } from "@/components/activity-timeline";
import { BulkEditBar } from "@/components/bulk-edit-bar";

export const Route = createFileRoute("/_authenticated/tickets")({
  head: () => ({ meta: [{ title: "Help Desk • Hotel IT Ops" }] }),
  component: TicketsPage,
});

type Ticket = {
  id: string;
  ticket_number: string;
  title: string;
  description: string | null;
  category: string | null;
  priority: string;
  status: string;
  requester_id: string;
  assignee_id: string | null;
  resolution: string | null;
  created_at: string;
};

const PRIORITY_COLORS: Record<string, string> = {
  low: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
  medium: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200",
  high: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  critical: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200",
};

function TicketsPage() {
  const { user, isIT, hasRole } = useAuth();
  const isAdmin = hasRole("administrator");
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [editRow, setEditRow] = useState<Ticket | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["tickets"],
    queryFn: async () => {
      const { data, error } = await supabase.from("tickets").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data as Ticket[];
    },
  });

  const create = useMutation({
    mutationFn: async ({ payload, files }: { payload: Record<string, unknown>; files: File[] }) => {
      const { data, error } = await supabase.from("tickets").insert({ ...payload, requester_id: user!.id } as never).select("id").single();
      if (error) throw error;
      const ticketId = (data as { id: string }).id;
      for (const file of files) {
        if (file.size > 10 * 1024 * 1024) {
          toast.error(`${file.name} exceeds 10 MB, skipped`);
          continue;
        }
        const safeName = file.name.replace(/[^\w.\-]+/g, "_");
        const path = `${user!.id}/ticket/${ticketId}/${Date.now()}-${safeName}`;
        const { error: upErr } = await supabase.storage.from("attachments").upload(path, file, {
          contentType: file.type || undefined,
          upsert: false,
        });
        if (upErr) { toast.error(`${file.name}: ${upErr.message}`); continue; }
        const { error: dbErr } = await supabase.from("attachments" as never).insert({
          entity_type: "ticket",
          entity_id: ticketId,
          storage_path: path,
          file_name: file.name,
          mime_type: file.type || null,
          size_bytes: file.size,
          uploaded_by: user!.id,
        } as never);
        if (dbErr) {
          await supabase.storage.from("attachments").remove([path]);
          toast.error(`${file.name}: ${dbErr.message}`);
        }
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["tickets"] }); toast.success("Ticket created"); setOpen(false); },
    onError: (e: Error) => toast.error(e.message),
  });

  const { data: itUsers = [] } = useQuery({
    queryKey: ["it_users"],
    enabled: isIT,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id, full_name, email");
      return (data ?? []) as { id: string; full_name: string | null; email: string | null }[];
    },
  });

  const bulk = useMutation({
    mutationFn: async (updates: Record<string, string>) => {
      const ids = Array.from(selected);
      const patch: Record<string, unknown> = { ...updates };
      if (patch.assignee_id === "__unassigned__") patch.assignee_id = null;
      const { error } = await supabase.from("tickets").update(patch as never).in("id", ids);
      if (error) throw error;
      return ids.length;
    },
    onSuccess: (n) => {
      qc.invalidateQueries({ queryKey: ["tickets"] });
      toast.success(`Updated ${n} ticket${n === 1 ? "" : "s"}`);
      setSelected(new Set());
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const update = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: Record<string, unknown> }) => {
      const { error } = await supabase.from("tickets").update(payload as never).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["tickets"] }); toast.success("Ticket updated"); setEditRow(null); },
    onError: (e: Error) => toast.error(e.message),
  });

  const columns: Column<Ticket>[] = [
    { key: "ticket_number", label: "#", render: (t) => <span className="font-mono text-xs">{t.ticket_number}</span> },
    { key: "title", label: "Title", render: (t) => <span className="font-medium">{t.title}</span> },
    { key: "category", label: "Category" },
    { key: "priority", label: "Priority", render: (t) => <span className={`px-2 py-0.5 rounded text-xs font-medium ${PRIORITY_COLORS[t.priority]}`}>{labelize(t.priority)}</span> },
    { key: "status", label: "Status", render: (t) => <Badge variant="outline">{labelize(t.status)}</Badge> },
    { key: "created_at", label: "Created", render: (t) => <span className="text-xs text-muted-foreground">{fmtDateTime(t.created_at)}</span> },
  ];

  if (isAdmin) {
    columns.push({
      key: "_actions",
      label: "",
      render: (t) => (
        <Button size="icon" variant="ghost" onClick={(e) => { e.stopPropagation(); setEditRow(t); }} aria-label="Edit ticket">
          <Pencil className="h-4 w-4" />
        </Button>
      ),
    });
  }

  const detail = detailId ? rows.find((r) => r.id === detailId) ?? null : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Help Desk</h1>
          <p className="text-sm text-muted-foreground">Submit and track IT support tickets.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="h-4 w-4 mr-2" /> New Ticket</Button>
          </DialogTrigger>
          <TicketDialog onSubmit={(payload, files) => create.mutate({ payload, files })} pending={create.isPending} />
        </Dialog>
      </div>
      {isIT && (
        <BulkEditBar
          count={selected.size}
          pending={bulk.isPending}
          onClear={() => setSelected(new Set())}
          onApply={(u) => bulk.mutate(u)}
          fields={[
            { key: "status", label: "Status", options: ["open","in_progress","on_hold","resolved","closed","cancelled"].map((s) => ({ value: s, label: labelize(s) })) },
            { key: "priority", label: "Priority", options: ["low","medium","high","critical"].map((s) => ({ value: s, label: labelize(s) })) },
            { key: "assignee_id", label: "Assignee", options: [{ value: "__unassigned__", label: "Unassigned" }, ...itUsers.map((u) => ({ value: u.id, label: u.full_name ?? u.email ?? u.id }))] },
          ]}
        />
      )}
      {isLoading ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : (
        <DataTable
          rows={rows}
          columns={columns}
          onRowClick={(t) => setDetailId(t.id)}
          selectable={isIT}
          selectedIds={selected}
          onSelectionChange={setSelected}
        />
      )}
      <Sheet open={!!detailId} onOpenChange={(o) => !o && setDetailId(null)}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          {detail && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-xs">{detail.ticket_number}</span>
                  <span>{detail.title}</span>
                </SheetTitle>
              </SheetHeader>
              <div className="mt-3 flex gap-2 flex-wrap">
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${PRIORITY_COLORS[detail.priority]}`}>{labelize(detail.priority)}</span>
                <Badge variant="outline">{labelize(detail.status)}</Badge>
                {detail.category && <Badge variant="secondary">{detail.category}</Badge>}
              </div>
              {detail.description && (
                <div className="mt-3 text-sm whitespace-pre-wrap p-3 rounded border bg-muted/40">{detail.description}</div>
              )}
              {detail.resolution && (
                <div className="mt-3 text-sm whitespace-pre-wrap p-3 rounded border bg-green-50 dark:bg-green-950/30">
                  <div className="text-xs font-medium mb-1">Resolution</div>
                  {detail.resolution}
                </div>
              )}
              <Separator className="my-4" />
              <AttachmentsPanel entityType="ticket" entityId={detail.id} />
              <Separator className="my-4" />
              <div className="text-sm font-medium mb-2">History</div>
              <ActivityTimeline entityType="ticket" entityId={detail.id} />
            </>
          )}
        </SheetContent>
      </Sheet>
      {isAdmin && (
        <Dialog open={!!editRow} onOpenChange={(o) => !o && setEditRow(null)}>
          {editRow && (
            <TicketEditDialog
              initial={editRow}
              assignees={itUsers}
              onSubmit={(v) => update.mutate({ id: editRow.id, payload: v })}
              pending={update.isPending}
            />
          )}
        </Dialog>
      )}
    </div>
  );
}

function TicketDialog({ onSubmit, pending }: { onSubmit: (v: Record<string, unknown>, files: File[]) => void; pending: boolean }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [priority, setPriority] = useState("medium");
  const [files, setFiles] = useState<File[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ title, description, category, priority }, files);
  };
  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files ?? []);
    e.target.value = "";
    setFiles((prev) => [...prev, ...picked]);
  };
  const removeAt = (i: number) => setFiles((prev) => prev.filter((_, idx) => idx !== i));
  return (
    <DialogContent>
      <DialogHeader><DialogTitle>Submit ticket</DialogTitle></DialogHeader>
      <form onSubmit={submit} className="space-y-3">
        <div><Label>Title</Label><Input required value={title} onChange={(e) => setTitle(e.target.value)} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger><SelectValue placeholder="Choose…" /></SelectTrigger>
              <SelectContent>
                {["Hardware", "Software", "Network", "Access", "Email", "Printer", "Phone", "Other"].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div><Label>Priority</Label>
            <Select value={priority} onValueChange={setPriority}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {["low", "medium", "high", "critical"].map((p) => <SelectItem key={p} value={p}>{labelize(p)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div><Label>Description</Label><Textarea rows={5} required value={description} onChange={(e) => setDescription(e.target.value)} /></div>
        <div>
          <Label>Attachments</Label>
          <input ref={fileRef} type="file" multiple hidden onChange={onPick} />
          <div className="flex items-center gap-2 mt-1">
            <Button type="button" size="sm" variant="outline" onClick={() => fileRef.current?.click()}>
              <Paperclip className="h-4 w-4 mr-2" /> Add files
            </Button>
            <span className="text-xs text-muted-foreground">Max 10 MB per file.</span>
          </div>
          {files.length > 0 && (
            <ul className="mt-2 space-y-1">
              {files.map((f, i) => (
                <li key={i} className="flex items-center gap-2 text-xs rounded border px-2 py-1 bg-muted/40">
                  <Paperclip className="h-3 w-3 shrink-0" />
                  <span className="truncate flex-1">{f.name}</span>
                  <span className="text-muted-foreground">{(f.size / 1024).toFixed(1)} KB</span>
                  <button type="button" onClick={() => removeAt(i)} aria-label="Remove"><X className="h-3 w-3" /></button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <DialogFooter><Button type="submit" disabled={pending}>{pending ? "Submitting…" : "Submit ticket"}</Button></DialogFooter>
      </form>
    </DialogContent>
  );
}

function TicketEditDialog({ initial, assignees, onSubmit, pending }: {
  initial: Ticket;
  assignees: { id: string; full_name: string | null; email: string | null }[];
  onSubmit: (v: Record<string, unknown>) => void;
  pending: boolean;
}) {
  const [title, setTitle] = useState(initial.title ?? "");
  const [description, setDescription] = useState(initial.description ?? "");
  const [category, setCategory] = useState(initial.category ?? "");
  const [priority, setPriority] = useState(initial.priority ?? "medium");
  const [status, setStatus] = useState(initial.status ?? "open");
  const [assignee, setAssignee] = useState(initial.assignee_id ?? "__unassigned__");
  const [resolution, setResolution] = useState(initial.resolution ?? "");
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      title,
      description: description || null,
      category: category || null,
      priority,
      status,
      assignee_id: assignee === "__unassigned__" ? null : assignee,
      resolution: resolution || null,
    });
  };
  return (
    <DialogContent className="max-w-2xl">
      <DialogHeader><DialogTitle>Edit ticket <span className="font-mono text-xs ml-2">{initial.ticket_number}</span></DialogTitle></DialogHeader>
      <form onSubmit={submit} className="space-y-3">
        <div><Label>Title</Label><Input required value={title} onChange={(e) => setTitle(e.target.value)} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger><SelectValue placeholder="Choose…" /></SelectTrigger>
              <SelectContent>
                {["Hardware", "Software", "Network", "Access", "Email", "Printer", "Phone", "Other"].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div><Label>Priority</Label>
            <Select value={priority} onValueChange={setPriority}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {["low", "medium", "high", "critical"].map((p) => <SelectItem key={p} value={p}>{labelize(p)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div><Label>Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {["open","in_progress","on_hold","resolved","closed","cancelled"].map((s) => <SelectItem key={s} value={s}>{labelize(s)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div><Label>Assignee</Label>
            <Select value={assignee} onValueChange={setAssignee}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__unassigned__">Unassigned</SelectItem>
                {assignees.map((u) => <SelectItem key={u.id} value={u.id}>{u.full_name ?? u.email ?? u.id}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div><Label>Description</Label><Textarea rows={4} value={description} onChange={(e) => setDescription(e.target.value)} /></div>
        <div><Label>Resolution</Label><Textarea rows={3} value={resolution} onChange={(e) => setResolution(e.target.value)} /></div>
        <DialogFooter><Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save changes"}</Button></DialogFooter>
      </form>
    </DialogContent>
  );
}