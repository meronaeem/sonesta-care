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
import { Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { DataTable, type Column } from "@/components/data-table";
import { fmtDateTime, labelize } from "@/lib/format";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/tickets")({
  head: () => ({ meta: [{ title: "Help Desk • Hotel IT Ops" }] }),
  component: TicketsPage,
});

type Ticket = {
  id: string;
  ticket_number: string;
  title: string;
  category: string | null;
  priority: string;
  status: string;
  requester_id: string;
  assignee_id: string | null;
  created_at: string;
};

const PRIORITY_COLORS: Record<string, string> = {
  low: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
  medium: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200",
  high: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  critical: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200",
};

function TicketsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["tickets"],
    queryFn: async () => {
      const { data, error } = await supabase.from("tickets").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data as Ticket[];
    },
  });

  const create = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const { error } = await supabase.from("tickets").insert({ ...payload, requester_id: user?.id });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["tickets"] }); toast.success("Ticket created"); setOpen(false); },
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
          <TicketDialog onSubmit={(v) => create.mutate(v)} pending={create.isPending} />
        </Dialog>
      </div>
      {isLoading ? <div className="text-sm text-muted-foreground">Loading…</div> : <DataTable rows={rows} columns={columns} />}
    </div>
  );
}

function TicketDialog({ onSubmit, pending }: { onSubmit: (v: Record<string, unknown>) => void; pending: boolean }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [priority, setPriority] = useState("medium");
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ title, description, category, priority });
  };
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
        <DialogFooter><Button type="submit" disabled={pending}>{pending ? "Submitting…" : "Submit ticket"}</Button></DialogFooter>
      </form>
    </DialogContent>
  );
}