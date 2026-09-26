// Shared filters + metric calculations for the Control Center and its drill-down pages.
// All numbers are derived from live app data (lines, stations, downtime, audit history, holds).
import { useEffect, useState } from "react";
import type { AuditEntry, DowntimeEvent, ProductionLine, Station } from "@/lib/mes-data";

export type ShiftCode = "A" | "B" | "C";
export const SHIFT_WINDOWS: Record<ShiftCode, { label: string; start: number; end: number }> = {
  A: { label: "Shift A · 06:00–14:00", start: 6, end: 14 },
  B: { label: "Shift B · 14:00–22:00", start: 14, end: 22 },
  C: { label: "Shift C · 22:00–06:00", start: 22, end: 6 },
};

export function shiftOfHour(h: number): ShiftCode {
  if (h >= 6 && h < 14) return "A";
  if (h >= 14 && h < 22) return "B";
  return "C";
}

// ISA-95 / OEE reporting intervals commonly used on the shop floor
export const INTERVALS = [
  { key: "1h", label: "Last hour", hours: 1, bucketMin: 5 },
  { key: "shift", label: "Current shift (8h)", hours: 8, bucketMin: 30 },
  { key: "12h", label: "Last 12 hours", hours: 12, bucketMin: 60 },
  { key: "24h", label: "Last 24 hours (day)", hours: 24, bucketMin: 60 },
  { key: "7d", label: "Last 7 days (week)", hours: 168, bucketMin: 1440 },
  { key: "30d", label: "Last 30 days (month)", hours: 720, bucketMin: 1440 },
  { key: "90d", label: "Last 90 days (quarter)", hours: 2160, bucketMin: 10080 },
] as const;
export type IntervalKey = (typeof INTERVALS)[number]["key"];

export type DashFilters = { plant: string; shift: "all" | ShiftCode; interval: IntervalKey; lineId: string; stationId: string };
const DEFAULT: DashFilters = { plant: "all", shift: "all", interval: "12h", lineId: "all", stationId: "all" };
const KEY = "cortanex-dash-filters";

export function useDashFilters() {
  const [f, setF] = useState<DashFilters>(DEFAULT);
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(KEY);
      if (raw) setF({ ...DEFAULT, ...JSON.parse(raw) });
    } catch { /* ignore */ }
  }, []);
  const update = (p: Partial<DashFilters>) =>
    setF((cur) => {
      const next = { ...cur, ...p };
      try { sessionStorage.setItem(KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  return [f, update] as const;
}

export const CATEGORY_LABEL: Record<string, string> = {
  equipment_failure: "Equipment failure",
  changeover: "Changeover",
  material_shortage: "Material shortage",
  quality_hold: "Quality hold",
  operator_break: "Operator break",
  planned: "Planned stop",
};
export const CATEGORY_COLOR: Record<string, string> = {
  equipment_failure: "var(--color-destructive)",
  changeover: "var(--color-accent)",
  material_shortage: "var(--color-warning)",
  quality_hold: "var(--color-info)",
  operator_break: "var(--color-muted-foreground)",
  planned: "var(--color-primary)",
};

export type DtRow = {
  id: string; at: Date; lineId: string; lineName: string; stationId?: string; reason: string;
  category: string; durationMin: number; status: string; operatorName?: string; shift: ShiftCode;
};

function parseAt(s: string): Date {
  if (/^\d{1,2}:\d{2}$/.test(s)) {
    const [h, m] = s.split(":").map(Number);
    const d = new Date(); d.setHours(h, m, 0, 0);
    if (d.getTime() > Date.now()) d.setDate(d.getDate() - 1);
    return d;
  }
  const d = new Date(s);
  return isNaN(d.getTime()) ? new Date() : d;
}

/** Live events + 3-month history from the audit trail, de-duplicated by id. */
export function allDowntime(live: DowntimeEvent[], audit: AuditEntry[], lines: ProductionLine[]): DtRow[] {
  const map = new Map<string, DtRow>();
  const lineName = (id: string) => lines.find((l) => l.id === id)?.name ?? id;
  const resolved = new Set(audit.filter((a) => a.entity === "downtime" && a.action === "update" && a.after?.status === "resolved").map((a) => a.entityId));
  for (const a of audit) {
    if (a.entity !== "downtime" || a.action !== "create" || !a.after) continue;
    const at = new Date(a.at);
    const x = a.after;
    map.set(a.entityId, {
      id: a.entityId, at, lineId: x.lineId, lineName: lineName(x.lineId), stationId: x.stationId,
      reason: x.reasonCode ?? "—", category: x.category ?? "equipment_failure", durationMin: Number(x.durationMin ?? 0),
      status: resolved.has(a.entityId) ? "resolved" : (x.status ?? "open"), operatorName: x.operatorName, shift: shiftOfHour(at.getHours()),
    });
  }
  for (const d of live) {
    const at = parseAt(d.startedAt);
    map.set(d.id, {
      id: d.id, at, lineId: d.lineId, lineName: d.lineName, stationId: d.stationId, reason: d.reasonCode,
      category: d.category, durationMin: d.durationMin, status: d.status, operatorName: d.operatorName, shift: shiftOfHour(at.getHours()),
    });
  }
  return [...map.values()].sort((a, b) => b.at.getTime() - a.at.getTime());
}

export function intervalOf(key: IntervalKey) {
  return INTERVALS.find((i) => i.key === key) ?? INTERVALS[2];
}

export function scope(
  f: DashFilters,
  data: { lines: ProductionLine[]; stations: Station[]; downtime: DtRow[] },
) {
  const lines = data.lines.filter((l) => (f.plant === "all" || l.plant === f.plant) && (f.lineId === "all" || l.id === f.lineId));
  const lineIds = new Set(lines.map((l) => l.id));
  const stations = data.stations.filter((s) => lineIds.has(s.lineId) && (f.stationId === "all" || s.id === f.stationId));
  const iv = intervalOf(f.interval);
  const since = Date.now() - iv.hours * 3600_000;
  const downtime = data.downtime.filter(
    (d) => lineIds.has(d.lineId) && d.at.getTime() >= since && (f.shift === "all" || d.shift === f.shift) &&
      (f.stationId === "all" || d.stationId === f.stationId),
  );
  return { lines, stations, downtime, iv, since };
}

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

/** Planned minutes covered by the selected shift inside a window. */
function plannedMinutes(from: number, to: number, shift: "all" | ShiftCode) {
  if (shift === "all") return (to - from) / 60000;
  let mins = 0;
  for (let t = from; t < to; t += 60000 * 15) if (shiftOfHour(new Date(t).getHours()) === shift) mins += 15;
  return mins;
}

export type OeeBreakdown = { oee: number; availability: number; performance: number; quality: number; downMin: number; plannedMin: number };

export function computeOee(
  f: DashFilters,
  s: ReturnType<typeof scope>,
  from = s.since,
  to = Date.now(),
): OeeBreakdown {
  const units = f.stationId !== "all" ? Math.max(1, s.stations.length) : Math.max(1, s.lines.length);
  const planned = plannedMinutes(from, to, f.shift) * units;
  const downMin = s.downtime.filter((d) => d.at.getTime() >= from && d.at.getTime() < to).reduce((a, d) => a + d.durationMin, 0);
  const availability = planned > 0 ? Math.max(0, Math.min(100, 100 * (1 - downMin / planned))) : 0;
  const active = s.lines.filter((l) => l.performance > 0);
  let performance = avg(active.map((l) => l.performance));
  let quality = avg(active.map((l) => l.quality));
  if (f.stationId !== "all") {
    const st = s.stations[0];
    if (st?.oee != null && availability > 0) performance = Math.min(100, (st.oee / (availability / 100) / (quality / 100 || 1)));
  }
  if (!active.length) { performance = 0; quality = 0; }
  const oee = (availability * performance * quality) / 10000;
  return { oee: round1(oee), availability: round1(availability), performance: round1(performance), quality: round1(quality), downMin, plannedMin: Math.round(planned) };
}

export function oeeTrendSeries(f: DashFilters, s: ReturnType<typeof scope>) {
  const bucket = s.iv.bucketMin * 60000;
  const out: Array<OeeBreakdown & { label: string }> = [];
  const now = Date.now();
  const start = now - s.iv.hours * 3600_000;
  for (let t = start; t < now; t += bucket) {
    const b = computeOee(f, s, t, Math.min(now, t + bucket));
    if (b.plannedMin === 0) continue;
    const d = new Date(t);
    const label = s.iv.bucketMin >= 1440
      ? d.toLocaleDateString([], { month: "short", day: "numeric" })
      : d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    out.push({ ...b, label });
  }
  return out;
}

export function paretoOf(rows: DtRow[]) {
  const m = new Map<string, { category: string; name: string; minutes: number; count: number }>();
  for (const r of rows) {
    const k = r.category;
    const cur = m.get(k) ?? { category: k, name: CATEGORY_LABEL[k] ?? k, minutes: 0, count: 0 };
    cur.minutes += r.durationMin; cur.count += 1; m.set(k, cur);
  }
  const list = [...m.values()].sort((a, b) => b.minutes - a.minutes);
  const total = list.reduce((a, b) => a + b.minutes, 0);
  let cum = 0;
  return list.map((x) => { cum += x.minutes; return { ...x, color: CATEGORY_COLOR[x.category] ?? "var(--color-muted-foreground)", pct: total ? round1((100 * x.minutes) / total) : 0, cumPct: total ? round1((100 * cum) / total) : 0 }; });
}

export function reasonPareto(rows: DtRow[]) {
  const m = new Map<string, { reason: string; category: string; minutes: number; count: number }>();
  for (const r of rows) {
    const cur = m.get(r.reason) ?? { reason: r.reason, category: r.category, minutes: 0, count: 0 };
    cur.minutes += r.durationMin; cur.count += 1; m.set(r.reason, cur);
  }
  const list = [...m.values()].sort((a, b) => b.minutes - a.minutes);
  const total = list.reduce((a, b) => a + b.minutes, 0);
  let cum = 0;
  return list.map((x) => { cum += x.minutes; return { ...x, cumPct: total ? round1((100 * cum) / total) : 0 }; });
}

/** OEE class bands (world-class ≥85, typical 60–85, low <60). */
export function oeeBand(v: number) {
  if (v >= 85) return { label: "World-class", cls: "text-success border-success/40 bg-success/10" };
  if (v >= 60) return { label: "Typical", cls: "text-warning border-warning/40 bg-warning/10" };
  if (v > 0) return { label: "Low", cls: "text-destructive border-destructive/40 bg-destructive/10" };
  return { label: "No run", cls: "text-muted-foreground border-border/60 bg-card/40" };
}

export function round1(n: number) { return Math.round(n * 10) / 10; }
