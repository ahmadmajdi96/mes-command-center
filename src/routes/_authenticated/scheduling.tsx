import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { CalendarRange, AlertTriangle, Wand2, Trash2, Plus } from "lucide-react";
import { toast } from "sonner";
import { useRows, useWrite, errMsg } from "@/lib/execution-db";
import { useShifts, shiftHours, type ShiftDef } from "@/lib/shifts-store";
import { inp, btn, ghost } from "@/components/qp-ui";

export const Route = createFileRoute("/_authenticated/scheduling")({
  head: () => ({
    meta: [
      { title: "Scheduling & Capacity · Cortanex MES" },
      { name: "description", content: "Which orders run on which lines and machines, with shift-based capacity, changeovers and auto-scheduling." },
      { property: "og:title", content: "Scheduling & Capacity · Cortanex MES" },
      { property: "og:description", content: "Order schedule per line with shift capacity, changeover times and conflicts." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SchedulingPage,
});

const DAY = 86400000;
const OPEN = ["scheduled", "released", "running", "on_hold", "paused", "planned", "draft"];
const DEFAULT_CHANGEOVER_MIN = 30;

/** Working minutes in a calendar day from the shift definitions; Fri/Sat are off by default. */
function dayCapacityMin(shifts: ShiftDef[], date: Date) {
  const dow = date.getDay();
  if (dow === 5 || dow === 6) return 0;
  return shifts.reduce((s, sh) => s + shiftHours(sh) * 60 - (sh.breakMin || 0), 0);
}

function SchedulingPage() {
  const { data: orders = [] } = useRows<any>("production_orders", { order: "planned_start", asc: true });
  const { data: lines = [] } = useRows<any>("lines", { order: "id", asc: true });
  const { data: ops = [] } = useRows<any>("order_operations", { order: "sequence", asc: true });
  const { data: machines = [] } = useRows<any>("machines", { order: "name", asc: true });
  const { data: stations = [] } = useRows<any>("stations", { order: "sequence", asc: true });
  const { data: products = [] } = useRows<any>("products", { order: "name", asc: true });
  const { data: changeovers = [] } = useRows<any>("changeover_matrix", { order: "from_product_id", asc: true });
  const { data: orgs = [] } = useRows<any>("organizations");
  const wOrders = useWrite("production_orders");
  const wCo = useWrite("changeover_matrix");
  const { shifts } = useShifts([]);
  const [days, setDays] = useState(7);
  const [start, setStart] = useState(() => new Date(new Date().setHours(0, 0, 0, 0) - DAY).toISOString().slice(0, 10));
  const [coForm, setCoForm] = useState({ from: "", to: "", minutes: "30" });
  const [scheduling, setScheduling] = useState(false);
  const t0 = new Date(start).getTime(), t1 = t0 + days * DAY;

  const planned = useMemo(() => orders.filter((o) => OPEN.includes(o.status) || (o.planned_start && new Date(o.planned_start).getTime() < t1 && new Date(o.planned_end ?? o.planned_start).getTime() > t0)), [orders, t0, t1]);
  const unscheduled = planned.filter((o) => !o.planned_start || !o.line_id);
  const opMin = (o: any) => ops.filter((p) => p.production_order_id === o.id).reduce((s, p) => s + Number(p.setup_min || 0) + Number(p.run_min_per_unit || 0) * Number(o.qty || 0), 0);
  const span = (o: any) => {
    const s = new Date(o.planned_start).getTime();
    const e = o.planned_end ? new Date(o.planned_end).getTime() : s + Math.max(opMin(o), 60) * 60000;
    return { s, e: o.status === "running" ? Math.max(e, Date.now()) : e };
  };
  const coMin = (fromProduct: string | null, toProduct: string | null) => {
    if (!fromProduct || !toProduct || fromProduct === toProduct) return 0;
    const row = changeovers.find((c: any) => c.from_product_id === fromProduct && c.to_product_id === toProduct);
    return row ? Number(row.minutes) : DEFAULT_CHANGEOVER_MIN;
  };

  // Capacity in the visible window, from real shift definitions
  const capMin = useMemo(() => {
    let total = 0;
    for (let d = 0; d < days; d++) total += dayCapacityMin(shifts, new Date(t0 + d * DAY));
    return total;
  }, [shifts, days, t0]);

  const rows = lines.map((l) => {
    const mine = planned.filter((o) => o.line_id === l.id && o.planned_start).map((o) => ({ o, ...span(o) })).filter((x) => x.e > t0 && x.s < t1).sort((a, b) => a.s - b.s);
    const loadMin = mine.reduce((s, x) => s + (Math.min(x.e, t1) - Math.max(x.s, t0)) / 60000, 0);
    const conflicts = new Set<string>();
    for (let i = 1; i < mine.length; i++) {
      if (mine[i].s < mine[i - 1].e) { conflicts.add(mine[i].o.id); conflicts.add(mine[i - 1].o.id); continue; }
      const gap = (mine[i].s - mine[i - 1].e) / 60000;
      const need = coMin(mine[i - 1].o.product_id, mine[i].o.product_id);
      if (gap < need) { conflicts.add(mine[i].o.id); conflicts.add(mine[i - 1].o.id); }
    }
    const lineStations = stations.filter((s) => s.line_id === l.id).map((s) => s.id);
    const lineMachines = machines.filter((m) => lineStations.includes(m.station_id));
    return { l, mine, loadPct: capMin ? (loadMin / capMin) * 100 : 0, conflicts, lineMachines };
  });
  const pos = (t: number) => `${Math.max(0, Math.min(100, ((t - t0) / (t1 - t0)) * 100))}%`;

  /** Place every unscheduled order into the earliest free slot on the line with the soonest availability. */
  const autoSchedule = async () => {
    if (unscheduled.length === 0) return toast.info("Nothing to schedule — every open order has a line and start date");
    setScheduling(true);
    try {
      // lineId -> list of busy spans (existing scheduled orders)
      const busy = new Map<string, { s: number; e: number; product_id: string | null }[]>();
      for (const r of rows) busy.set(r.l.id, r.mine.map((x) => ({ s: x.s, e: x.e, product_id: x.o.product_id })));
      const todo = [...unscheduled].sort((a, b) => (a.due_date ?? a.planned_end ?? "9999").localeCompare(b.due_date ?? b.planned_end ?? "9999"));
      let placed = 0;
      for (const o of todo) {
        if (lines.length === 0) break;
        const durMs = Math.max(opMin(o), 60) * 60000;
        let best: { lineId: string; s: number; e: number } | null = null;
        for (const l of lines) {
          const spans = (busy.get(l.id) ?? []).sort((a, b) => a.s - b.s);
          let cursor = Math.max(Date.now(), t0);
          let lastProduct: string | null = null;
          for (const sp of spans) {
            const gapStart = cursor + coMin(lastProduct, o.product_id) * 60000;
            if (gapStart + durMs <= sp.s) break; // fits before this span
            cursor = Math.max(cursor, sp.e);
            lastProduct = sp.product_id;
          }
          const s = cursor + coMin(lastProduct, o.product_id) * 60000;
          const e = s + durMs;
          if (!best || e < best.e) best = { lineId: l.id, s, e };
        }
        if (!best) continue;
        await wOrders.update.mutateAsync({ id: o.id, patch: { line_id: best.lineId, planned_start: new Date(best.s).toISOString(), planned_end: new Date(best.e).toISOString(), status: o.status === "draft" || o.status === "planned" ? "scheduled" : o.status } });
        const arr = busy.get(best.lineId) ?? [];
        arr.push({ s: best.s, e: best.e, product_id: o.product_id });
        busy.set(best.lineId, arr);
        placed++;
      }
      toast.success(`Scheduled ${placed} order${placed === 1 ? "" : "s"}`);
    } catch (e) { toast.error(errMsg(e)); }
    finally { setScheduling(false); }
  };

  const addChangeover = async () => {
    if (!coForm.from || !coForm.to) return toast.error("Pick both products");
    if (coForm.from === coForm.to) return toast.error("From and to product must differ");
    const minutes = Number(coForm.minutes);
    if (!Number.isFinite(minutes) || minutes < 0) return toast.error("Minutes must be 0 or more");
    try {
      await wCo.insert.mutateAsync({ organization_id: orgs[0]?.id, from_product_id: coForm.from, to_product_id: coForm.to, minutes });
      toast.success("Changeover saved");
      setCoForm({ from: "", to: "", minutes: "30" });
    } catch (e) { toast.error(errMsg(e)); }
  };

  const prodName = (id: string | null) => products.find((p: any) => p.id === id)?.name ?? id ?? "—";

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 font-display text-2xl font-semibold"><CalendarRange className="h-5 w-5 text-primary" />Scheduling &amp; Capacity</h1>
          <p className="text-sm text-muted-foreground">Which orders run on which line and machines. Capacity comes from your shift plan ({shifts.map((s) => s.code).join(", ")} shifts, Fri/Sat off).</p>
        </div>
        <div className="flex flex-wrap items-end gap-2 text-[11px] text-muted-foreground">
          <label>From<input type="date" className={inp} value={start} onChange={(e) => setStart(e.target.value)} /></label>
          <label>Days<select className={inp} value={days} onChange={(e) => setDays(Number(e.target.value))}>{[1, 3, 7, 14, 30].map((d) => <option key={d}>{d}</option>)}</select></label>
          <button className={btn + " flex items-center gap-1.5"} disabled={scheduling} onClick={autoSchedule}>
            <Wand2 className="h-3.5 w-3.5" />{scheduling ? "Scheduling…" : `Auto-schedule (${unscheduled.length})`}
          </button>
        </div>
      </div>

      <div className="glass-panel space-y-4 rounded-2xl p-4">
        <div className="relative ml-44 h-5 text-[10px] text-muted-foreground">
          {Array.from({ length: days }).map((_, i) => <span key={i} className="absolute" style={{ left: pos(t0 + i * DAY) }}>{new Date(t0 + i * DAY).toLocaleDateString(undefined, { weekday: "short", day: "numeric" })}</span>)}
        </div>
        {rows.map(({ l, mine, loadPct, conflicts, lineMachines }) => (
          <div key={l.id} className="flex items-start gap-3" data-testid={`sched-${l.id}`}>
            <div className="w-40 shrink-0 text-xs">
              <Link to="/lines/$lineId" params={{ lineId: l.id }} className="font-medium text-primary hover:underline">{l.name}</Link>
              <div className={loadPct > 100 ? "text-destructive" : loadPct > 85 ? "text-warning" : "text-muted-foreground"}>Load {loadPct.toFixed(0)}%</div>
              <div className="truncate text-[10px] text-muted-foreground">{lineMachines.length ? lineMachines.map((m) => m.name).join(", ") : "No machines"}</div>
            </div>
            <div className="relative h-12 flex-1 rounded-lg border border-border/40 bg-background/30">
              {mine.map(({ o, s, e }) => (
                <Link key={o.id} to="/production-orders/$poId" params={{ poId: o.id }} title={`${o.id} · ${o.product_name} · ${o.qty} ${o.uom}\n${new Date(s).toLocaleString()} → ${new Date(e).toLocaleString()}`}
                  className={`absolute top-1 bottom-1 overflow-hidden rounded-md border px-1 text-[10px] leading-tight ${conflicts.has(o.id) ? "border-destructive bg-destructive/20" : o.status === "running" ? "border-success/50 bg-success/20" : "border-primary/40 bg-primary/15"}`}
                  style={{ left: pos(s), width: `calc(${pos(e)} - ${pos(s)})`, minWidth: 6 }}>
                  <div className="truncate font-mono">{o.id}</div><div className="truncate text-muted-foreground">{o.product_name}</div>
                </Link>
              ))}
            </div>
          </div>
        ))}
        {rows.some((r) => r.conflicts.size) && <p className="flex items-center gap-1 text-xs text-destructive"><AlertTriangle className="h-3.5 w-3.5" />Red orders overlap or lack changeover time on the same line — move one of them.</p>}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="glass-panel rounded-2xl p-4">
          <h2 className="mb-2 text-sm font-semibold">Orders and their steps</h2>
          <table className="w-full text-xs"><thead className="text-[10px] uppercase text-muted-foreground"><tr><th className="py-1 text-left">Order</th><th className="text-left">Line</th><th className="text-left">Start</th><th className="pr-3 text-right">Work (h)</th><th className="text-left">Steps / machine</th></tr></thead>
            <tbody>{planned.map((o) => (
              <tr key={o.id} className="border-t border-border/40 align-top">
                <td className="py-1.5"><Link to="/production-orders/$poId" params={{ poId: o.id }} className="font-mono text-primary">{o.id}</Link><div className="text-muted-foreground">{o.status}</div></td>
                <td>{o.line_id ?? "—"}</td><td>{o.planned_start ? new Date(o.planned_start).toLocaleString() : "—"}</td><td className="pr-3 text-right">{(opMin(o) / 60).toFixed(1)}</td>
                <td>{ops.filter((p) => p.production_order_id === o.id).map((p) => <div key={p.id}>{p.sequence}. {p.name} <span className="text-muted-foreground">{p.machine_id ?? p.station_id ?? p.work_center_id ?? ""}</span></div>)}</td>
              </tr>))}</tbody></table>
        </div>
        <div className="space-y-4">
          <div className="glass-panel rounded-2xl p-4">
            <h2 className="mb-2 text-sm font-semibold">Needs a line or start date ({unscheduled.length})</h2>
            {unscheduled.map((o) => <div key={o.id} className="border-t border-border/40 py-1.5 text-xs"><Link to="/production-orders/$poId" params={{ poId: o.id }} className="font-mono text-primary">{o.id}</Link> · {o.product_name} · {o.qty} {o.uom} · {!o.line_id ? "no line" : "no start date"}</div>)}
            {unscheduled.length === 0 && <p className="text-xs text-muted-foreground">All open orders are scheduled.</p>}
          </div>
          <div className="glass-panel rounded-2xl p-4">
            <h2 className="mb-1 text-sm font-semibold">Changeover times</h2>
            <p className="mb-2 text-[11px] text-muted-foreground">Minutes needed on a line when switching between products. Pairs not listed use {DEFAULT_CHANGEOVER_MIN} min.</p>
            <div className="space-y-1 text-xs">
              {changeovers.map((c: any) => (
                <div key={c.id} className="flex items-center gap-2 border-t border-border/40 py-1">
                  <span>{prodName(c.from_product_id)} → {prodName(c.to_product_id)}</span>
                  <span className="ml-auto font-mono">{c.minutes} min</span>
                  <button className={ghost} onClick={() => wCo.remove.mutateAsync(c.id).then(() => toast.success("Removed")).catch((e) => toast.error(errMsg(e)))}><Trash2 className="h-3 w-3" /></button>
                </div>
              ))}
              {changeovers.length === 0 && <p className="text-muted-foreground">No changeovers defined yet.</p>}
            </div>
            <div className="mt-3 flex flex-wrap items-end gap-2 text-[11px]">
              <label>From<select className={inp} value={coForm.from} onChange={(e) => setCoForm({ ...coForm, from: e.target.value })}><option value="">Product…</option>{products.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
              <label>To<select className={inp} value={coForm.to} onChange={(e) => setCoForm({ ...coForm, to: e.target.value })}><option value="">Product…</option>{products.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
              <label>Minutes<input className={inp + " w-20"} inputMode="numeric" value={coForm.minutes} onChange={(e) => setCoForm({ ...coForm, minutes: e.target.value.replace(/[^\d]/g, "") })} /></label>
              <button className={btn + " flex items-center gap-1"} onClick={addChangeover}><Plus className="h-3.5 w-3.5" />Add</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
