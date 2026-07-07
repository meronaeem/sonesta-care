import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText, FileDown, Boxes, Ticket as TicketIcon, Wrench } from "lucide-react";
import { useState } from "react";
import { generateInventoryReport, generateTicketReport, generatePmComplianceReport } from "@/lib/pdf-reports";
import { exportToXlsx } from "@/lib/export-xlsx";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/reports")({
  head: () => ({ meta: [{ title: "Reports • Hotel IT Ops" }] }),
  component: ReportsPage,
});

function ReportsPage() {
  const [assetType, setAssetType] = useState<string>("all");
  const [assetStatus, setAssetStatus] = useState<string>("all");
  const [ticketId, setTicketId] = useState<string>("");
  const [pmFrom, setPmFrom] = useState(new Date(Date.now() - 90 * 864e5).toISOString().slice(0, 10));
  const [pmTo, setPmTo] = useState(new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10));

  const { data: tickets = [] } = useQuery({
    queryKey: ["report_tickets_list"],
    queryFn: async () => {
      const { data } = await supabase.from("tickets").select("id, ticket_number, title").order("created_at", { ascending: false }).limit(200);
      return data ?? [];
    },
  });

  const runInventory = async () => {
    let q = supabase.from("assets").select("asset_tag, asset_type, manufacturer, model, serial_number, hostname, status, warranty_end");
    if (assetType !== "all") q = q.eq("asset_type", assetType as never);
    if (assetStatus !== "all") q = q.eq("status", assetStatus as never);
    const { data, error } = await q;
    if (error) return toast.error(error.message);
    const rows = (data ?? []);
    if (!rows.length) return toast.info("No assets match those filters.");
    const subtitle = `${rows.length} assets${assetType !== "all" ? ` · type: ${assetType}` : ""}${assetStatus !== "all" ? ` · status: ${assetStatus}` : ""}`;
    generateInventoryReport(rows, subtitle);
  };

  const runInventoryXlsx = async () => {
    let q = supabase.from("assets").select("*");
    if (assetType !== "all") q = q.eq("asset_type", assetType as never);
    if (assetStatus !== "all") q = q.eq("status", assetStatus as never);
    const { data } = await q;
    exportToXlsx(data ?? [], `asset-inventory-${new Date().toISOString().slice(0, 10)}.xlsx`, "Assets");
  };

  const runTicketReport = async () => {
    if (!ticketId) return toast.error("Choose a ticket.");
    const [{ data: t }, { data: comments }] = await Promise.all([
      supabase.from("tickets").select("*").eq("id", ticketId).maybeSingle(),
      supabase.from("ticket_comments").select("*").eq("ticket_id", ticketId).order("created_at"),
    ]);
    if (!t) return toast.error("Ticket not found.");
    const userIds = Array.from(new Set([t.requester_id, t.assignee_id, ...(comments ?? []).map((c) => c.author_id)].filter(Boolean))) as string[];
    const { data: profiles } = await supabase.from("profiles").select("id, full_name, email").in("id", userIds);
    const nameOf = (id: string | null | undefined) => {
      if (!id) return null;
      const p = profiles?.find((x) => x.id === id);
      return p?.full_name ?? p?.email ?? null;
    };
    generateTicketReport({
      ticket_number: t.ticket_number,
      title: t.title,
      description: t.description ?? null,
      category: t.category ?? null,
      priority: t.priority,
      status: t.status,
      created_at: t.created_at,
      requester_name: nameOf(t.requester_id),
      assignee_name: nameOf(t.assignee_id),
      resolution: t.resolution ?? null,
      comments: (comments ?? []).map((c) => ({ author: nameOf(c.author_id), body: c.body, created_at: c.created_at })),
    });
  };

  const runPmReport = async () => {
    const { data, error } = await supabase.from("pm_tasks" as never)
      .select("title, target_type, due_date, status, assigned_to, completed_at")
      .gte("due_date", pmFrom).lte("due_date", pmTo).order("due_date");
    if (error) return toast.error(error.message);
    const rows = ((data ?? []) as unknown as Array<{ title: string; target_type: string; due_date: string; status: string; assigned_to: string | null; completed_at: string | null }>);
    if (!rows.length) return toast.info("No PM tasks in that range.");
    const userIds = Array.from(new Set(rows.map((r) => r.assigned_to).filter(Boolean))) as string[];
    const { data: profiles } = userIds.length ? await supabase.from("profiles").select("id, full_name, email").in("id", userIds) : { data: [] };
    const nameOf = (id: string | null) => id ? (profiles?.find((x) => x.id === id)?.full_name ?? profiles?.find((x) => x.id === id)?.email ?? null) : null;
    generatePmComplianceReport(rows.map((r) => ({ ...r, assignee: nameOf(r.assigned_to) })), pmFrom, pmTo);
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Reports</h1>
        <p className="text-sm text-muted-foreground">Generate PDF and Excel reports.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Boxes className="h-4 w-4" /> Asset Inventory</CardTitle><CardDescription>Filtered list of assets</CardDescription></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Type</Label>
                <Select value={assetType} onValueChange={setAssetType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All types</SelectItem>
                    {["pc","laptop","server","printer","switch","firewall","router","access_point","ups","nas","phone","tablet","tv","pos","scanner","other"].map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Status</Label>
                <Select value={assetStatus} onValueChange={setAssetStatus}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All statuses</SelectItem>
                    {["in_use","in_stock","in_repair","retired","lost","disposed"].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={runInventory}><FileText className="h-4 w-4 mr-2" /> PDF</Button>
              <Button size="sm" variant="outline" onClick={runInventoryXlsx}><FileDown className="h-4 w-4 mr-2" /> Excel</Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><TicketIcon className="h-4 w-4" /> Ticket Report</CardTitle><CardDescription>Single ticket printout with comments</CardDescription></CardHeader>
          <CardContent className="space-y-3">
            <div><Label>Ticket</Label>
              <Select value={ticketId} onValueChange={setTicketId}>
                <SelectTrigger><SelectValue placeholder="Choose ticket…" /></SelectTrigger>
                <SelectContent className="max-h-72">{tickets.map((t) => <SelectItem key={t.id} value={t.id}>{t.ticket_number} — {t.title}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <Button size="sm" onClick={runTicketReport}><FileText className="h-4 w-4 mr-2" /> Generate PDF</Button>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader><CardTitle className="flex items-center gap-2"><Wrench className="h-4 w-4" /> PM Compliance</CardTitle><CardDescription>Completed / overdue / upcoming tasks over a date range</CardDescription></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-2 max-w-md">
              <div><Label>From</Label><Input type="date" value={pmFrom} onChange={(e) => setPmFrom(e.target.value)} /></div>
              <div><Label>To</Label><Input type="date" value={pmTo} onChange={(e) => setPmTo(e.target.value)} /></div>
            </div>
            <Button size="sm" onClick={runPmReport}><FileText className="h-4 w-4 mr-2" /> Generate PDF</Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}