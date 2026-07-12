import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export type ParetoBucket = {
  category: string;
  label: string;
  minutes: number;
};

export type KpiSummary = {
  seeded: boolean;
  uptimeWeighted: number;
  linesRunning: number;
  linesDown: number;
  linesIdleOrChangeover: number;
  linesTotal: number;
  pareto: ParetoBucket[];
  paretoTotalMinutes: number;
  onTimeCompletionPct: number;
  completedCount: number;
  onTimeCount: number;
  runningCount: number;
  scheduledCount: number;
  openHoldsCount: number;
  openDowntimeCount: number;
};

const CATEGORY_LABEL: Record<string, string> = {
  equipment_failure: "Equipment failure",
  changeover: "Changeover",
  material_shortage: "Material shortage",
  quality_hold: "Quality hold",
  operator_break: "Operator break",
};

/**
 * Public read-only KPI summary computed off the DB.
 * Reads via the publishable key (RLS as anon). If no data has been seeded yet,
 * returns `seeded: false` so the UI can gracefully fall back to the in-memory store.
 */
export const getKpiSummary = createServerFn({ method: "GET" }).handler(async () => {
  const supabase = createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
  );

  const [linesRes, dtRes, woRes, holdsRes] = await Promise.all([
    supabase.from("lines").select("id,status,availability"),
    supabase.from("downtime_events").select("category,duration_min,status"),
    supabase.from("work_orders").select("status,qty_target,qty_produced"),
    supabase.from("quality_holds").select("status"),
  ]);

  const lines = linesRes.data ?? [];
  const dt = dtRes.data ?? [];
  const wo = woRes.data ?? [];
  const holds = holdsRes.data ?? [];

  const seeded = lines.length > 0 || wo.length > 0;

  const running = lines.filter((l) => l.status === "running");
  const uptimeWeighted =
    lines.length === 0
      ? 0
      : Math.round(
          lines.reduce((s, l) => s + (l.status === "running" ? Number(l.availability ?? 0) : 0), 0) /
            lines.length,
        );

  const paretoMap = new Map<string, number>();
  for (const d of dt) {
    const c = d.category as string;
    paretoMap.set(c, (paretoMap.get(c) ?? 0) + Number(d.duration_min ?? 0));
  }
  const pareto: ParetoBucket[] = [...paretoMap.entries()]
    .map(([category, minutes]) => ({
      category,
      label: CATEGORY_LABEL[category] ?? category,
      minutes,
    }))
    .sort((a, b) => b.minutes - a.minutes);
  const paretoTotalMinutes = pareto.reduce((s, p) => s + p.minutes, 0);

  const completed = wo.filter((w) => w.status === "completed");
  const onTime = completed.filter(
    (w) => Number(w.qty_produced ?? 0) / Math.max(1, Number(w.qty_target ?? 1)) >= 0.98,
  );
  const onTimeCompletionPct =
    completed.length === 0 ? 0 : Math.round((onTime.length / completed.length) * 100);

  const summary: KpiSummary = {
    seeded,
    uptimeWeighted,
    linesRunning: running.length,
    linesDown: lines.filter((l) => l.status === "down").length,
    linesIdleOrChangeover: lines.filter((l) => l.status === "idle" || l.status === "changeover").length,
    linesTotal: lines.length,
    pareto,
    paretoTotalMinutes,
    onTimeCompletionPct,
    completedCount: completed.length,
    onTimeCount: onTime.length,
    runningCount: wo.filter((w) => w.status === "running").length,
    scheduledCount: wo.filter((w) => w.status === "scheduled").length,
    openHoldsCount: holds.filter((h) => h.status === "open").length,
    openDowntimeCount: dt.filter((d) => d.status === "open").length,
  };

  return summary;
});
