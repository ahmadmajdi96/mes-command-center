import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
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
  CheckCircle2,
  Gauge,
  Package,
  Timer,
  TrendingUp,
  Zap,
} from "lucide-react";
import {
  andonAlerts,
  downtimeReasons,
  oeeTrend,
  plantKpis,
  sensorSeries,
} from "@/lib/mes-data";
import { useMes } from "@/lib/mes-store";
import { StatusPill } from "@/components/status-pill";

export const Route = createFileRoute("/")({
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
  const runningWOs = store.workOrders.filter((w) => w.status === "running");
  const lines = store.lines;
  const [clock, setClock] = useState<string>("");
  useEffect(() => {
    const update = () => setClock(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
    update();
    const id = setInterval(update, 30000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Control Center</h1>
          <p className="text-sm text-muted-foreground">Plant 01 — Riyadh · Shift A · <span suppressHydrationWarning>{clock}</span></p>
        </div>
        <div className="flex items-center gap-2">
          <button className="rounded-lg border border-border/60 bg-card/60 px-3 py-1.5 text-xs">Last 8h</button>
          <button className="rounded-lg border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary">Live</button>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Kpi label="Plant OEE" value={plantKpis.oee} suffix="%" delta="+3.2 vs yesterday" icon={Gauge} accent="primary" />
        <Kpi label="Availability" value={plantKpis.availability} suffix="%" icon={Timer} accent="info" />
        <Kpi label="Performance" value={plantKpis.performance} suffix="%" icon={TrendingUp} accent="accent" />
        <Kpi label="Quality" value={plantKpis.quality} suffix="%" icon={CheckCircle2} accent="success" />
        <Kpi label="Good Units" value={plantKpis.goodUnits.toLocaleString()} delta={`scrap ${plantKpis.scrap}`} icon={Package} accent="primary" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* OEE trend - 2 cols */}
        <div className="glass-panel rounded-2xl p-5 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold">OEE — Last 12 hours</h3>
              <p className="text-xs text-muted-foreground">Availability × Performance × Quality</p>
            </div>
            <div className="flex gap-3 text-[11px]">
              <Legend dot="bg-primary" label="OEE" />
              <Legend dot="bg-info" label="Availability" />
              <Legend dot="bg-accent" label="Performance" />
              <Legend dot="bg-success" label="Quality" />
            </div>
          </div>
          <div className="h-64">
            <ResponsiveContainer>
              <AreaChart data={oeeTrend}>
                <defs>
                  <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="oklch(0.78 0.16 195)" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="oklch(0.78 0.16 195)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.3 0.02 245 / 0.4)" />
                <XAxis dataKey="hour" stroke="oklch(0.68 0.02 245)" fontSize={11} />
                <YAxis stroke="oklch(0.68 0.02 245)" fontSize={11} domain={[40, 100]} />
                <Tooltip contentStyle={tooltipStyle} />
                <Area type="monotone" dataKey="oee" stroke="oklch(0.78 0.16 195)" fill="url(#g1)" strokeWidth={2} />
                <RLine type="monotone" dataKey="availability" stroke="oklch(0.72 0.14 230)" strokeWidth={1.5} dot={false} />
                <RLine type="monotone" dataKey="performance" stroke="oklch(0.82 0.17 80)" strokeWidth={1.5} dot={false} />
                <RLine type="monotone" dataKey="quality" stroke="oklch(0.72 0.18 155)" strokeWidth={1.5} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Radial OEE gauge */}
        <div className="glass-panel rounded-2xl p-5">
          <h3 className="text-sm font-semibold">Plant-wide OEE</h3>
          <p className="text-xs text-muted-foreground">Live composite score</p>
          <div className="relative mt-2 h-64">
            <ResponsiveContainer>
              <RadialBarChart innerRadius="60%" outerRadius="95%" data={[{ name: "oee", value: plantKpis.oee, fill: "oklch(0.78 0.16 195)" }]} startAngle={210} endAngle={-30}>
                <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
                <RadialBar dataKey="value" background={{ fill: "oklch(0.25 0.02 245)" }} cornerRadius={12} />
              </RadialBarChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="font-mono text-5xl font-semibold text-glow">{plantKpis.oee}</span>
              <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">OEE %</span>
              <div className="mt-3 flex gap-3 text-[10px] text-muted-foreground">
                <span>A {plantKpis.availability}</span>
                <span>P {plantKpis.performance}</span>
                <span>Q {plantKpis.quality}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Lines + Andon */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="glass-panel rounded-2xl p-5 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold">Lines · Live</h3>
              <p className="text-xs text-muted-foreground">{plantKpis.activeLines} of {plantKpis.totalLines} active</p>
            </div>
            <Link to="/lines" className="text-xs text-primary hover:underline">View all →</Link>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {lines.slice(0, 6).map((l) => (
              <div key={l.id} className="rounded-xl border border-border/60 bg-card/40 p-3">
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
                  <span className="text-muted-foreground">OEE</span>
                  <span className="font-mono font-medium">{l.oee}%</span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${l.oee}%`,
                      background:
                        l.oee >= 80
                          ? "var(--color-success)"
                          : l.oee >= 60
                          ? "var(--color-accent)"
                          : "var(--color-destructive)",
                    }}
                  />
                </div>
                <div className="mt-2 flex justify-between text-[10px] text-muted-foreground">
                  <span>{l.output.toLocaleString()} / {l.target.toLocaleString()}</span>
                  <span>↻ {l.uptime}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Andon feed */}
        <div className="glass-panel rounded-2xl p-5">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold">Andon Feed</h3>
              <p className="text-xs text-muted-foreground">{andonAlerts.filter(a => a.level !== 'info').length} active</p>
            </div>
            <Zap className="h-4 w-4 text-accent" />
          </div>
          <div className="space-y-2">
            {andonAlerts.map((a) => {
              const color = a.level === "critical" ? "border-destructive/40 bg-destructive/5" : a.level === "warn" ? "border-warning/40 bg-warning/5" : "border-border/60 bg-card/40";
              const icon = a.level === "critical" ? <AlertTriangle className="h-3.5 w-3.5 text-destructive" /> : a.level === "warn" ? <AlertTriangle className="h-3.5 w-3.5 text-warning" /> : <Activity className="h-3.5 w-3.5 text-info" />;
              return (
                <div key={a.id} className={`rounded-lg border p-2.5 ${color}`}>
                  <div className="flex items-start gap-2">
                    {icon}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-xs font-medium">{a.source}</span>
                        <span className="font-mono text-[10px] text-muted-foreground">{a.at}</span>
                      </div>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">{a.message}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Downtime Pareto */}
        <div className="glass-panel rounded-2xl p-5">
          <h3 className="text-sm font-semibold">Downtime — Pareto (today)</h3>
          <p className="text-xs text-muted-foreground">Minutes by reason</p>
          <div className="h-56">
            <ResponsiveContainer>
              <BarChart data={downtimeReasons} layout="vertical" margin={{ left: 10 }}>
                <XAxis type="number" stroke="oklch(0.68 0.02 245)" fontSize={11} />
                <YAxis type="category" dataKey="name" stroke="oklch(0.68 0.02 245)" fontSize={10} width={110} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                  {downtimeReasons.map((d, i) => (
                    <Cell key={i} fill={d.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Live sensor */}
        <div className="glass-panel rounded-2xl p-5">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-sm font-semibold">L-01 Mixer Temperature</h3>
              <p className="text-xs text-muted-foreground">Target 65°C · ±2°C</p>
            </div>
            <span className="font-mono text-xl font-semibold text-primary">{sensorSeries.temperature.at(-1)?.v}°C</span>
          </div>
          <div className="h-56">
            <ResponsiveContainer>
              <LineChart data={sensorSeries.temperature}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.3 0.02 245 / 0.4)" />
                <XAxis dataKey="t" stroke="oklch(0.68 0.02 245)" fontSize={10} />
                <YAxis stroke="oklch(0.68 0.02 245)" fontSize={10} domain={[55, 75]} />
                <Tooltip contentStyle={tooltipStyle} />
                <RLine type="monotone" dataKey="v" stroke="oklch(0.78 0.16 195)" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Downtime distribution donut */}
        <div className="glass-panel rounded-2xl p-5">
          <h3 className="text-sm font-semibold">Stoppage Mix</h3>
          <p className="text-xs text-muted-foreground">Share of downtime minutes</p>
          <div className="h-56">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={downtimeReasons} dataKey="value" innerRadius={50} outerRadius={80} paddingAngle={2}>
                  {downtimeReasons.map((d, i) => <Cell key={i} fill={d.color} />)}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-1 text-[11px]">
            {downtimeReasons.map((d) => (
              <div key={d.name} className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-sm" style={{ background: d.color }} />
                  <span className="text-muted-foreground">{d.name}</span>
                </span>
                <span className="font-mono">{d.value}m</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Active WOs */}
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
                <tr key={w.id} className="border-t border-border/40">
                  <td className="py-3 pr-4 font-mono text-xs">{w.id}</td>
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
    </div>
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
