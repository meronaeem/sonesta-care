import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Boxes,
  Ticket,
  Package,
  ServerCog,
  AlertTriangle,
  Clock,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { fmtDateTime, daysUntil, labelize } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard • Hotel IT Ops" }] }),
  component: Dashboard,
});

const CHART_COLORS = ["#3b82f6", "#8b5cf6", "#10b981", "#f59e0b", "#ef4444", "#06b6d4", "#ec4899"];

function KpiCard({ title, value, icon: Icon, hint }: { title: string; value: string | number; icon: React.ElementType; hint?: string }) {
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

function Dashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard"],
    queryFn: async () => {
      const [assets, tickets, software, servers, network, warrantyExp, licenseExp, recent] = await Promise.all([
        supabase.from("assets").select("id, asset_type, status, warranty_end"),
        supabase.from("tickets").select("id, status, priority, created_at"),
        supabase.from("software").select("id, name, expiration_date"),
        supabase.from("servers").select("id"),
        supabase.from("network_devices").select("id"),
        supabase.from("assets").select("id, asset_tag, warranty_end").not("warranty_end", "is", null).lte("warranty_end", new Date(Date.now() + 90 * 864e5).toISOString().slice(0, 10)).order("warranty_end").limit(5),
        supabase.from("software").select("id, name, expiration_date").not("expiration_date", "is", null).lte("expiration_date", new Date(Date.now() + 90 * 864e5).toISOString().slice(0, 10)).order("expiration_date").limit(5),
        supabase.from("tickets").select("id, ticket_number, title, status, created_at").order("created_at", { ascending: false }).limit(6),
      ]);
      return {
        assets: assets.data ?? [],
        tickets: tickets.data ?? [],
        software: software.data ?? [],
        servers: servers.data ?? [],
        network: network.data ?? [],
        warrantyExp: warrantyExp.data ?? [],
        licenseExp: licenseExp.data ?? [],
        recent: recent.data ?? [],
      };
    },
  });

  if (isLoading || !data) {
    return <div className="text-sm text-muted-foreground">Loading dashboard…</div>;
  }

  const openTickets = data.tickets.filter((t) => !["resolved", "closed", "cancelled"].includes(t.status)).length;
  const criticalTickets = data.tickets.filter((t) => t.priority === "critical" && !["resolved", "closed", "cancelled"].includes(t.status)).length;

  const byType = Object.entries(
    data.assets.reduce<Record<string, number>>((acc, a) => {
      acc[a.asset_type] = (acc[a.asset_type] || 0) + 1;
      return acc;
    }, {}),
  ).map(([name, value]) => ({ name: labelize(name), value }));

  const byStatus = Object.entries(
    data.assets.reduce<Record<string, number>>((acc, a) => {
      acc[a.status] = (acc[a.status] || 0) + 1;
      return acc;
    }, {}),
  ).map(([name, value]) => ({ name: labelize(name), value }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Operations Overview</h1>
        <p className="text-sm text-muted-foreground">Real-time snapshot of your IT estate.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard title="Total Assets" value={data.assets.length} icon={Boxes} hint={`${data.assets.filter((a) => a.status === "in_use").length} in use`} />
        <KpiCard title="Open Tickets" value={openTickets} icon={Ticket} hint={`${criticalTickets} critical`} />
        <KpiCard title="Software / Licenses" value={data.software.length} icon={Package} />
        <KpiCard title="Servers & Network" value={data.servers.length + data.network.length} icon={ServerCog} hint={`${data.servers.length} servers · ${data.network.length} network`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Assets by type</CardTitle>
            <CardDescription>Distribution across device categories</CardDescription>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byType}>
                <XAxis dataKey="name" fontSize={11} />
                <YAxis fontSize={11} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Assets by status</CardTitle>
            <CardDescription>Lifecycle state overview</CardDescription>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={byStatus} dataKey="value" nameKey="name" outerRadius={90} innerRadius={45}>
                  {byStatus.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-amber-500" /> Warranty expiring</CardTitle>
            <CardDescription>Next 90 days</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.warrantyExp.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing expiring soon.</p>
            ) : data.warrantyExp.map((a) => (
              <div key={a.id} className="flex items-center justify-between text-sm">
                <span className="font-medium">{a.asset_tag}</span>
                <Badge variant="secondary">{daysUntil(a.warranty_end)}d</Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-amber-500" /> Licenses expiring</CardTitle>
            <CardDescription>Next 90 days</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.licenseExp.length === 0 ? (
              <p className="text-sm text-muted-foreground">All licenses OK.</p>
            ) : data.licenseExp.map((s) => (
              <div key={s.id} className="flex items-center justify-between text-sm">
                <span className="font-medium truncate max-w-[60%]">{s.name}</span>
                <Badge variant="secondary">{daysUntil(s.expiration_date)}d</Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Clock className="h-4 w-4" /> Recent tickets</CardTitle>
            <CardDescription>Latest activity</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.recent.length === 0 ? (
              <p className="text-sm text-muted-foreground">No tickets yet.</p>
            ) : data.recent.map((t) => (
              <div key={t.id} className="text-sm flex flex-col gap-0.5 border-b last:border-0 pb-2 last:pb-0">
                <div className="flex items-center justify-between">
                  <span className="font-medium truncate max-w-[60%]">{t.title}</span>
                  <Badge variant="outline" className="text-[10px]">{labelize(t.status)}</Badge>
                </div>
                <span className="text-xs text-muted-foreground">{t.ticket_number} · {fmtDateTime(t.created_at)}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}