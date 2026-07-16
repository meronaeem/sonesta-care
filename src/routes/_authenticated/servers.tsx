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
import { Plus, Pencil } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { DataTable, type Column } from "@/components/data-table";
import { labelize } from "@/lib/format";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/servers")({
  head: () => ({ meta: [{ title: "Servers • Hotel IT Ops" }] }),
  component: ServersPage,
});

type Server = {
  id: string;
  name: string;
  hostname: string | null;
  server_kind: string;
  hypervisor: string | null;
  cluster: string | null;
  cpu: string | null;
  ram: string | null;
  operating_system: string | null;
  ip_address: string | null;
  purpose: string | null;
  vm_count: number | null;
  backup_status: string | null;
};

function ServersPage() {
  const { isIT, hasRole } = useAuth();
  const isAdmin = hasRole("administrator");
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editRow, setEditRow] = useState<Server | null>(null);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["servers"],
    queryFn: async () => {
      const { data, error } = await supabase.from("servers").select("*").order("name");
      if (error) throw error;
      return data as Server[];
    },
  });

  const create = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const { error } = await supabase.from("servers").insert(payload as never);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["servers"] }); toast.success("Server added"); setOpen(false); },
    onError: (e: Error) => toast.error(e.message),
  });

  const update = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: Record<string, unknown> }) => {
      const { error } = await supabase.from("servers").update(payload as never).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["servers"] }); toast.success("Server updated"); setEditRow(null); },
    onError: (e: Error) => toast.error(e.message),
  });

  const columns: Column<Server>[] = [
    { key: "name", label: "Name", render: (s) => <span className="font-medium">{s.name}</span> },
    { key: "server_kind", label: "Kind", render: (s) => <Badge variant="secondary">{labelize(s.server_kind)}</Badge> },
    { key: "hypervisor", label: "Hypervisor" },
    { key: "cluster", label: "Cluster" },
    { key: "operating_system", label: "OS" },
    { key: "ip_address", label: "IP" },
    { key: "vm_count", label: "VMs" },
    { key: "purpose", label: "Purpose" },
    { key: "backup_status", label: "Backup" },
  ];

  if (isAdmin) {
    columns.push({
      key: "_actions",
      label: "",
      render: (s) => (
        <Button size="icon" variant="ghost" onClick={(e) => { e.stopPropagation(); setEditRow(s); }} aria-label="Edit server">
          <Pencil className="h-4 w-4" />
        </Button>
      ),
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Server Management</h1>
          <p className="text-sm text-muted-foreground">Physical and virtual server estate.</p>
        </div>
        {isIT && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-2" /> New Server</Button></DialogTrigger>
            <ServerDialog onSubmit={(v) => create.mutate(v)} pending={create.isPending} />
          </Dialog>
        )}
      </div>
      {isLoading ? <div className="text-sm text-muted-foreground">Loading…</div> : <DataTable rows={rows} columns={columns} />}
      {isAdmin && (
        <Dialog open={!!editRow} onOpenChange={(o) => !o && setEditRow(null)}>
          {editRow && (
            <ServerDialog
              initial={editRow}
              mode="edit"
              onSubmit={(v) => update.mutate({ id: editRow.id, payload: v })}
              pending={update.isPending}
            />
          )}
        </Dialog>
      )}
    </div>
  );
}

function ServerDialog({ onSubmit, pending, initial, mode = "create" }: { onSubmit: (v: Record<string, unknown>) => void; pending: boolean; initial?: Partial<Server> & Record<string, unknown>; mode?: "create" | "edit" }) {
  const toStr = (v: unknown) => (v == null ? "" : String(v));
  const [form, setForm] = useState<Record<string, string>>(() => {
    if (!initial) return {};
    const keys = ["name","hostname","cluster","cpu","ram","storage","operating_system","ip_address","vm_count","backup_status","purpose","notes"];
    const o: Record<string, string> = {};
    for (const k of keys) o[k] = toStr((initial as Record<string, unknown>)[k]);
    return o;
  });
  const [kind, setKind] = useState(toStr(initial?.server_kind) || "physical");
  const [hypervisor, setHypervisor] = useState(toStr(initial?.hypervisor));
  const bind = (k: string) => ({ value: form[k] ?? "", onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm((f) => ({ ...f, [k]: e.target.value })) });
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned: Record<string, unknown> = { server_kind: kind };
    cleaned.hypervisor = hypervisor || null;
    for (const [k, v] of Object.entries(form)) cleaned[k] = v === "" ? null : v;
    if (typeof cleaned.vm_count === "string") cleaned.vm_count = cleaned.vm_count ? parseInt(cleaned.vm_count as string, 10) : null;
    onSubmit(cleaned);
  };
  return (
    <DialogContent className="max-w-2xl">
      <DialogHeader><DialogTitle>{mode === "edit" ? "Edit Server" : "New Server"}</DialogTitle></DialogHeader>
      <form onSubmit={submit} className="grid grid-cols-2 gap-3">
        <div className="col-span-2"><Label>Name</Label><Input required {...bind("name")} /></div>
        <div className="col-span-2"><Label>FQDN</Label><Input placeholder="e.g. vm-prod-01.hotel.local" {...bind("hostname")} /></div>
        <div><Label>Kind</Label>
          <Select value={kind} onValueChange={setKind}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{["physical", "virtual", "container_host"].map((k) => <SelectItem key={k} value={k}>{labelize(k)}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div><Label>Hypervisor</Label>
          <Select value={hypervisor} onValueChange={setHypervisor}>
            <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
            <SelectContent>{["VMware", "Hyper-V", "Proxmox", "KVM", "Other"].map((k) => <SelectItem key={k} value={k}>{k}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div><Label>Cluster</Label><Input {...bind("cluster")} /></div>
        <div><Label>CPU</Label><Input {...bind("cpu")} /></div>
        <div><Label>RAM</Label><Input {...bind("ram")} /></div>
        <div><Label>Storage</Label><Input {...bind("storage")} /></div>
        <div><Label>Operating System</Label><Input {...bind("operating_system")} /></div>
        <div><Label>IP Address</Label><Input {...bind("ip_address")} /></div>
        <div><Label>VM Count</Label><Input type="number" {...bind("vm_count")} /></div>
        <div><Label>Backup Status</Label><Input {...bind("backup_status")} /></div>
        <div className="col-span-2"><Label>Purpose</Label><Input {...bind("purpose")} /></div>
        <div className="col-span-2"><Label>Notes</Label><Textarea {...bind("notes")} /></div>
        <DialogFooter className="col-span-2"><Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save"}</Button></DialogFooter>
      </form>
    </DialogContent>
  );
}