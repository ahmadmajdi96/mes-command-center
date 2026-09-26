import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { QualityHold, Station } from "@/lib/mes-data";
import { CATEGORY_LABEL, type DtRow } from "@/lib/dashboard-metrics";

export type AndonItem = { id: string; level: "critical" | "warn" | "info"; source: string; message: string; at: Date; lineId: string; link: { kind: "line" | "station" | "downtime" | "hold"; id: string } };

export function buildAndon(dt: DtRow[], holds: QualityHold[], stations: Station[], lineIds: Set<string>): AndonItem[] {
  const out: AndonItem[] = [];
  for (const d of dt.filter((x) => x.status === "open")) {
    out.push({ id: `dt-${d.id}`, level: d.category === "equipment_failure" ? "critical" : "warn", source: `${d.lineId} · ${d.stationId ?? d.lineName}`, message: `${d.reason} — ${CATEGORY_LABEL[d.category] ?? d.category}, ${d.durationMin} min`, at: d.at, lineId: d.lineId, link: { kind: "downtime", id: d.id } });
  }
  for (const h of holds.filter((x) => x.status === "open" && lineIds.has(x.lineId))) {
    const at = new Date(h.raisedAt);
    out.push({ id: `qh-${h.id}`, level: h.severity === "high" ? "critical" : "warn", source: `${h.lineId} · Quality hold`, message: `${h.reason} (lot ${h.lotId})`, at: isNaN(at.getTime()) ? new Date() : at, lineId: h.lineId, link: { kind: "hold", id: h.id } });
  }
  for (const s of stations.filter((x) => x.status === "down" || x.status === "maintenance")) {
    out.push({ id: `st-${s.id}`, level: s.status === "down" ? "critical" : "info", source: `${s.lineId} · ${s.name}`, message: `Station ${s.status}${s.currentStep ? ` at step ${s.currentStep}` : ""}`, at: new Date(), lineId: s.lineId, link: { kind: "station", id: s.id } });
  }
  return out.sort((a, b) => b.at.getTime() - a.at.getTime());
}

export type Reading = { id: string; machine_id: string; tag: string; value: number | null; unit: string | null; in_limits: boolean | null; created_at: string; station_id: string | null };

/** Machine readings for the selected window (real data from the machines feed). */
export function useReadings(sinceMs: number) {
  const since = new Date(sinceMs - (sinceMs % 60000)).toISOString();
  return useQuery({
    queryKey: ["dash-readings", since],
    refetchInterval: 15000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("machine_readings")
        .select("id,machine_id,tag,value,unit,in_limits,created_at,station_id")
        .gte("created_at", since)
        .order("created_at", { ascending: true })
        .limit(5000);
      if (error) throw error;
      return (data ?? []) as Reading[];
    },
  });
}

export function readingSources(rows: Reading[]) {
  const m = new Map<string, { key: string; machine: string; tag: string; unit: string; count: number; isTemp: boolean }>();
  for (const r of rows) {
    const key = `${r.machine_id}|${r.tag}`;
    const cur = m.get(key) ?? { key, machine: r.machine_id, tag: r.tag, unit: r.unit ?? "", count: 0, isTemp: /°c|degc|temp/i.test(`${r.unit} ${r.tag}`) };
    cur.count++; m.set(key, cur);
  }
  return [...m.values()].sort((a, b) => Number(b.isTemp) - Number(a.isTemp) || b.count - a.count);
}
