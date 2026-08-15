import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { BedDouble, Pencil, Plus } from "lucide-react";
import { toast } from "sonner";

export interface BriefingRooms {
  id: string;
  briefing_id: string;
  occupancy_today: number;
  occupancy_rate_today: number;
  breakfast_pax_tomorrow: number;
  duty_manager_id: string | null;
  vip0_rooms: number;
  vip1_rooms: number;
  vip2_rooms: number;
  vip3_rooms: number;
  occupancy_mtd: number;
}

export interface RoomsPerson { id: string; full_name: string | null; email: string | null; department_id: string | null }

export function useBriefingRooms(briefingId: string) {
  return useQuery({
    queryKey: ["briefing_rooms", briefingId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("briefing_rooms")
        .select("*")
        .eq("briefing_id", briefingId)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as unknown as BriefingRooms | null;
    },
  });
}

export const pct = (n: number | null | undefined) => Number(n ?? 0).toFixed(2);

export function BriefingRoomsSection({
  briefingId, rooms, people, canEdit,
}: {
  briefingId: string;
  rooms: BriefingRooms | null;
  people: RoomsPerson[];
  canEdit: boolean;
}) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const nameOf = (uid: string | null) => {
    const p = people.find((x) => x.id === uid);
    return p ? (p.full_name ?? p.email ?? "—") : "—";
  };

  const save = useMutation({
    mutationFn: async (values: Record<string, unknown>) => {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id ?? null;
      if (rooms) {
        const { error } = await supabase.from("briefing_rooms").update({ ...values, updated_by: uid } as never).eq("id", rooms.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("briefing_rooms")
          .insert({ ...values, briefing_id: briefingId, created_by: uid, updated_by: uid } as never);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["briefing_rooms", briefingId] });
      toast.success("Rooms information saved");
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2"><BedDouble className="h-5 w-5" />Rooms</CardTitle>
          <CardDescription>Hotel room &amp; occupancy status for this briefing</CardDescription>
        </div>
        {canEdit && (
          <Button size="sm" variant={rooms ? "outline" : "default"} onClick={() => setOpen(true)}>
            {rooms ? <><Pencil className="h-4 w-4 mr-2" />Edit Rooms</> : <><Plus className="h-4 w-4 mr-2" />Rooms</>}
          </Button>
        )}
      </CardHeader>
      <CardContent className="text-sm">
        {!rooms ? (
          <p className="text-muted-foreground">No rooms information recorded for this briefing yet.</p>
        ) : (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Stat label="Total Occupancy Today" value={`${rooms.occupancy_today} rooms`} hint="excluding House Use &amp; Complimentary" />
              <Stat label="Total Occupancy Rate" value={`${pct(rooms.occupancy_rate_today)} %`} />
              <Stat label="Tomorrow Breakfast" value={`${rooms.breakfast_pax_tomorrow} pax`} />
              <Stat label="Duty Manager Today" value={nameOf(rooms.duty_manager_id)} />
            </div>
            <Separator />
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              <Stat label="VIP0" value={`${rooms.vip0_rooms} rooms`} />
              <Stat label="VIP1" value={`${rooms.vip1_rooms} rooms`} />
              <Stat label="VIP2" value={`${rooms.vip2_rooms} rooms`} />
              <Stat label="VIP3" value={`${rooms.vip3_rooms} rooms`} />
              <Stat label="Occ MTD" value={`${pct(rooms.occupancy_mtd)} %`} />
            </div>
          </div>
        )}
      </CardContent>

      {open && (
        <Dialog open onOpenChange={(o) => !o && setOpen(false)}>
          <RoomsDialog rooms={rooms} people={people} pending={save.isPending} onSubmit={(v) => save.mutate(v)} />
        </Dialog>
      )}
    </Card>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border bg-muted/30 p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold">{value}</div>
      {hint && <div className="text-[11px] text-muted-foreground">({hint})</div>}
    </div>
  );
}

function RoomsDialog({
  rooms, people, pending, onSubmit,
}: {
  rooms: BriefingRooms | null;
  people: RoomsPerson[];
  pending: boolean;
  onSubmit: (values: Record<string, unknown>) => void;
}) {
  const [duty, setDuty] = useState(rooms?.duty_manager_id ?? "");

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const num = (k: string) => Number(f.get(k) ?? 0);
    const values = {
      occupancy_today: num("occupancy_today"),
      occupancy_rate_today: num("occupancy_rate_today"),
      breakfast_pax_tomorrow: num("breakfast_pax_tomorrow"),
      duty_manager_id: duty || null,
      vip0_rooms: num("vip0_rooms"),
      vip1_rooms: num("vip1_rooms"),
      vip2_rooms: num("vip2_rooms"),
      vip3_rooms: num("vip3_rooms"),
      occupancy_mtd: num("occupancy_mtd"),
    };
    const counts = ["occupancy_today", "breakfast_pax_tomorrow", "vip0_rooms", "vip1_rooms", "vip2_rooms", "vip3_rooms"] as const;
    if (counts.some((k) => !Number.isFinite(values[k]) || values[k] < 0)) return toast.error("Room and pax counts cannot be negative");
    if (values.occupancy_rate_today < 0 || values.occupancy_rate_today > 100) return toast.error("Occupancy rate must be between 0 and 100");
    if (values.occupancy_mtd < 0 || values.occupancy_mtd > 100) return toast.error("Occupancy MTD must be between 0 and 100");
    onSubmit(values);
  };

  return (
    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>Rooms / Hotel Status</DialogTitle>
      </DialogHeader>
      <form onSubmit={submit} className="space-y-5">
        <section className="space-y-3">
          <h4 className="text-sm font-semibold">Occupancy Today</h4>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="occupancy_today">Total Occupancy Today (rooms)</Label>
              <Input id="occupancy_today" name="occupancy_today" type="number" min={0} step={1} defaultValue={rooms?.occupancy_today ?? 0} />
              <p className="text-[11px] text-muted-foreground">Excluding House Use &amp; Complimentary rooms.</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="occupancy_rate_today">Total Occupancy Rate (%)</Label>
              <Input id="occupancy_rate_today" name="occupancy_rate_today" type="number" min={0} max={100} step="0.01" defaultValue={rooms?.occupancy_rate_today ?? 0} />
            </div>
          </div>
        </section>

        <section className="space-y-3">
          <h4 className="text-sm font-semibold">Breakfast</h4>
          <div className="space-y-1.5 sm:w-1/2">
            <Label htmlFor="breakfast_pax_tomorrow">Tomorrow Breakfast (pax)</Label>
            <Input id="breakfast_pax_tomorrow" name="breakfast_pax_tomorrow" type="number" min={0} step={1} defaultValue={rooms?.breakfast_pax_tomorrow ?? 0} />
          </div>
        </section>

        <section className="space-y-3">
          <h4 className="text-sm font-semibold">Duty Manager</h4>
          <div className="space-y-1.5 sm:w-1/2">
            <Label>Duty Manager Today</Label>
            <Select value={duty} onValueChange={setDuty}>
              <SelectTrigger><SelectValue placeholder="Select employee" /></SelectTrigger>
              <SelectContent>
                {people.map((p) => <SelectItem key={p.id} value={p.id}>{p.full_name ?? p.email}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </section>

        <section className="space-y-3">
          <h4 className="text-sm font-semibold">VIP Rooms</h4>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {([0, 1, 2, 3] as const).map((i) => (
              <div key={i} className="space-y-1.5">
                <Label htmlFor={`vip${i}_rooms`}>{`VIP${i} (rooms)`}</Label>
                <Input
                  id={`vip${i}_rooms`}
                  name={`vip${i}_rooms`}
                  type="number"
                  min={0}
                  step={1}
                  defaultValue={(rooms?.[`vip${i}_rooms` as keyof BriefingRooms] as number | undefined) ?? 0}
                />
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-3">
          <h4 className="text-sm font-semibold">Month to Date</h4>
          <div className="space-y-1.5 sm:w-1/2">
            <Label htmlFor="occupancy_mtd">Occupancy MTD (%)</Label>
            <Input id="occupancy_mtd" name="occupancy_mtd" type="number" min={0} max={100} step="0.01" defaultValue={rooms?.occupancy_mtd ?? 0} />
          </div>
        </section>

        <DialogFooter>
          <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save Rooms Information"}</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
