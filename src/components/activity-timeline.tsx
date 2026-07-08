import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fmtDateTime, labelize } from "@/lib/format";
import { Activity, Boxes, Ticket as TicketIcon, Wrench } from "lucide-react";
import { useMemo } from "react";

interface Entry {
  id: string;
  actor_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string;
  details: Record<string, unknown> | null;
  created_at: string;
}

const ICON: Record<string, typeof Activity> = {
  asset: Boxes,
  ticket: TicketIcon,
  pm_task: Wrench,
};

function describe(e: Entry): string {
  const d = (e.details ?? {}) as Record<string, unknown>;
  if (e.action === "created") {
    if (e.entity_type === "asset") return `Created asset ${d.asset_tag ?? ""}`.trim();
    if (e.entity_type === "ticket") return `Opened ticket: ${d.title ?? ""}`;
    return `Created ${labelize(e.entity_type)}`;
  }
  if (e.action === "updated") {
    const parts: string[] = [];
    for (const [k, v] of Object.entries(d)) {
      if (Array.isArray(v) && v.length === 2) parts.push(`${labelize(k)}: ${labelize(String(v[0] ?? "—"))} → ${labelize(String(v[1] ?? "—"))}`);
    }
    return parts.join(" · ") || "Updated";
  }
  if (e.action === "status_change") {
    const s = d.status as [string, string] | undefined;
    return `${d.title ?? "Task"} — ${labelize(s?.[0] ?? "")} → ${labelize(s?.[1] ?? "")}`;
  }
  return labelize(e.action);
}

export function ActivityTimeline({
  entityType,
  entityId,
  limit = 50,
}: {
  entityType?: string;
  entityId?: string;
  limit?: number;
}) {
  const { data: entries = [], isLoading } = useQuery({
    queryKey: ["activity_log", entityType ?? "*", entityId ?? "*", limit],
    queryFn: async () => {
      let q = supabase.from("activity_log").select("*").order("created_at", { ascending: false }).limit(limit);
      if (entityType) q = q.eq("entity_type", entityType);
      if (entityId) q = q.eq("entity_id", entityId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as Entry[];
    },
  });

  const actorIds = useMemo(() => Array.from(new Set(entries.map((e) => e.actor_id).filter(Boolean))) as string[], [entries]);

  const { data: actors = {} } = useQuery({
    queryKey: ["activity_actors", actorIds],
    enabled: actorIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id, full_name, email").in("id", actorIds);
      const map: Record<string, { full_name: string | null; email: string | null }> = {};
      for (const r of data ?? []) map[r.id] = { full_name: r.full_name, email: r.email };
      return map;
    },
  });

  if (isLoading) return <div className="text-xs text-muted-foreground">Loading activity…</div>;
  if (entries.length === 0) return <div className="text-xs text-muted-foreground italic">No activity yet.</div>;

  return (
    <ol className="relative border-l border-border ml-2 space-y-4">
      {entries.map((e) => {
        const Icon = ICON[e.entity_type] ?? Activity;
        const who = e.actor_id ? (actors[e.actor_id]?.full_name ?? actors[e.actor_id]?.email ?? "Someone") : "System";
        return (
          <li key={e.id} className="ml-4">
            <span className="absolute -left-3 flex h-6 w-6 items-center justify-center rounded-full bg-muted ring-4 ring-background">
              <Icon className="h-3 w-3" />
            </span>
            <div className="text-sm leading-snug">
              <span className="font-medium">{who}</span>{" "}
              <span className="text-muted-foreground">{describe(e)}</span>
            </div>
            <time className="text-[11px] text-muted-foreground">{fmtDateTime(e.created_at)} · {labelize(e.entity_type)}</time>
          </li>
        );
      })}
    </ol>
  );
}