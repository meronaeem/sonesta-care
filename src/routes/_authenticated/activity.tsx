import { createFileRoute } from "@tanstack/react-router";
import { ActivityTimeline } from "@/components/activity-timeline";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

export const Route = createFileRoute("/_authenticated/activity")({
  head: () => ({ meta: [{ title: "Activity Feed • Hotel IT Ops" }] }),
  component: ActivityPage,
});

function ActivityPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Activity Feed</h1>
        <p className="text-sm text-muted-foreground">Recent changes across assets, tickets, and preventive maintenance.</p>
      </div>
      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="asset">Assets</TabsTrigger>
          <TabsTrigger value="ticket">Tickets</TabsTrigger>
          <TabsTrigger value="pm_task">PM Tasks</TabsTrigger>
        </TabsList>
        {["all", "asset", "ticket", "pm_task"].map((t) => (
          <TabsContent key={t} value={t} className="mt-4">
            <Card><CardContent className="pt-6">
              <ActivityTimeline entityType={t === "all" ? undefined : t} limit={100} />
            </CardContent></Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}