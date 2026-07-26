import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Download, Pencil } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { DataTable, type Column } from "@/components/data-table";
import { fmtDate, daysUntil, labelize } from "@/lib/format";
import { exportToXlsx } from "@/lib/export-xlsx";
import { useAuth } from "@/hooks/use-auth";
import { Badge } from "@/components/ui/badge";
import { BulkEditBar } from "@/components/bulk-edit-bar";
import { AttachmentsPanel } from "@/components/attachments-panel";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

export const Route = createFileRoute("/_authenticated/software")({
  head: () => ({ meta: [{ title: "Software & Licenses • Hotel IT Ops" }] }),
  component: SoftwarePage,
});

type Software = {
  id: string;
  name: string;
  version: string | null;
  vendor: string | null;
  license_type: string | null;
  seats: number | null;
  seats_used: number | null;
  expiration_date: string | null;
  license_delivery: string | null;
  license_key: string | null;
};

function SoftwarePage() {
  const { isIT, hasRole } = useAuth();
  const isAdmin = hasRole("administrator");
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editRow, setEditRow] = useState<Software | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["software"],
    queryFn: async () => {
      const { data, error } = await supabase.from("software").select("*").order("name");
      if (error) throw error;
      return data as Software[];
    },
  });

  const create = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const { error } = await supabase.from("software").insert(payload as never);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["software"] }); toast.success("Software added"); setOpen(false); },
    onError: (e: Error) => toast.error(e.message),
  });

  const update = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: Record<string, unknown> }) => {
      const { error } = await supabase.from("software").update(payload as never).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["software"] }); toast.success("Software updated"); setEditRow(null); },
    onError: (e: Error) => toast.error(e.message),
  });

  const bulk = useMutation({
    mutationFn: async (updates: Record<string, string>) => {
      const ids = Array.from(selected);
      const { error } = await supabase.from("software").update(updates as never).in("id", ids);
      if (error) throw error;
      return ids.length;
    },
    onSuccess: (n) => {
      qc.invalidateQueries({ queryKey: ["software"] });
      toast.success(`Updated ${n} record${n === 1 ? "" : "s"}`);
      setSelected(new Set());
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const columns: Column<Software>[] = [
    { key: "name", label: "Software", render: (s) => <span className="font-medium">{s.name}</span> },
    { key: "version", label: "Version" },
    { key: "vendor", label: "Vendor" },
    { key: "license_type", label: "License" },
    { key: "seats", label: "Seats", render: (s) => `${s.seats_used ?? 0} / ${s.seats ?? "∞"}` },
    { key: "expiration_date", label: "Expires", render: (s) => {
      const d = daysUntil(s.expiration_date);
      if (d == null) return "—";
      return <div className="flex items-center gap-2">{fmtDate(s.expiration_date)}{d < 60 && <Badge variant={d < 0 ? "destructive" : "secondary"}>{d < 0 ? "expired" : `${d}d`}</Badge>}</div>;
    } },
  ];

  if (isAdmin) {
    columns.push({
      key: "_actions",
      label: "",
      render: (s) => (
        <Button size="icon" variant="ghost" onClick={(e) => { e.stopPropagation(); setEditRow(s); }} aria-label="Edit software">
          <Pencil className="h-4 w-4" />
        </Button>
      ),
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Software & Licenses</h1>
          <p className="text-sm text-muted-foreground">Track installations, seats, and license expirations.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => exportToXlsx(rows, "software.xlsx", "Software")}>
            <Download className="h-4 w-4 mr-2" /> Export
          </Button>
          {isIT && (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-2" /> Add Software</Button></DialogTrigger>
              <SoftwareDialog onSubmit={(v) => create.mutate(v)} pending={create.isPending} />
            </Dialog>
          )}
        </div>
      </div>
      {isIT && (
        <BulkEditBar
          count={selected.size}
          pending={bulk.isPending}
          onClear={() => setSelected(new Set())}
          onApply={(u) => bulk.mutate(u)}
          fields={[
            { key: "license_type", label: "License", options: ["perpetual","subscription","oem","volume","freeware","trial"].map((s) => ({ value: s, label: labelize(s) })) },
          ]}
        />
      )}
      {isLoading ? <div className="text-sm text-muted-foreground">Loading…</div> : (
        <DataTable
          rows={rows}
          columns={columns}
          selectable={isIT}
          selectedIds={selected}
          onSelectionChange={setSelected}
        />
      )}
      {isAdmin && (
        <Dialog open={!!editRow} onOpenChange={(o) => !o && setEditRow(null)}>
          {editRow && (
            <SoftwareDialog
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

function SoftwareDialog({ onSubmit, pending, initial, mode = "create" }: { onSubmit: (v: Record<string, unknown>) => void; pending: boolean; initial?: Partial<Software> & Record<string, unknown>; mode?: "create" | "edit" }) {
  const toStr = (v: unknown) => (v == null ? "" : String(v));
  const [form, setForm] = useState<Record<string, string>>(() => {
    if (!initial) return {};
    const keys = ["name","version","vendor","license_type","license_key","seats","expiration_date","support_contact","notes"];
    const o: Record<string, string> = {};
    for (const k of keys) o[k] = toStr((initial as Record<string, unknown>)[k]);
    return o;
  });
  const bind = (k: string) => ({ value: form[k] ?? "", onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm((f) => ({ ...f, [k]: e.target.value })) });
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(form)) cleaned[k] = v === "" ? null : v;
    if (typeof cleaned.seats === "string") cleaned.seats = cleaned.seats ? parseInt(cleaned.seats as string, 10) : null;
    onSubmit(cleaned);
  };
  return (
    <DialogContent className="max-w-2xl">
      <DialogHeader><DialogTitle>{mode === "edit" ? "Edit Software" : "Add Software"}</DialogTitle></DialogHeader>
      <form onSubmit={submit} className="grid grid-cols-2 gap-3">
        <div className="col-span-2"><Label>Name</Label><Input required {...bind("name")} /></div>
        <div><Label>Version</Label><Input {...bind("version")} /></div>
        <div><Label>Vendor</Label><Input {...bind("vendor")} /></div>
        <div><Label>License Type</Label><Input {...bind("license_type")} /></div>
        <div><Label>License Key</Label><Input {...bind("license_key")} /></div>
        <div><Label>Seats</Label><Input type="number" {...bind("seats")} /></div>
        <div><Label>Expiration Date</Label><Input type="date" {...bind("expiration_date")} /></div>
        <div className="col-span-2"><Label>Support Contact</Label><Input {...bind("support_contact")} /></div>
        <div className="col-span-2"><Label>Notes</Label><Textarea {...bind("notes")} /></div>
        <DialogFooter className="col-span-2"><Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save"}</Button></DialogFooter>
      </form>
    </DialogContent>
  );
}