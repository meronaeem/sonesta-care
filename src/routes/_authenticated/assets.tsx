import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { Plus, Download, Upload, Pencil } from "lucide-react";
import { DataTable, type Column } from "@/components/data-table";
import { toast } from "sonner";
import { fmtDate, labelize } from "@/lib/format";
import { exportToXlsx, importFromXlsx } from "@/lib/export-xlsx";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/assets")({
  head: () => ({ meta: [{ title: "Asset Inventory • Hotel IT Ops" }] }),
  component: AssetsPage,
});

const ASSET_TYPES = ["pc", "laptop", "server", "printer", "switch", "firewall", "router", "access_point", "ups", "nas", "phone", "tablet", "tv", "pos", "scanner", "other"];
const ASSET_STATUSES = ["in_use", "in_stock", "in_repair", "retired", "lost", "disposed"];

type Asset = {
  id: string;
  asset_tag: string;
  asset_type: string;
  status: string;
  serial_number: string | null;
  manufacturer: string | null;
  model: string | null;
  hostname: string | null;
  ip_address: string | null;
  warranty_end: string | null;
  purchase_cost: number | null;
};

function AssetsPage() {
  const { isIT, hasRole } = useAuth();
  const canEdit = hasRole("administrator");
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Asset | null>(null);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["assets"],
    queryFn: async () => {
      const { data, error } = await supabase.from("assets").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data as Asset[];
    },
  });

  const createAsset = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const { error } = await supabase.from("assets").insert(payload as never);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["assets"] });
      toast.success("Asset created");
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateAsset = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: Record<string, unknown> }) => {
      const { error } = await supabase.from("assets").update(payload as never).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["assets"] });
      toast.success("Asset updated");
      setEditing(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleImport = async (file: File) => {
    try {
      const rows = await importFromXlsx(file);
      const cleaned = rows.map((r) => ({
        asset_type: String(r.asset_type ?? "other").toLowerCase(),
        serial_number: r.serial_number as string | undefined,
        manufacturer: r.manufacturer as string | undefined,
        model: r.model as string | undefined,
        hostname: r.hostname as string | undefined,
        ip_address: r.ip_address as string | undefined,
        status: (r.status as string | undefined)?.toLowerCase() ?? "in_stock",
      }));
      const { error } = await supabase.from("assets").insert(cleaned as never);
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ["assets"] });
      toast.success(`Imported ${cleaned.length} assets`);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const columns: Column<Asset>[] = [
    { key: "asset_tag", label: "Tag", render: (a) => <span className="font-mono text-xs">{a.asset_tag}</span> },
    { key: "asset_type", label: "Type", render: (a) => <Badge variant="secondary">{labelize(a.asset_type)}</Badge> },
    { key: "manufacturer", label: "Make/Model", render: (a) => `${a.manufacturer ?? "—"} ${a.model ?? ""}`.trim() },
    { key: "serial_number", label: "Serial" },
    { key: "hostname", label: "Hostname" },
    { key: "ip_address", label: "IP" },
    { key: "status", label: "Status", render: (a) => <Badge>{labelize(a.status)}</Badge> },
    { key: "warranty_end", label: "Warranty", render: (a) => fmtDate(a.warranty_end) },
  ];

  if (canEdit) {
    columns.push({
      key: "_edit",
      label: "",
      render: (a) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            setEditing(a);
          }}
        >
          <Pencil className="h-4 w-4" />
        </Button>
      ),
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Asset Inventory</h1>
          <p className="text-sm text-muted-foreground">All IT hardware across the property.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => exportToXlsx(rows, "assets.xlsx", "Assets")}>
            <Download className="h-4 w-4 mr-2" /> Export
          </Button>
          {isIT && (
            <>
              <label>
                <Button variant="outline" size="sm" asChild>
                  <span><Upload className="h-4 w-4 mr-2" /> Import</span>
                </Button>
                <input type="file" accept=".xlsx,.xls" className="hidden" onChange={(e) => e.target.files?.[0] && handleImport(e.target.files[0])} />
              </label>
              <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild>
                  <Button size="sm"><Plus className="h-4 w-4 mr-2" /> New Asset</Button>
                </DialogTrigger>
                <AssetDialog onSubmit={(v) => createAsset.mutate(v)} pending={createAsset.isPending} />
              </Dialog>
            </>
          )}
        </div>
      </div>
      {isLoading ? <div className="text-sm text-muted-foreground">Loading…</div> : <DataTable rows={rows} columns={columns} />}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        {editing && (
          <AssetDialog
            initial={editing}
            onSubmit={(v) => updateAsset.mutate({ id: editing.id, payload: v })}
            pending={updateAsset.isPending}
            mode="edit"
          />
        )}
      </Dialog>
    </div>
  );
}

function AssetDialog({
  onSubmit,
  pending,
  initial,
  mode = "create",
}: {
  onSubmit: (v: Record<string, unknown>) => void;
  pending: boolean;
  initial?: Record<string, unknown>;
  mode?: "create" | "edit";
}) {
  const [type, setType] = useState((initial?.asset_type as string) ?? "laptop");
  const [status, setStatus] = useState((initial?.status as string) ?? "in_stock");
  const [form, setForm] = useState<Record<string, string>>(() => {
    if (!initial) return {};
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(initial)) {
      if (k === "asset_type" || k === "status") continue;
      if (v == null) continue;
      if (k.endsWith("_date") || k === "warranty_start" || k === "warranty_end") {
        out[k] = String(v).slice(0, 10);
      } else {
        out[k] = String(v);
      }
    }
    return out;
  });
  const bind = (k: string) => ({ value: form[k] ?? "", onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm((f) => ({ ...f, [k]: e.target.value })) });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned: Record<string, unknown> = { asset_type: type, status };
    for (const [k, v] of Object.entries(form)) cleaned[k] = v === "" ? null : v;
    if (typeof cleaned.purchase_cost === "string") cleaned.purchase_cost = parseFloat(cleaned.purchase_cost as string) || null;
    onSubmit(cleaned);
  };

  return (
    <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
      <DialogHeader><DialogTitle>{mode === "edit" ? "Edit Asset" : "New Asset"}</DialogTitle></DialogHeader>
      <form onSubmit={submit} className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {mode === "edit" && (
          <div className="md:col-span-2"><Label>Asset Tag</Label><Input {...bind("asset_tag")} /></div>
        )}
        <div><Label>Type</Label>
          <Select value={type} onValueChange={setType}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{ASSET_TYPES.map((t) => <SelectItem key={t} value={t}>{labelize(t)}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div><Label>Status</Label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{ASSET_STATUSES.map((t) => <SelectItem key={t} value={t}>{labelize(t)}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div><Label>Serial Number</Label><Input {...bind("serial_number")} /></div>
        <div><Label>Manufacturer</Label><Input {...bind("manufacturer")} /></div>
        <div><Label>Model</Label><Input {...bind("model")} /></div>
        <div><Label>CPU</Label><Input {...bind("cpu")} /></div>
        <div><Label>RAM</Label><Input {...bind("ram")} /></div>
        <div><Label>Storage</Label><Input {...bind("storage")} /></div>
        <div><Label>Operating System</Label><Input {...bind("operating_system")} /></div>
        <div><Label>Hostname</Label><Input {...bind("hostname")} /></div>
        <div><Label>IP Address</Label><Input {...bind("ip_address")} /></div>
        <div><Label>MAC Address</Label><Input {...bind("mac_address")} /></div>
        <div><Label>Warranty Start</Label><Input type="date" {...bind("warranty_start")} /></div>
        <div><Label>Warranty End</Label><Input type="date" {...bind("warranty_end")} /></div>
        <div><Label>Purchase Date</Label><Input type="date" {...bind("purchase_date")} /></div>
        <div><Label>Purchase Cost</Label><Input type="number" step="0.01" {...bind("purchase_cost")} /></div>
        <div><Label>Vendor</Label><Input {...bind("vendor")} /></div>
        <div><Label>Invoice Number</Label><Input {...bind("invoice_number")} /></div>
        <div className="md:col-span-2"><Label>Notes</Label><Textarea {...bind("notes")} /></div>
        <DialogFooter className="md:col-span-2">
          <Button type="submit" disabled={pending}>{pending ? "Saving…" : mode === "edit" ? "Save changes" : "Create asset"}</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}