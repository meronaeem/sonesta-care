import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Barcode, Camera, X, Search, Save, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { labelize, fmtDate } from "@/lib/format";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/tech")({
  head: () => ({ meta: [{ title: "Technician Mode • Hotel IT Ops" }] }),
  component: TechPage,
});

const ASSET_STATUSES = ["in_use", "in_stock", "in_repair", "retired", "lost", "disposed"];
const TICKET_PRIORITIES = ["low", "medium", "high", "critical"];

type Asset = {
  id: string;
  asset_tag: string;
  asset_type: string;
  status: string;
  manufacturer: string | null;
  model: string | null;
  serial_number: string | null;
  hostname: string | null;
  ip_address: string | null;
  warranty_end: string | null;
  location_id: string | null;
  notes: string | null;
};

type Location = { id: string; building: string; floor: string | null; room: string | null };

const locLabel = (l: Location) =>
  [l.building, l.floor, l.room].filter(Boolean).join(" · ");

function parseTag(raw: string): string {
  const s = raw.trim();
  try {
    const u = new URL(s);
    const t = u.searchParams.get("tag") || u.searchParams.get("asset");
    if (t) return t;
    const parts = u.pathname.split("/").filter(Boolean);
    if (parts.length) return parts[parts.length - 1];
  } catch {
    // not a URL
  }
  return s;
}

function TechPage() {
  const { isIT } = useAuth();
  const [scanning, setScanning] = useState(false);
  const [manual, setManual] = useState("");
  const [asset, setAsset] = useState<Asset | null>(null);
  const [loading, setLoading] = useState(false);
  const [locations, setLocations] = useState<Location[]>([]);
  const [status, setStatus] = useState<string>("");
  const [locationId, setLocationId] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [ticketOpen, setTicketOpen] = useState(false);
  const [ticketTitle, setTicketTitle] = useState("");
  const [ticketDesc, setTicketDesc] = useState("");
  const [ticketPriority, setTicketPriority] = useState("medium");
  const [creatingTicket, setCreatingTicket] = useState(false);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const scannerDivId = "tech-barcode-reader";

  useEffect(() => {
    void (async () => {
      const { data } = await supabase.from("locations").select("id,building,floor,room").order("building");
      setLocations((data as Location[]) || []);
    })();
  }, []);

  useEffect(() => {
    return () => {
      const s = scannerRef.current;
      if (s) {
        s.stop().catch(() => {}).finally(() => s.clear());
      }
    };
  }, []);

  const lookup = async (rawTag: string) => {
    const tag = parseTag(rawTag);
    if (!tag) return;
    setLoading(true);
    setAsset(null);
    const { data, error } = await supabase
      .from("assets")
      .select("*")
      .eq("asset_tag", tag)
      .maybeSingle();
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    if (!data) {
      toast.error(`No asset found for "${tag}"`);
      return;
    }
    const a = data as Asset;
    setAsset(a);
    setStatus(a.status);
    setLocationId(a.location_id ?? "");
    setNotes(a.notes ?? "");
  };

  const startScan = async () => {
    setScanning(true);
    // wait a tick for div to mount
    await new Promise((r) => setTimeout(r, 50));
    try {
      const inst = new Html5Qrcode(scannerDivId, {
        verbose: false,
        formatsToSupport: [
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.CODE_93,
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.UPC_E,
          Html5QrcodeSupportedFormats.ITF,
          Html5QrcodeSupportedFormats.CODABAR,
          Html5QrcodeSupportedFormats.QR_CODE,
        ],
      });
      scannerRef.current = inst;
      await inst.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 280, height: 120 }, aspectRatio: 1.7778 },
        async (decoded) => {
          await inst.stop().catch(() => {});
          inst.clear();
          scannerRef.current = null;
          setScanning(false);
          void lookup(decoded);
        },
        () => {},
      );
    } catch (e) {
      setScanning(false);
      toast.error(`Camera error: ${(e as Error).message}`);
    }
  };

  const stopScan = async () => {
    const s = scannerRef.current;
    if (s) {
      await s.stop().catch(() => {});
      s.clear();
      scannerRef.current = null;
    }
    setScanning(false);
  };

  const save = async () => {
    if (!asset) return;
    setSaving(true);
    const payload: Record<string, unknown> = {
      status,
      location_id: locationId || null,
      notes: notes || null,
    };
    const { error } = await supabase.from("assets").update(payload as never).eq("id", asset.id);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Asset updated");
    setAsset({ ...asset, ...payload } as Asset);
  };

  const createTicket = async () => {
    if (!asset || !ticketTitle.trim()) return;
    setCreatingTicket(true);
    const { data: userData } = await supabase.auth.getUser();
    const payload = {
      title: ticketTitle.trim(),
      description: ticketDesc || null,
      priority: ticketPriority,
      asset_id: asset.id,
      reporter_id: userData.user?.id,
    };
    const { error } = await supabase.from("tickets").insert(payload as never);
    setCreatingTicket(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Ticket created");
    setTicketOpen(false);
    setTicketTitle("");
    setTicketDesc("");
    setTicketPriority("medium");
  };

  return (
    <div className="max-w-lg mx-auto space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Barcode className="h-6 w-6" /> Technician Mode
        </h1>
        <p className="text-sm text-muted-foreground">Scan an asset barcode to view or update on-site.</p>
      </div>

      <Card>
        <CardContent className="pt-6 space-y-3">
          {scanning ? (
            <div className="space-y-3">
              <div id={scannerDivId} className="w-full overflow-hidden rounded-md bg-black" />
              <Button variant="outline" className="w-full h-12" onClick={stopScan}>
                <X className="h-4 w-4 mr-2" /> Stop scanning
              </Button>
            </div>
          ) : (
            <Button className="w-full h-14 text-base" onClick={startScan}>
              <Camera className="h-5 w-5 mr-2" /> Scan barcode
            </Button>
          )}
          <div className="flex items-center gap-2">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs text-muted-foreground">or</span>
            <div className="h-px flex-1 bg-border" />
          </div>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void lookup(manual);
            }}
          >
            <Input
              placeholder="Enter asset tag"
              value={manual}
              onChange={(e) => setManual(e.target.value)}
              className="h-12 text-base"
              autoCapitalize="characters"
            />
            <Button type="submit" size="lg" className="h-12" disabled={loading || !manual.trim()}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            </Button>
          </form>
        </CardContent>
      </Card>

      {asset && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-base">{asset.asset_tag}</span>
              <Badge variant="secondary">{labelize(asset.asset_type)}</Badge>
              <Badge>{labelize(asset.status)}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <dl className="text-sm space-y-1.5">
              <Row k="Make/Model" v={`${asset.manufacturer ?? "—"} ${asset.model ?? ""}`.trim()} />
              <Row k="Serial" v={asset.serial_number} />
              <Row k="Hostname" v={asset.hostname} />
              <Row k="IP" v={asset.ip_address} />
              <Row k="Warranty" v={fmtDate(asset.warranty_end)} />
            </dl>

            {isIT && (
              <div className="space-y-3 pt-2 border-t">
                <div>
                  <Label>Status</Label>
                  <Select value={status} onValueChange={setStatus}>
                    <SelectTrigger className="h-12"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ASSET_STATUSES.map((s) => <SelectItem key={s} value={s}>{labelize(s)}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Location</Label>
                  <Select value={locationId || "__none"} onValueChange={(v) => setLocationId(v === "__none" ? "" : v)}>
                    <SelectTrigger className="h-12"><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none">— None —</SelectItem>
                      {locations.map((l) => <SelectItem key={l.id} value={l.id}>{locLabel(l)}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Notes</Label>
                  <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
                </div>
                <Button onClick={save} disabled={saving} className="w-full h-12">
                  {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                  Save changes
                </Button>
                {!ticketOpen ? (
                  <Button variant="outline" className="w-full h-12" onClick={() => setTicketOpen(true)}>
                    Report an issue
                  </Button>
                ) : (
                  <div className="space-y-2 rounded-md border p-3">
                    <div className="text-sm font-medium">New ticket for this asset</div>
                    <Input
                      placeholder="Title"
                      value={ticketTitle}
                      onChange={(e) => setTicketTitle(e.target.value)}
                      className="h-11"
                    />
                    <Textarea
                      placeholder="Describe the issue"
                      value={ticketDesc}
                      onChange={(e) => setTicketDesc(e.target.value)}
                      rows={3}
                    />
                    <Select value={ticketPriority} onValueChange={setTicketPriority}>
                      <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {TICKET_PRIORITIES.map((p) => <SelectItem key={p} value={p}>{labelize(p)}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <div className="flex gap-2">
                      <Button variant="outline" className="flex-1 h-11" onClick={() => setTicketOpen(false)}>
                        Cancel
                      </Button>
                      <Button className="flex-1 h-11" onClick={createTicket} disabled={creatingTicket || !ticketTitle.trim()}>
                        {creatingTicket ? "Creating…" : "Create ticket"}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Row({ k, v }: { k: string; v: string | null | undefined }) {
  return (
    <div className="flex gap-2">
      <dt className="w-24 text-muted-foreground shrink-0">{k}</dt>
      <dd className="flex-1">{v || "—"}</dd>
    </div>
  );
}