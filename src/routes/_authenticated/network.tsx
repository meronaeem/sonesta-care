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
import { fmtDate } from "@/lib/format";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/network")({
  head: () => ({ meta: [{ title: "Network • Hotel IT Ops" }] }),
  component: NetworkPage,
});

const DEVICE_TYPES = ["Switch", "Firewall", "Router", "Wireless Controller", "Access Point", "Internet Link"];

type NetDevice = {
  id: string;
  name: string;
  device_type: string;
  manufacturer: string | null;
  model: string | null;
  ip_address: string | null;
  firmware: string | null;
  rack: string | null;
  warranty_end: string | null;
};

function NetworkPage() {
  const { isIT, hasRole } = useAuth();
  const isAdmin = hasRole("administrator");
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editRow, setEditRow] = useState<NetDevice | null>(null);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["network"],
    queryFn: async () => {
      const { data, error } = await supabase.from("network_devices").select("*").order("name");
      if (error) throw error;
      return data as NetDevice[];
    },
  });

  const create = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const { error } = await supabase.from("network_devices").insert(payload as never);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["network"] }); toast.success("Device added"); setOpen(false); },
    onError: (e: Error) => toast.error(e.message),
  });

  const update = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: Record<string, unknown> }) => {
      const { error } = await supabase.from("network_devices").update(payload as never).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["network"] }); toast.success("Device updated"); setEditRow(null); },
    onError: (e: Error) => toast.error(e.message),
  });

  const columns: Column<NetDevice>[] = [
    { key: "name", label: "Name", render: (d) => <span className="font-medium">{d.name}</span> },
    { key: "device_type", label: "Type", render: (d) => <Badge variant="secondary">{d.device_type}</Badge> },
    { key: "manufacturer", label: "Vendor" },
    { key: "model", label: "Model" },
    { key: "ip_address", label: "IP" },
    { key: "firmware", label: "Firmware" },
    { key: "rack", label: "Rack" },
    { key: "warranty_end", label: "Warranty", render: (d) => fmtDate(d.warranty_end) },
  ];

  if (isAdmin) {
    columns.push({
      key: "_actions",
      label: "",
      render: (d) => (
        <Button size="icon" variant="ghost" onClick={(e) => { e.stopPropagation(); setEditRow(d); }} aria-label="Edit device">
          <Pencil className="h-4 w-4" />
        </Button>
      ),
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Network Inventory</h1>
          <p className="text-sm text-muted-foreground">Switches, firewalls, routers, and wireless.</p>
        </div>
        {isIT && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-2" /> New Device</Button></DialogTrigger>
            <NetDialog onSubmit={(v) => create.mutate(v)} pending={create.isPending} />
          </Dialog>
        )}
      </div>
      {isLoading ? <div className="text-sm text-muted-foreground">Loading…</div> : <DataTable rows={rows} columns={columns} />}
      {isAdmin && (
        <Dialog open={!!editRow} onOpenChange={(o) => !o && setEditRow(null)}>
          {editRow && (
            <NetDialog
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

function NetDialog({ onSubmit, pending, initial, mode = "create" }: { onSubmit: (v: Record<string, unknown>) => void; pending: boolean; initial?: Partial<NetDevice> & Record<string, unknown>; mode?: "create" | "edit" }) {
  const toStr = (v: unknown) => (v == null ? "" : String(v));
  const [form, setForm] = useState<Record<string, string>>(() => {
    if (!initial) return {};
    const keys = ["name","manufacturer","model","serial_number","ip_address","mac_address","firmware","rack","warranty_end","support_info","notes"];
    const o: Record<string, string> = {};
    for (const k of keys) o[k] = toStr((initial as Record<string, unknown>)[k]);
    return o;
  });
  const [type, setType] = useState(toStr(initial?.device_type) || "Switch");
  const bind = (k: string) => ({ value: form[k] ?? "", onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm((f) => ({ ...f, [k]: e.target.value })) });
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned: Record<string, unknown> = { device_type: type };
    for (const [k, v] of Object.entries(form)) cleaned[k] = v === "" ? null : v;
    onSubmit(cleaned);
  };
  return (
    <DialogContent className="max-w-2xl">
      <DialogHeader><DialogTitle>{mode === "edit" ? "Edit Network Device" : "New Network Device"}</DialogTitle></DialogHeader>
      <form onSubmit={submit} className="grid grid-cols-2 gap-3">
        <div className="col-span-2"><Label>Name</Label><Input required {...bind("name")} /></div>
        <div><Label>Type</Label>
          <Select value={type} onValueChange={setType}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{DEVICE_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div><Label>Manufacturer</Label><Input {...bind("manufacturer")} /></div>
        <div><Label>Model</Label><Input {...bind("model")} /></div>
        <div><Label>Serial Number</Label><Input {...bind("serial_number")} /></div>
        <div><Label>IP Address</Label><Input {...bind("ip_address")} /></div>
        <div><Label>MAC</Label><Input {...bind("mac_address")} /></div>
        <div><Label>Firmware</Label><Input {...bind("firmware")} /></div>
        <div><Label>Rack</Label><Input {...bind("rack")} /></div>
        <div><Label>Warranty End</Label><Input type="date" {...bind("warranty_end")} /></div>
        <div className="col-span-2"><Label>Support Info</Label><Input {...bind("support_info")} /></div>
        <div className="col-span-2"><Label>Notes</Label><Textarea {...bind("notes")} /></div>
        <DialogFooter className="col-span-2"><Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save"}</Button></DialogFooter>
      </form>
    </DialogContent>
  );
}