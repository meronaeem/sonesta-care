import { createFileRoute } from "@tanstack/react-router";

/**
 * Scheduled Active Directory synchronization.
 * Call with: Authorization: Bearer <AD_SYNC_TOKEN>
 */
export const Route = createFileRoute("/api/public/hooks/ad-sync")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expected = process.env["AD_SYNC_TOKEN"] ?? process.env["AD_BRIDGE_TOKEN"];
        const provided = (request.headers.get("authorization") ?? "").replace("Bearer ", "");
        if (!expected || !provided || provided !== expected) {
          return new Response("Unauthorized", { status: 401 });
        }
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { runAdSync, loadAdConfig } = await import("@/lib/ad.server");
        const cfg = await loadAdConfig(supabaseAdmin);
        if (!cfg.enabled) {
          return Response.json({ skipped: true, reason: "Active Directory integration disabled" });
        }
        const result = await runAdSync(supabaseAdmin, { source: "scheduled" });
        return Response.json(result);
      },
    },
  },
});