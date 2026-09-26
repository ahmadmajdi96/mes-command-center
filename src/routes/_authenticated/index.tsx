import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line as RLine,
  LineChart,
  Pie,
  PieChart,
  PolarAngleAxis,
  ReferenceArea,
  ReferenceLine,
  RadialBar,
  RadialBarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  CalendarCheck,
  CheckCircle2,
  Database,
  Gauge,
  Package,
  Power,
  Timer,
  TrendingUp,
  Zap,
} from "lucide-react";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DashFilterBar } from "@/components/dash-filters";
import { allDowntime, computeOee, oeeBand, oeeTrendSeries, paretoOf, scope, SHIFT_WINDOWS, useDashFilters, type DashFilters, type DtRow } from "@/lib/dashboard-metrics";
import { buildAndon, readingSources, useReadings, type AndonItem } from "@/lib/dash-feeds";
import { useMes } from "@/lib/mes-store";
import { StatusPill } from "@/components/status-pill";
import { getKpiSummary } from "@/lib/mes/kpi.functions";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({
    meta: [
      { title: "Control Center · Cortanex MES" },
      { name: "description", content: "Real-time plant-wide OEE, andon alerts, and live work order execution status." },
    ],
  }),
  component: Dashboard,
});


const tooltipStyle = {
  background: "oklch(0.16 0.02 240 / 0.95)",
  border: "1px solid oklch(0.3 0.02 245)",
  borderRadius: 8,
  fontSize: 12,
};

function Kpi({
  label,
  value,
  delta,
  icon: Icon,
  accent = "primary",
  suffix,
}: {
  label: string;
  value: string | number;
  delta?: string;
  icon: React.ComponentType<{ className?: string }>;
  accent?: "primary" | "success" | "warning" | "info" | "accent";
  suffix?: string;
}) {
  const accentMap = {
    primary: "from-primary/20 to-primary/0 text-primary",
    success: "from-success/20 to-success/0 text-success",
    warning: "from-warning/20 to-warning/0 text-warning",
    info: "from-info/20 to-info/0 text-info",
    accent: "from-accent/20 to-accent/0 text-accent",
  } as const;
  return (
    <div className="glass-panel relative overflow-hidden rounded-2xl p-4">
      <div className={`absolute inset-0 bg-gradient-to-br ${accentMap[accent]} opacity-60`} />
      <div className="relative">
        <div className="flex items-center justify-between">
          <span className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">{label}</span>
          <Icon className={`h-4 w-4 ${accentMap[accent].split(" ").pop()}`} />
        </div>
        <div className="mt-3 flex items-baseline gap-1">
          <span className="font-mono text-3xl font-semibold tracking-tight">{value}</span>
          {suffix && <span className="text-sm text-muted-foreground">{suffix}</span>}
        </div>
        {delta && (
          <div className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
            <ArrowUpRight className="h-3 w-3 text-success" />
            <span>{delta}</span>
          </div>
        )}
      </div>
    </div>
  );
}

function Dashboard() {
  const store = useMes();
  const [f, set] = useDashFilters();
  const [clock, setClock] = useState<string>("");
  useEffect(() => {
    const update = () => setClock(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
    update();
    const id = setInterval(update, 30000);
    return () => clearInterval(id);
  }, []);

  const dtAll = useMemo(() => allDowntime(store.downtime, store.audit, store.lines), [store.downtime, store.audit, store.lines]);
  const s = scope(f, { lines: store.lines, stations: store.stations, downtime: dtAll });
  const oee = computeOee(f, s);
  const trend = oeeTrendSeries(f, s);
  const pareto = paretoOf(s.downtime);
  const lineIds = new Set(s.lines.map((l) => l.id));
  const andon = buildAndon(s.downtime, store.holds, store.stations.filter((x) => lineIds.has(x.lineId)), lineIds);
  const runningWOs = store.workOrders.filter((w) => w.status === "running" && lineIds.has(w.lineId) && (f.shift === "all" || w.shift === f.shift));
  const goodUnits = s.lines.reduce((a, l) => a + l.output, 0);
  const lineStations = store.stations.filter((x) => f.lineId === "all" ? lineIds.has(x.lineId) : x.lineId === f.lineId);
  const band = oeeBand(oee.oee);
  const [selLine, setSelLine] = useState<string | null>(null);
  const shiftLabel = f.shift === "all" ? "All shifts" : SHIFT_WINDOWS[f.shift].label;
  const plantLabel = f.plant === "all" ? "All plants" : f.plant;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Control Center</h1>
          <p className="text-sm text-muted-foreground">{plantLabel} · {shiftLabel} · {s.iv.label} · <span suppressHydrationWarning>{clock}</span></p>
        </div>
        <DashFilterBar f={f} set={set} />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Kpi label="OEE" value={oee.oee} suffix="%" delta={band.label} icon={Gauge} accent="primary" />
        <Kpi label="Availability" value={oee.availability} suffix="%" delta={`${oee.downMin} min down`} icon={Timer} accent="info" />
        <Kpi label="Performance" value={oee.performance} suffix="%" icon={TrendingUp} accent="accent" />
        <Kpi label="Quality" value={oee.quality} suffix="%" icon={CheckCircle2} accent="success" />
        <Kpi label="Good Units" value={goodUnits.toLocaleString()} delta={`${s.lines.length} lines`} icon={Package} accent="primary" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="glass-panel rounded-2xl p-5 lg:col-span-2">
          <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold">OEE — {s.iv.label}</h3>
              <p className="text-xs text-muted-foreground">Availability × Performance × Quality · bands: ≥85 world-class, 60–85 typical, &lt;60 low</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <select aria-label="OEE line" className="rounded-lg border border-border/60 bg-card/60 px-2 py-1 text-xs" value={f.lineId} onChange={(e) => set({ lineId: e.target.value, stationId: "all" })}>
                <option value="all">All lines</option>
                {store.lines.filter((l) => f.plant === "all" || l.plant === f.plant).map((l) => <option key={l.id} value={l.id}>{l.id} · {l.name}</option>)}
              </select>
              <select aria-label="OEE station" className="rounded-lg border border-border/60 bg-card/60 px-2 py-1 text-xs" value={f.stationId} onChange={(e) => set({ stationId: e.target.value })}>
                <option value="all">All stations</option>
                {lineStations.map((st) => <option key={st.id} value={st.id}>{st.id} · {st.name}</option>)}
              </select>
            </div>
          </div>
          <div className="mb-2 flex flex-wrap gap-3 text-[11px]">
            <Legend dot="bg-primary" label="OEE" />
            <Legend dot="bg-info" label="Availability" />
            <Legend dot="bg-accent" label="Performance" />
            <Legend dot="bg-success" label="Quality" />
          </div>
          <div className="h-64">
            {trend.length === 0 ? (
              <p className="grid h-full place-items-center text-xs text-muted-foreground">No planned time in this shift/interval.</p>
            ) : (
              <ResponsiveContainer>
                <AreaChart data={trend}>
                  <defs>
                    <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.5} />
                      <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <ReferenceArea y1={85} y2={100} fill="var(--color-success)" fillOpacity={0.06} />
                  <ReferenceArea y1={60} y2={85} fill="var(--color-warning)" fillOpacity={0.05} />
                  <ReferenceArea y1={0} y2={60} fill="var(--color-destructive)" fillOpacity={0.05} />
                  <ReferenceLine y={85} stroke="var(--color-success)" strokeDasharray="4 4" />
                  <ReferenceLine y={60} stroke="var(--color-destructive)" strokeDasharray="4 4" />
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.3 0.02 245 / 0.4)" />
                  <XAxis dataKey="label" stroke="oklch(0.68 0.02 245)" fontSize={11} />
                  <YAxis stroke="oklch(0.68 0.02 245)" fontSize={11} domain={[0, 100]} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Area type="monotone" dataKey="oee" name="OEE" stroke="var(--color-primary)" fill="url(#g1)" strokeWidth={2} />
                  <RLine type="monotone" dataKey="availability" name="Availability" stroke="var(--color-info)" strokeWidth={1.5} dot={false} />
                  <RLine type="monotone" dataKey="performance" name="Performance" stroke="var(--color-accent)" strokeWidth={1.5} dot={false} />
                  <RLine type="monotone" dataKey="quality" name="Quality" stroke="var(--color-success)" strokeWidth={1.5} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="glass-panel rounded-2xl p-5">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-sm font-semibold">{f.stationId !== "all" ? `Station ${f.stationId}` : f.lineId !== "all" ? `Line ${f.lineId}` : "Plant-wide"} OEE</h3>
              <p className="text-xs text-muted-foreground">Composite for selected scope</p>
            </div>
            <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${band.cls}`}>{band.label}</span>
          </div>
          <div className="relative mt-2 h-48">
            <ResponsiveContainer>
              <RadialBarChart innerRadius="60%" outerRadius="95%" data={[{ name: "oee", value: oee.oee, fill: oee.oee >= 85 ? "var(--color-success)" : oee.oee >= 60 ? "var(--color-warning)" : "var(--color-destructive)" }]} startAngle={210} endAngle={-30}>
                <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
                <RadialBar dataKey="value" background={{ fill: "oklch(0.25 0.02 245)" }} cornerRadius={12} />
              </RadialBarChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="font-mono text-4xl font-semibold text-glow">{oee.oee}</span>
              <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">OEE %</span>
            </div>
          </div>
          <div className="space-y-2">
            {([["Availability", oee.availability, "bg-info"], ["Performance", oee.performance, "bg-accent"], ["Quality", oee.quality, "bg-success"]] as const).map(([k, v, c]) => (
              <div key={k}>
                <div className="flex justify-between text-[11px]"><span className="text-muted-foreground">{k}</span><span className="font-mono">{v}%</span></div>
                <div className="h-1.5 overflow-hidden rounded-full bg-muted"><div className={`h-full rounded-full ${c}`} style={{ width: `${v}%` }} /></div>
              </div>
            ))}
            <p className="pt-1 text-[10px] text-muted-foreground">Planned {oee.plannedMin.toLocaleString()} min · downtime {oee.downMin} min</p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="glass-panel rounded-2xl p-5 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold">Lines · Live</h3>
              <p className="text-xs text-muted-foreground">{s.lines.filter((l) => l.status === "running").length} of {s.lines.length} running · click a line for details</p>
            </div>
            <Link to="/lines" className="text-xs text-primary hover:underline">View all →</Link>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {s.lines.map((l) => {
              const b = oeeBand(l.oee);
              return (
                <button key={l.id} onClick={() => setSelLine(l.id)} className="rounded-xl border border-border/60 bg-card/40 p-3 text-left transition hover:border-primary/50">
                  <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[11px] text-muted-foreground">{l.id}</span>
                        <span className="truncate text-sm font-medium">{l.name}</span>
                      </div>
                      <p className="truncate text-[11px] text-muted-foreground">{l.product ?? "—"}</p>
                    </div>
                    <StatusPill status={l.status} />
                  </div>
                  <div className="mt-3 flex items-center justify-between text-[11px]">
                    <span className={`rounded-full border px-1.5 text-[9px] uppercase ${b.cls}`}>{b.label}</span>
                    <span className="font-mono font-medium">OEE {l.oee}%</span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full" style={{ width: `${l.oee}%`, background: l.oee >= 85 ? "var(--color-success)" : l.oee >= 60 ? "var(--color-warning)" : "var(--color-destructive)" }} />
                  </div>
                  <div className="mt-2 flex justify-between text-[10px] text-muted-foreground">
                    <span>{l.output.toLocaleString()} / {l.target.toLocaleString()}</span>
                    <span>↻ {l.uptime}</span>
                  </div>
                </button>
              );
            })}
            {s.lines.length === 0 && <p className="text-xs text-muted-foreground">No lines in this plant.</p>}
          </div>
        </div>

        <div className="glass-panel rounded-2xl p-5">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold">Andon Feed</h3>
              <p className="text-xs text-muted-foreground">{andon.filter((a) => a.level !== "info").length} active</p>
            </div>
            <Link to="/analytics" search={{ view: "andon" }} className="text-xs text-primary hover:underline">View all →</Link>
          </div>
          <div className="space-y-2">
            {andon.length === 0 && <p className="text-xs text-muted-foreground">No active alerts in this scope.</p>}
            {andon.slice(0, 6).map((a) => <AndonRow key={a.id} a={a} />)}
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="glass-panel rounded-2xl p-5">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-sm font-semibold">Downtime — Pareto</h3>
              <p className="text-xs text-muted-foreground">{s.downtime.length} events · {oee.downMin} min</p>
            </div>
            <Link to="/analytics" search={{ view: "pareto" }} className="text-xs text-primary hover:underline">View all →</Link>
          </div>
          <div className="h-56">
            {pareto.length === 0 ? <p className="grid h-full place-items-center text-xs text-muted-foreground">No downtime recorded.</p> : (
              <ResponsiveContainer>
                <BarChart data={pareto} layout="vertical" margin={{ left: 10 }}>
                  <XAxis type="number" stroke="oklch(0.68 0.02 245)" fontSize={11} />
                  <YAxis type="category" dataKey="name" stroke="oklch(0.68 0.02 245)" fontSize={10} width={110} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`${v} min`, "Downtime"]} />
                  <Bar dataKey="minutes" radius={[0, 6, 6, 0]}>
                    {pareto.map((d, i) => <Cell key={i} fill={d.color} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <TemperatureCard since={s.since} />

        <div className="glass-panel rounded-2xl p-5">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-sm font-semibold">Stoppage Mix</h3>
              <p className="text-xs text-muted-foreground">Share of downtime minutes</p>
            </div>
            <Link to="/analytics" search={{ view: "stoppage" }} className="text-xs text-primary hover:underline">View all →</Link>
          </div>
          <div className="h-44">
            {pareto.length === 0 ? <p className="grid h-full place-items-center text-xs text-muted-foreground">No downtime recorded.</p> : (
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={pareto} dataKey="minutes" nameKey="name" innerRadius={45} outerRadius={75} paddingAngle={2}>
                    {pareto.map((d, i) => <Cell key={i} fill={d.color} />)}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
          <div className="space-y-1 text-[11px]">
            {pareto.map((d) => (
              <div key={d.category} className="flex items-center justify-between">
                <span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full" style={{ background: d.color }} />{d.name}</span>
                <span className="font-mono text-muted-foreground">{d.pct}% · {d.minutes}m</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <KpiWidgets />

      <div className="glass-panel rounded-2xl p-5">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold">Running Work Orders</h3>
            <p className="text-xs text-muted-foreground">{runningWOs.length} in execution</p>
          </div>
          <Link to="/work-orders" className="text-xs text-primary hover:underline">All work orders →</Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                <th className="py-2 pr-4 font-medium">Work Order</th>
                <th className="py-2 pr-4 font-medium">Product</th>
                <th className="py-2 pr-4 font-medium">Line</th>
                <th className="py-2 pr-4 font-medium">Operator</th>
                <th className="py-2 pr-4 font-medium">Progress</th>
                <th className="py-2 pr-4 font-medium text-right">Output</th>
              </tr>
            </thead>
            <tbody>
              {runningWOs.map((w) => (
                <tr key={w.id} className="border-t border-border/40 hover:bg-card/40">
                  <td className="py-3 pr-4 font-mono text-xs"><Link to="/work-orders/$woId" params={{ woId: w.id }} className="text-primary hover:underline">{w.id}</Link></td>
                  <td className="py-3 pr-4">{w.product}</td>
                  <td className="py-3 pr-4 font-mono text-xs text-muted-foreground">{w.lineId}</td>
                  <td className="py-3 pr-4 text-xs">{w.operator}</td>
                  <td className="py-3 pr-4">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-32 overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full bg-gradient-to-r from-primary to-info" style={{ width: `${w.progress}%` }} />
                      </div>
                      <span className="font-mono text-[11px] text-muted-foreground">{w.progress}%</span>
                    </div>
                  </td>
                  <td className="py-3 pr-4 text-right font-mono text-xs">{w.qtyProduced.toLocaleString()} / {w.qtyTarget.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <LineDetailDialog lineId={selLine} onClose={() => setSelLine(null)} f={f} dt={dtAll} />
    </div>
  );
}

export function AndonRow({ a }: { a: AndonItem }) {
  const color = a.level === "critical" ? "border-destructive/40 bg-destructive/5" : a.level === "warn" ? "border-warning/40 bg-warning/5" : "border-border/60 bg-card/40";
  const icon = a.level === "info" ? <Activity className="h-3.5 w-3.5 text-info" /> : <AlertTriangle className={`h-3.5 w-3.5 ${a.level === "critical" ? "text-destructive" : "text-warning"}`} />;
  const body = (
    <div className="flex items-start gap-2">
      {icon}
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-xs font-medium">{a.source}</span>
          <span className="font-mono text-[10px] text-muted-foreground" suppressHydrationWarning>{a.at.toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
        </div>
        <p className="mt-0.5 text-[11px] text-muted-foreground">{a.message}</p>
      </div>
    </div>
  );
  const cls = `block rounded-lg border p-2.5 hover:ring-1 hover:ring-primary/40 ${color}`;
  if (a.link.kind === "station") return <Link to="/stations/$stationId" params={{ stationId: a.link.id }} className={cls}>{body}</Link>;
  if (a.link.kind === "hold") return <Link to="/quality" className={cls}>{body}</Link>;
  return <Link to="/lines/$lineId" params={{ lineId: a.lineId }} className={cls}>{body}</Link>;
}

function TemperatureCard({ since }: { since: number }) {
  const { data = [], isLoading } = useReadings(since);
  const sources = readingSources(data);
  const [key, setKey] = useState<string>("");
  const cur = sources.find((x) => x.key === key) ?? sources[0];
  const series = cur ? data.filter((r) => `${r.machine_id}|${r.tag}` === cur.key && r.value != null).map((r) => ({ t: new Date(r.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }), v: Number(r.value), ok: r.in_limits })) : [];
  const last = series.at(-1);
  return (
    <div className="glass-panel rounded-2xl p-5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold">{cur?.isTemp === false ? "Machine value" : "Temperature"}</h3>
          <select aria-label="Sensor" className="mt-1 max-w-[180px] rounded-md border border-border/60 bg-card/60 px-1.5 py-0.5 text-[11px]" value={cur?.key ?? ""} onChange={(e) => setKey(e.target.value)}>
            {sources.length === 0 && <option value="">No sensors</option>}
            {sources.map((x) => <option key={x.key} value={x.key}>{x.machine} · {x.tag}{x.unit ? ` (${x.unit})` : ""}</option>)}
          </select>
        </div>
        <div className="text-right">
          <span className={`font-mono text-xl font-semibold ${last?.ok === false ? "text-destructive" : "text-primary"}`}>{last ? `${last.v}${cur?.unit ?? ""}` : "—"}</span>
          <Link to="/analytics" search={{ view: "temperature" }} className="block text-xs text-primary hover:underline">View all →</Link>
        </div>
      </div>
      <div className="h-52">
        {isLoading ? <p className="grid h-full place-items-center text-xs text-muted-foreground">Loading…</p> : series.length === 0 ? (
          <p className="grid h-full place-items-center text-center text-xs text-muted-foreground">No readings in this interval.<br />Machines send values from the Machines page or the line-side box.</p>
        ) : (
          <ResponsiveContainer>
            <LineChart data={series}>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.3 0.02 245 / 0.4)" />
              <XAxis dataKey="t" stroke="oklch(0.68 0.02 245)" fontSize={10} />
              <YAxis stroke="oklch(0.68 0.02 245)" fontSize={10} domain={["auto", "auto"]} />
              <Tooltip contentStyle={tooltipStyle} />
              <RLine type="monotone" dataKey="v" stroke="var(--color-primary)" strokeWidth={2} dot={(p: { cx?: number; cy?: number; payload?: { ok: boolean | null }; index?: number }) => <circle key={p.index} cx={p.cx} cy={p.cy} r={p.payload?.ok === false ? 3.5 : 0} fill="var(--color-destructive)" />} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

function LineDetailDialog({ lineId, onClose, f, dt }: { lineId: string | null; onClose: () => void; f: DashFilters; dt: DtRow[] }) {
  const store = useMes();
  const line = store.lines.find((l) => l.id === lineId);
  if (!line) return <Dialog open={false} onOpenChange={() => onClose()}><DialogContent /></Dialog>;
  const lf: DashFilters = { ...f, plant: "all", lineId: line.id, stationId: "all" };
  const s = scope(lf, { lines: store.lines, stations: store.stations, downtime: dt });
  const o = computeOee(lf, s);
  const stations = store.stations.filter((x) => x.lineId === line.id).sort((a, b) => a.sequence - b.sequence);
  const wo = store.workOrders.filter((w) => w.lineId === line.id);
  const crew = store.assignments.filter((a) => a.active && (stations.some((st) => st.id === a.targetId)));
  return (
    <Dialog open onOpenChange={(o2) => !o2 && onClose()}>
      <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">{line.id} · {line.name} <StatusPill status={line.status} /></DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground">{line.plant} · {line.product ?? "no product"} · WO {line.currentWorkOrder ?? "—"} · {s.iv.label}</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {([["OEE", o.oee], ["Availability", o.availability], ["Performance", o.performance], ["Quality", o.quality]] as const).map(([k, v]) => (
            <div key={k} className="rounded-lg border border-border/60 bg-card/40 p-2"><div className="text-[10px] uppercase text-muted-foreground">{k}</div><div className="font-mono text-lg">{v}%</div></div>
          ))}
          <div className="rounded-lg border border-border/60 bg-card/40 p-2"><div className="text-[10px] uppercase text-muted-foreground">Output</div><div className="font-mono text-lg">{line.output.toLocaleString()}</div><div className="text-[10px] text-muted-foreground">of {line.target.toLocaleString()}</div></div>
        </div>
        <div>
          <h4 className="mb-1 text-xs font-semibold">Stations ({stations.length})</h4>
          <div className="grid gap-1.5 sm:grid-cols-2">
            {stations.map((st) => (
              <Link key={st.id} to="/stations/$stationId" params={{ stationId: st.id }} className="flex items-center justify-between rounded-lg border border-border/60 bg-card/40 px-2 py-1.5 text-xs hover:border-primary/50">
                <span><span className="font-mono text-muted-foreground">{st.sequence}. </span>{st.name}</span>
                <span className="flex items-center gap-2"><span className="font-mono">{st.currentValue ?? ""}</span><StatusPill status={st.status} /></span>
              </Link>
            ))}
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <h4 className="mb-1 text-xs font-semibold">Downtime in interval ({s.downtime.length})</h4>
            <div className="max-h-40 space-y-1 overflow-y-auto text-[11px]">
              {s.downtime.slice(0, 30).map((d) => <div key={d.id} className="flex justify-between border-b border-border/30 py-0.5"><span>{d.reason}</span><span className="font-mono text-muted-foreground">{d.durationMin}m · {d.at.toLocaleDateString()}</span></div>)}
              {s.downtime.length === 0 && <p className="text-muted-foreground">None</p>}
            </div>
          </div>
          <div>
            <h4 className="mb-1 text-xs font-semibold">Work orders & crew</h4>
            <div className="space-y-1 text-[11px]">
              {wo.map((w) => <Link key={w.id} to="/work-orders/$woId" params={{ woId: w.id }} className="flex justify-between hover:text-primary"><span className="font-mono">{w.id}</span><span>{w.status} · {w.progress}%</span></Link>)}
              {crew.map((a) => <div key={a.id} className="flex justify-between text-muted-foreground"><span>{store.users.find((u) => u.id === a.userId)?.name ?? a.userId}</span><span>{a.targetId} · shift {a.shift}</span></div>)}
            </div>
          </div>
        </div>
        <Link to="/lines/$lineId" params={{ lineId: line.id }} className="inline-flex items-center gap-1 text-xs text-primary hover:underline">Open full line page <ArrowUpRight className="h-3 w-3" /></Link>
      </DialogContent>
    </Dialog>
  );
}

function Legend({ dot, label }: { dot: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5 text-muted-foreground">
      <span className={`h-2 w-2 rounded-full ${dot}`} />
      {label}
    </span>
  );
}

// --- KPI widgets: uptime, downtime Pareto by category, on-time WO completion ---

const CATEGORY_LABEL: Record<string, string> = {
  equipment_failure: "Equipment failure",
  changeover: "Changeover",
  material_shortage: "Material shortage",
  quality_hold: "Quality hold",
  operator_break: "Operator break",
};

const CATEGORY_COLOR: Record<string, string> = {
  equipment_failure: "oklch(0.68 0.22 25)",
  changeover: "oklch(0.78 0.16 195)",
  material_shortage: "oklch(0.82 0.17 80)",
  quality_hold: "oklch(0.72 0.18 320)",
  operator_break: "oklch(0.72 0.14 230)",
};

function KpiWidgets() {
  const store = useMes();
  const fetchKpis = useServerFn(getKpiSummary);
  const qc = useQueryClient();
  const { data: dbKpi } = useQuery({
    queryKey: ["mes", "kpi-summary"],
    queryFn: () => fetchKpis(),
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
    staleTime: 15_000,
  });

  // Realtime: invalidate KPI query whenever new downtime, quality holds,
  // or work-order status changes stream in from Lovable Cloud.
  useEffect(() => {
    const bump = () => qc.invalidateQueries({ queryKey: ["mes", "kpi-summary"] });
    const ch = supabase
      .channel("mes-kpi-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "downtime_events" }, bump)
      .on("postgres_changes", { event: "*", schema: "public", table: "quality_holds" }, bump)
      .on("postgres_changes", { event: "*", schema: "public", table: "work_orders" }, bump)
      .on("postgres_changes", { event: "*", schema: "public", table: "lines" }, bump)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);


  const useDb = !!dbKpi?.seeded;

  // OEE-like uptime — share of lines running weighted by availability
  const activeLines = store.lines.filter((l) => l.status === "running");
  const storeUptime =
    store.lines.length === 0
      ? 0
      : Math.round(
          store.lines.reduce((sum, l) => sum + (l.status === "running" ? l.availability : 0), 0) /
            store.lines.length,
        );
  const uptime = useDb ? dbKpi!.uptimeWeighted : storeUptime;

  // Downtime Pareto by category (all recorded events)
  const paretoMap = new Map<string, number>();
  for (const d of store.downtime) {
    paretoMap.set(d.category, (paretoMap.get(d.category) ?? 0) + d.durationMin);
  }
  const storePareto = [...paretoMap.entries()]
    .map(([category, minutes]) => ({
      category,
      label: CATEGORY_LABEL[category] ?? category,
      minutes,
      color: CATEGORY_COLOR[category] ?? "oklch(0.6 0.05 245)",
    }))
    .sort((a, b) => b.minutes - a.minutes);
  const pareto = useDb
    ? dbKpi!.pareto.map((p) => ({
        ...p,
        color: CATEGORY_COLOR[p.category] ?? "oklch(0.6 0.05 245)",
      }))
    : storePareto;
  const paretoTotal = pareto.reduce((s, p) => s + p.minutes, 0);
  const paretoTop = pareto[0];

  // On-time WO completion — completed WOs meeting qty target
  const completedStore = store.workOrders.filter((w) => w.status === "completed");
  const onTimeStore = completedStore.filter((w) => w.qtyProduced / Math.max(1, w.qtyTarget) >= 0.98);
  const otd = useDb
    ? dbKpi!.onTimeCompletionPct
    : completedStore.length === 0
    ? 0
    : Math.round((onTimeStore.length / completedStore.length) * 100);
  const completedCount = useDb ? dbKpi!.completedCount : completedStore.length;
  const onTimeCount = useDb ? dbKpi!.onTimeCount : onTimeStore.length;
  const running = useDb
    ? dbKpi!.runningCount
    : store.workOrders.filter((w) => w.status === "running").length;
  const scheduled = useDb
    ? dbKpi!.scheduledCount
    : store.workOrders.filter((w) => w.status === "scheduled").length;
  const linesRunning = useDb ? dbKpi!.linesRunning : activeLines.length;
  const linesDown = useDb
    ? dbKpi!.linesDown
    : store.lines.filter((l) => l.status === "down").length;
  const linesIdle = useDb
    ? dbKpi!.linesIdleOrChangeover
    : store.lines.filter((l) => l.status === "changeover" || l.status === "idle").length;

  const topCategory = paretoTop?.category;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
          <Database className={`h-3 w-3 ${useDb ? "text-success" : "text-muted-foreground"}`} />
          <span>{useDb ? "Live · Lovable Cloud · realtime + 30s refresh" : "In-memory preview — seed the database from Settings to go live"}</span>
        </div>
        <Link to="/traceability" className="text-[11px] text-primary hover:underline">Open traceability →</Link>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">

      {/* Uptime → drill to line/downtime activity */}
      <Link to="/traceability" search={{ entity: "downtime" }} className="glass-panel relative block overflow-hidden rounded-2xl p-5 transition hover:ring-1 hover:ring-primary/50">
        <div className="absolute inset-0 bg-gradient-to-br from-success/15 to-transparent" />
        <div className="relative">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold">OEE-like Uptime</h3>
              <p className="text-xs text-muted-foreground">Weighted availability · click for line events →</p>
            </div>
            <Power className="h-4 w-4 text-success" />
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="font-mono text-4xl font-semibold tracking-tight text-glow">{uptime}</span>
            <span className="text-sm text-muted-foreground">%</span>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full"
              style={{
                width: `${uptime}%`,
                background:
                  uptime >= 85
                    ? "var(--color-success)"
                    : uptime >= 70
                    ? "var(--color-accent)"
                    : "var(--color-destructive)",
              }}
            />
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 text-[11px] text-muted-foreground">
            <div>
              <div className="font-mono text-sm text-foreground">{linesRunning}</div>
              <div>Running</div>
            </div>
            <div>
              <div className="font-mono text-sm text-foreground">{linesDown}</div>
              <div>Down</div>
            </div>
            <div>
              <div className="font-mono text-sm text-foreground">{linesIdle}</div>
              <div>Idle / CO</div>
            </div>
          </div>
        </div>
      </Link>


      {/* Downtime Pareto → drill to downtime audit */}
      <Link to="/traceability" search={{ entity: "downtime", category: topCategory }} className="glass-panel relative block overflow-hidden rounded-2xl p-5 transition hover:ring-1 hover:ring-primary/50">
        <div className="absolute inset-0 bg-gradient-to-br from-destructive/10 to-transparent" />
        <div className="relative">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold">Downtime Pareto</h3>
              <p className="text-xs text-muted-foreground">By category · {paretoTotal}m total · click to drill →</p>
            </div>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </div>
          {pareto.length === 0 ? (
            <p className="mt-4 text-xs text-muted-foreground">No downtime events recorded.</p>
          ) : (
            <>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="font-mono text-2xl font-semibold">{paretoTop.label}</span>
                <span className="text-xs text-muted-foreground">top driver · {paretoTop.minutes}m</span>
              </div>
              <div className="mt-3 space-y-1.5">
                {pareto.slice(0, 5).map((p) => {
                  const pct = paretoTotal === 0 ? 0 : Math.round((p.minutes / paretoTotal) * 100);
                  return (
                    <div key={p.category}>
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="flex items-center gap-1.5">
                          <span className="h-2 w-2 rounded-sm" style={{ background: p.color }} />
                          <span className="text-muted-foreground">{p.label}</span>
                        </span>
                        <span className="font-mono text-foreground">
                          {p.minutes}m · {pct}%
                        </span>
                      </div>
                      <div className="mt-0.5 h-1.5 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${pct}%`, background: p.color }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </Link>


      {/* On-time WO completion → drill to work-order audit */}
      <Link to="/traceability" search={{ entity: "work_order", mode: "by_wo" }} className="glass-panel relative block overflow-hidden rounded-2xl p-5 transition hover:ring-1 hover:ring-primary/50">
        <div className="absolute inset-0 bg-gradient-to-br from-info/15 to-transparent" />
        <div className="relative">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold">On-time WO Completion</h3>
              <p className="text-xs text-muted-foreground">Completed at ≥98% of target qty · click for WO timelines →</p>
            </div>
            <CalendarCheck className="h-4 w-4 text-info" />
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="font-mono text-4xl font-semibold tracking-tight text-glow">{otd}</span>
            <span className="text-sm text-muted-foreground">%</span>
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {onTimeCount} of {completedCount} completed WOs met target
          </p>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-gradient-to-r from-info to-primary"
              style={{ width: `${otd}%` }}
            />
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 text-[11px] text-muted-foreground">
            <div>
              <div className="font-mono text-sm text-foreground">{completedCount}</div>
              <div>Completed</div>
            </div>
            <div>
              <div className="font-mono text-sm text-foreground">{running}</div>
              <div>Running</div>
            </div>
            <div>
              <div className="font-mono text-sm text-foreground">{scheduled}</div>
              <div>Scheduled</div>
            </div>
          </div>
        </div>
      </Link>

      </div>
    </div>
  );
}

