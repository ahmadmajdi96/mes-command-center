import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,OPTIONS",
  "Access-Control-Allow-Headers": "content-type",
};

export const Route = createFileRoute("/api/public/mes/kpi")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      GET: async () => {
        const supabase = createClient<Database>(
          process.env.SUPABASE_URL!,
          process.env.SUPABASE_PUBLISHABLE_KEY!,
          { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
        );
        const [lines, dt, wo, holds] = await Promise.all([
          supabase.from("lines").select("id,status,availability,oee"),
          supabase.from("downtime_events").select("category,duration_min,status"),
          supabase.from("work_orders").select("status,qty_target,qty_produced"),
          supabase.from("quality_holds").select("status,severity"),
        ]);
        const L = lines.data ?? [];
        const D = dt.data ?? [];
        const W = wo.data ?? [];
        const H = holds.data ?? [];
        const pareto = new Map<string, number>();
        for (const d of D) pareto.set(d.category, (pareto.get(d.category) ?? 0) + Number(d.duration_min ?? 0));
        const completed = W.filter((w) => w.status === "completed");
        const onTime = completed.filter((w) => Number(w.qty_produced) / Math.max(1, Number(w.qty_target)) >= 0.98);
        const body = {
          generated_at: new Date().toISOString(),
          uptime_weighted: L.length === 0 ? 0 : Math.round(L.reduce((s, l) => s + (l.status === "running" ? Number(l.availability ?? 0) : 0), 0) / L.length),
          lines: { total: L.length, running: L.filter((l) => l.status === "running").length, down: L.filter((l) => l.status === "down").length },
          downtime_pareto: [...pareto.entries()].map(([category, minutes]) => ({ category, minutes })).sort((a, b) => b.minutes - a.minutes),
          on_time_completion_pct: completed.length === 0 ? 0 : Math.round((onTime.length / completed.length) * 100),
          work_orders: { completed: completed.length, running: W.filter((w) => w.status === "running").length, scheduled: W.filter((w) => w.status === "scheduled").length },
          open_holds: H.filter((h) => h.status === "open").length,
          open_downtime: D.filter((d) => d.status === "open").length,
        };
        return Response.json(body, { headers: CORS });
      },
    },
  },
});
