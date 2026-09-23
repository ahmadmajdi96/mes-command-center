import { createFileRoute } from "@tanstack/react-router";
import { serviceClient } from "@/lib/mes/api-guard.server";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,OPTIONS",
  "Access-Control-Allow-Headers": "content-type",
  "Cache-Control": "public, max-age=60",
};

/**
 * Deliberately minimal public projection: aggregate counts only, no records,
 * no identifiers, no people. Everything record-level lives behind /api/mes/v1.
 */
export const Route = createFileRoute("/api/public/mes/summary")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      GET: async () => {
        const supabase = serviceClient();
        const [lines, holds, downtime] = await Promise.all([
          supabase.from("lines").select("status"),
          supabase.from("quality_holds").select("status"),
          supabase.from("downtime_events").select("status"),
        ]);
        const L = lines.data ?? [];
        return Response.json(
          {
            generated_at: new Date().toISOString(),
            lines_total: L.length,
            lines_running: L.filter((l) => l.status === "running").length,
            open_quality_holds: (holds.data ?? []).filter((h) => h.status === "open").length,
            open_downtime_events: (downtime.data ?? []).filter((d) => d.status === "open").length,
          },
          { headers: CORS },
        );
      },
    },
  },
});
