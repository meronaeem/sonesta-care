import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  getAdOverview,
  saveAdConfig,
  testAdConnection,
  testAdAuthentication,
  syncAdNow,
  listAdGroups,
} from "@/lib/ad.functions";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, type AppRole } from "@/hooks/use-auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, PlugZap, RefreshCw, ShieldCheck, Trash2, Users, UserCheck, UserX, AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/active-directory")({
  head: () => ({
    meta: [
      { title: "Active Directory • Hotel IT Ops" },
      { name: "description", content: "Configure the on-premises Microsoft Active Directory connection, synchronization schedule and group-to-role mapping." },
      { property: "og:title", content: "Active Directory Integration" },
      { property: "og:description", content: "Manage LDAPS connectivity, directory synchronization and AD group to application role mapping." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AdAdminPage,
});

const ROLES: AppRole[] = [
  "administrator",
  "it_manager",
  "it_supervisor",
  "it_engineer",
  "helpdesk",
  "department_manager",
  "employee",
  "read_only",
];

const ROLE_LABELS: Record<string, string> = {
  administrator: "Administrator",
  it_manager: "IT Manager",
  it_supervisor: "IT Supervisor",
  it_engineer: "IT Engineer",
  helpdesk: "Helpdesk",
  department_manager: "Department Manager",
  employee: "Employee",
  read_only: "Read Only",
};

const INTERVALS = [
  { value: "manual", label: "Manual only" },
  { value: "30m", label: "Every 30 minutes" },
  { value: "1h", label: "Every hour" },
  { value: "6h", label: "Every 6 hours" },
  { value: "daily", label: "Daily" },
];

type ConfigForm = Record<string, string | number | boolean>;

function fmt(ts?: string | null) {
  if (!ts) return "Never";
  return new Date(ts).toLocaleString();
}

function AdAdminPage() {
  const { hasRole, loading } = useAuth();
  const isAdmin = hasRole("administrator");
  const qc = useQueryClient();

  const fetchOverview = useServerFn(getAdOverview);
  const saveFn = useServerFn(saveAdConfig);
  const testConnFn = useServerFn(testAdConnection);
  const testAuthFn = useServerFn(testAdAuthentication);
  const syncFn = useServerFn(syncAdNow);
  const groupsFn = useServerFn(listAdGroups);

  const overview = useQuery({ queryKey: ["ad-overview"], queryFn: () => fetchOverview({}) });

  const [form, setForm] = useState<ConfigForm | null>(null);
  const [bindPassword, setBindPassword] = useState("");
  const [testUser, setTestUser] = useState({ username: "", password: "" });
  const [authDialog, setAuthDialog] = useState(false);
  const [newMapping, setNewMapping] = useState<{ ad_group: string; role: string; priority: string }>({ ad_group: "", role: "employee", priority: "100" });

  const cfg = overview.data?.config ?? null;
  const state: ConfigForm = form ?? ((cfg ?? {}) as unknown as ConfigForm);
  const set = (key: string, value: string | number | boolean) => setForm({ ...state, [key]: value });

  const save = useMutation({
    mutationFn: async () => {
      const payload: Record<string, unknown> = {
        enabled: Boolean(state["enabled"]),
        domain_name: String(state["domain_name"] ?? ""),
        ldap_host: String(state["ldap_host"] ?? ""),
        ldap_port: Number(state["ldap_port"] ?? 389),
        ldaps_port: Number(state["ldaps_port"] ?? 636),
        base_dn: String(state["base_dn"] ?? ""),
        bind_username: String(state["bind_username"] ?? ""),
        users_search_base: String(state["users_search_base"] ?? ""),
        groups_search_base: String(state["groups_search_base"] ?? ""),
        ssl_enabled: Boolean(state["ssl_enabled"]),
        validate_certificate: Boolean(state["validate_certificate"]),
        sync_interval: String(state["sync_interval"] ?? "manual"),
        group_mapping_enabled: Boolean(state["group_mapping_enabled"]),
        default_role: String(state["default_role"] ?? "employee"),
      };
      return saveFn({ data: payload });
    },
    onSuccess: () => {
      toast.success("Active Directory settings saved");
      setForm(null);
      qc.invalidateQueries({ queryKey: ["ad-overview"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const testConn = useMutation({
    mutationFn: async () => testConnFn({ data: bindPassword ? { bindPassword } : {} }),
    onSuccess: (res) => {
      if (res.ok) toast.success(`Connected to ${res.url} in ${res.tookMs ?? 0} ms`);
      else toast.error(res.error ?? "Connection failed");
      qc.invalidateQueries({ queryKey: ["ad-overview"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const testAuth = useMutation({
    mutationFn: async () => testAuthFn({ data: testUser }),
    onSuccess: (res) => {
      if (res.ok) toast.success("Credentials accepted by Active Directory");
      else toast.error(res.message ?? "Authentication failed");
      setTestUser({ username: "", password: "" });
      setAuthDialog(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const sync = useMutation({
    mutationFn: async () => syncFn({}),
    onSuccess: (r) => {
      toast.success(`Sync complete — ${r.users_found} users (${r.users_created} new, ${r.users_updated} updated, ${r.users_disabled} disabled)`);
      qc.invalidateQueries({ queryKey: ["ad-overview"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const importGroups = useMutation({
    mutationFn: async () => groupsFn({}),
    onSuccess: (r) => {
      if (!r.ok) return toast.error(r.error ?? "Could not read groups");
      toast.success(`${r.count ?? r.groups?.length ?? 0} security groups found in the directory`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addMapping = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("ad_group_mappings" as never).insert({
        ad_group: newMapping.ad_group.trim(),
        role: newMapping.role,
        priority: Number(newMapping.priority) || 100,
      } as never);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      setNewMapping({ ad_group: "", role: "employee", priority: "100" });
      toast.success("Group mapping added");
      qc.invalidateQueries({ queryKey: ["ad-overview"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeMapping = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("ad_group_mappings" as never).delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ad-overview"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  if (loading) return <div className="text-sm text-muted-foreground">Loading…</div>;
  if (!isAdmin)
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Administrator access required</AlertTitle>
        <AlertDescription>Only administrators can manage the Active Directory integration.</AlertDescription>
      </Alert>
    );

  const status = String(cfg?.connection_status ?? "unknown");
  const stats = overview.data?.stats;

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Active Directory</h1>
          <p className="text-sm text-muted-foreground">
            On-premises Microsoft Active Directory is the authoritative source for employee identity.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => testConn.mutate()} disabled={testConn.isPending}>
            {testConn.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlugZap className="h-4 w-4" />} Test Connection
          </Button>
          <Button variant="outline" onClick={() => setAuthDialog(true)}>
            <ShieldCheck className="h-4 w-4" /> Test Authentication
          </Button>
          <Button onClick={() => sync.mutate()} disabled={sync.isPending}>
            {sync.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Sync Now
          </Button>
        </div>
      </div>

      {overview.data && !overview.data.bridgeConfigured && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>AD Bridge Agent not configured</AlertTitle>
          <AlertDescription>
            Deploy the agent in <code>/ad-bridge-agent</code> on a server inside the hotel network, then set the{" "}
            <code>AD_BRIDGE_URL</code> and <code>AD_BRIDGE_TOKEN</code> secrets. The application never talks to the Domain
            Controller directly.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Connection" value={status === "connected" ? "Connected" : status === "error" ? "Error" : "Unknown"} hint={fmt(cfg?.connection_checked_at)} tone={status === "connected" ? "ok" : status === "error" ? "bad" : "muted"} icon={<PlugZap className="h-4 w-4" />} />
        <StatCard label="AD users" value={String(stats?.total ?? 0)} hint={`Last sync ${fmt(cfg?.last_successful_sync_at)}`} icon={<Users className="h-4 w-4" />} />
        <StatCard label="Active" value={String(stats?.active ?? 0)} hint="Enabled in Active Directory" tone="ok" icon={<UserCheck className="h-4 w-4" />} />
        <StatCard label="Disabled" value={String(stats?.disabled ?? 0)} hint="Blocked from signing in" tone={stats?.disabled ? "bad" : "muted"} icon={<UserX className="h-4 w-4" />} />
      </div>

      {cfg?.last_sync_error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Last sync errors</AlertTitle>
          <AlertDescription className="break-words">{cfg.last_sync_error}</AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="connection">
        <TabsList>
          <TabsTrigger value="connection">Connection</TabsTrigger>
          <TabsTrigger value="mapping">Group Mapping</TabsTrigger>
          <TabsTrigger value="history">Sync History</TabsTrigger>
        </TabsList>

        <TabsContent value="connection" className="pt-4">
          <Card>
            <CardHeader>
              <CardTitle>Directory configuration</CardTitle>
              <CardDescription>
                All LDAP traffic happens server-side through the on-premises bridge agent. The bind password is stored only on
                that agent and never in this database.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between rounded-md border p-3">
                <div>
                  <div className="text-sm font-medium">Active Directory authentication</div>
                  <div className="text-xs text-muted-foreground">Allow employees to sign in with their AD credentials.</div>
                </div>
                <Switch checked={Boolean(state["enabled"])} onCheckedChange={(v) => set("enabled", v)} />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Domain Name" placeholder="hotel.local" value={state["domain_name"]} onChange={(v) => set("domain_name", v)} />
                <Field label="Domain Controller / LDAP Server" placeholder="dc01.hotel.local" value={state["ldap_host"]} onChange={(v) => set("ldap_host", v)} />
                <Field label="LDAP Port" type="number" placeholder="389" value={state["ldap_port"]} onChange={(v) => set("ldap_port", v)} />
                <Field label="LDAPS Port" type="number" placeholder="636" value={state["ldaps_port"]} onChange={(v) => set("ldaps_port", v)} />
                <Field label="Base DN" placeholder="DC=hotel,DC=local" value={state["base_dn"]} onChange={(v) => set("base_dn", v)} />
                <Field label="Bind Username (service account)" placeholder="svc-hotelit@hotel.local" value={state["bind_username"]} onChange={(v) => set("bind_username", v)} />
                <Field label="Users Search Base" placeholder="OU=Staff,DC=hotel,DC=local" value={state["users_search_base"]} onChange={(v) => set("users_search_base", v)} />
                <Field label="Groups Search Base" placeholder="OU=Groups,DC=hotel,DC=local" value={state["groups_search_base"]} onChange={(v) => set("groups_search_base", v)} />
                <div className="space-y-2">
                  <Label>Bind Password (test only)</Label>
                  <Input
                    type="password"
                    autoComplete="new-password"
                    placeholder={cfg?.bind_password_set ? "Stored on the bridge agent" : "Used for Test Connection only"}
                    value={bindPassword}
                    onChange={(e) => setBindPassword(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Never saved here. For day-to-day operation set <code>AD_BIND_PASSWORD</code> in the bridge agent's <code>.env</code>.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Synchronization Interval</Label>
                  <Select value={String(state["sync_interval"] ?? "manual")} onValueChange={(v) => set("sync_interval", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {INTERVALS.map((i) => <SelectItem key={i.value} value={i.value}>{i.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Separator />

              <div className="grid gap-4 md:grid-cols-2">
                <ToggleRow label="SSL / LDAPS Enabled" hint="Strongly recommended — encrypts all directory traffic." checked={Boolean(state["ssl_enabled"])} onChange={(v) => set("ssl_enabled", v)} />
                <ToggleRow label="Certificate Validation" hint="Disable only for a self-signed lab certificate." checked={Boolean(state["validate_certificate"])} onChange={(v) => set("validate_certificate", v)} />
                <ToggleRow label="Apply AD group role mapping" hint="When off, application roles are managed manually and never overwritten by sync." checked={Boolean(state["group_mapping_enabled"])} onChange={(v) => set("group_mapping_enabled", v)} />
                <div className="space-y-2">
                  <Label>Default role for new users</Label>
                  <Select value={String(state["default_role"] ?? "employee")} onValueChange={(v) => set("default_role", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ROLES.map((r) => <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setForm(null)} disabled={!form}>Discard</Button>
                <Button onClick={() => save.mutate()} disabled={save.isPending}>
                  {save.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Save configuration
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="mapping" className="pt-4">
          <Card>
            <CardHeader>
              <CardTitle>AD group → application role</CardTitle>
              <CardDescription>
                The lowest priority number wins when a user belongs to several mapped groups. Roles are stored in the
                application database, never in Active Directory.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-end gap-2">
                <div className="space-y-2 min-w-[220px] flex-1">
                  <Label>AD security group</Label>
                  <Input placeholder="IT-Admins" value={newMapping.ad_group} onChange={(e) => setNewMapping({ ...newMapping, ad_group: e.target.value })} />
                </div>
                <div className="space-y-2 min-w-[180px]">
                  <Label>Application role</Label>
                  <Select value={newMapping.role} onValueChange={(v) => setNewMapping({ ...newMapping, role: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ROLES.map((r) => <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 w-28">
                  <Label>Priority</Label>
                  <Input type="number" value={newMapping.priority} onChange={(e) => setNewMapping({ ...newMapping, priority: e.target.value })} />
                </div>
                <Button onClick={() => addMapping.mutate()} disabled={!newMapping.ad_group.trim() || addMapping.isPending}>Add mapping</Button>
                <Button variant="outline" onClick={() => importGroups.mutate()} disabled={importGroups.isPending}>
                  {importGroups.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Read groups from AD
                </Button>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>AD group</TableHead>
                    <TableHead>Application role</TableHead>
                    <TableHead className="w-24">Priority</TableHead>
                    <TableHead className="w-16" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(overview.data?.mappings ?? []).map((m) => (
                    <TableRow key={m.id}>
                      <TableCell className="font-medium">{m.ad_group}</TableCell>
                      <TableCell><Badge variant="secondary">{ROLE_LABELS[m.role] ?? m.role}</Badge></TableCell>
                      <TableCell>{m.priority}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" onClick={() => removeMapping.mutate(m.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {!(overview.data?.mappings ?? []).length && (
                    <TableRow><TableCell colSpan={4} className="text-sm text-muted-foreground">No group mappings yet.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="pt-4">
          <Card>
            <CardHeader>
              <CardTitle>Synchronization audit</CardTitle>
              <CardDescription>Every synchronization run is recorded. Historical user records are never deleted.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Started</TableHead>
                    <TableHead>Trigger</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Found</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Updated</TableHead>
                    <TableHead>Disabled</TableHead>
                    <TableHead>Errors</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(overview.data?.runs ?? []).map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="whitespace-nowrap">{fmt(r.started_at)}</TableCell>
                      <TableCell className="capitalize">{r.trigger_source}</TableCell>
                      <TableCell>
                        <Badge variant={r.status === "success" ? "secondary" : r.status === "failed" ? "destructive" : "outline"}>{r.status}</Badge>
                      </TableCell>
                      <TableCell>{r.users_found}</TableCell>
                      <TableCell>{r.users_created}</TableCell>
                      <TableCell>{r.users_updated}</TableCell>
                      <TableCell>{r.users_disabled}</TableCell>
                      <TableCell className="max-w-[280px] truncate text-xs text-muted-foreground">
                        {r.error_count ? (r.errors ?? []).join(" | ") : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                  {!(overview.data?.runs ?? []).length && (
                    <TableRow><TableCell colSpan={8} className="text-sm text-muted-foreground">No synchronization has run yet.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={authDialog} onOpenChange={setAuthDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Test Authentication</DialogTitle>
            <DialogDescription>Validates credentials against Active Directory. No session is created and nothing is stored.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Username</Label>
              <Input placeholder="jdoe / HOTEL\jdoe / jdoe@hotel.local" value={testUser.username} onChange={(e) => setTestUser({ ...testUser, username: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Password</Label>
              <Input type="password" autoComplete="off" value={testUser.password} onChange={(e) => setTestUser({ ...testUser, password: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => testAuth.mutate()} disabled={testAuth.isPending || !testUser.username || !testUser.password}>
              {testAuth.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Test
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatCard({ label, value, hint, tone = "muted", icon }: { label: string; value: string; hint?: string; tone?: "ok" | "bad" | "muted"; icon?: React.ReactNode }) {
  const toneClass = tone === "ok" ? "text-emerald-600" : tone === "bad" ? "text-destructive" : "text-foreground";
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">{icon}{label}</div>
        <div className={`mt-2 text-2xl font-semibold ${toneClass}`}>{value}</div>
        {hint && <div className="mt-1 text-xs text-muted-foreground truncate">{hint}</div>}
      </CardContent>
    </Card>
  );
}

function Field({ label, value, onChange, placeholder, type = "text" }: { label: string; value: unknown; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input type={type} placeholder={placeholder} value={value === undefined || value === null ? "" : String(value)} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function ToggleRow({ label, hint, checked, onChange }: { label: string; hint: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between rounded-md border p-3">
      <div className="pr-3">
        <div className="text-sm font-medium">{label}</div>
        <div className="text-xs text-muted-foreground">{hint}</div>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}