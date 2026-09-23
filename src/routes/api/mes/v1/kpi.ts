import { createFileRoute } from "@tanstack/react-router";
import { authorizeApi, corsHeaders, serviceClient } from "@/lib/mes/api-guard.server";

export const Route = createFileRoute("/api/mes/v1/kpi")({
  server: {
    handlers: {
      OPTIONS: async ({ request }) => new Response(null, { status: 204, headers: corsHeaders(request) }),
      GET: async ({ request }) => {
        const auth = await authorizeApi(request);
        if ("denied" in auth) return auth.denied;
        const org = auth.caller.organizationId;
        const headers = corsHeaders(request);
        const supabase = serviceClient();

        const [lines, dt, wo, holds] = await Promise.all([
          supabase.from("lines").select("id,status,availability,oee"),
          supabase.from("downtime_events").select("category,duration_min,status"),
          supabase.from("work_orders").select("status,qty_target,qty_produced,ends_at"),
          supabase.from("quality_holds").select("status,severity"),
        ]);
        const L = lines.data ?? [];
        const D = dt.data ?? [];
        const W = wo.data ?? [];
        const H = holds.data ?? [];

        const pareto = new Map<string, number>();
        for (const d of D) pareto.set(d.category, (pareto.get(d.category) ?? 0) + Number(d.duration_min ?? 0));

        const completed = W.filter((w) => w.status === "completed");
        const attained = completed.filter(
          (w) => Number(w.qty_produced) / Math.max(1, Number(w.qty_target)) >= 0.98,
        );
        const withDueDate = completed.filter((w) => !!w.ends_at);
        const onTime = withDueDate.filter((w) => new Date(w.ends_at as string).getTime() >= Date.now());

        return Response.json(
          {
            generated_at: new Date().toISOString(),
            definitions: {
              availability_snapshot_pct: "Mean availability of running lines at this instant — not time-based OEE",
              quantity_attainment_pct: "Completed orders reaching at least 98% of target quantity",
              schedule_adherence_pct: "Completed orders finished on or before their due date",
            },
            availability_snapshot_pct:
              L.length === 0
                ? 0
                : Math.round(
                    L.reduce((s, l) => s + (l.status === "running" ? Number(l.availability ?? 0) : 0), 0) /
                      L.length,
                  ),
            lines: {
              total: L.length,
              running: L.filter((l) => l.status === "running").length,
              down: L.filter((l) => l.status === "down").length,
            },
            downtime_pareto: [...pareto.entries()]
              .map(([category, minutes]) => ({ category, minutes }))
              .sort((a, b) => b.minutes - a.minutes),
            quantity_attainment_pct:
              completed.length === 0 ? 0 : Math.round((attained.length / completed.length) * 100),
            schedule_adherence_pct:
              withDueDate.length === 0 ? null : Math.round((onTime.length / withDueDate.length) * 100),
            work_orders: {
              completed: completed.length,
              running: W.filter((w) => w.status === "running").length,
              scheduled: W.filter((w) => w.status === "scheduled").length,
            },
            open_holds: H.filter((h) => h.status === "open").length,
            open_downtime: D.filter((d) => d.status === "open").length,
          },
          { headers },
        );
      },
    },
  },
});
