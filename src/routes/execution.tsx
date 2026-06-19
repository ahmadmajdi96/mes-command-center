import { createFileRoute } from "@tanstack/react-router";
import { recipeSteps, workOrders, sensorSeries } from "@/lib/mes-data";
import { CheckCircle2, Circle, PauseCircle, PlayCircle, ScanLine, ShieldAlert, ChevronRight } from "lucide-react";
import { StatusPill } from "@/components/status-pill";
import { Area, AreaChart, ResponsiveContainer, Tooltip } from "recharts";

export const Route = createFileRoute("/execution")({
  head: () => ({
    meta: [
      { title: "Operator Console · Cortanex MES" },
      { name: "description", content: "Guided operator workflow with recipe steps, captured values, CCP enforcement and live sensor readings." },
    ],
  }),
  component: Execution,
});

function Execution() {
  const wo = workOrders.find((w) => w.id === "WO-2401-118")!;
  const steps = recipeSteps;
  const active = steps.find((s) => s.status === "active");
  const completed = steps.filter((s) => s.status === "done").length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight">Operator Console</h1>
        <p className="text-sm text-muted-foreground">Touch-optimized step-by-step execution · offline resilient</p>
      </div>

      {/* Work order header */}
      <div className="glass-panel rounded-2xl p-5">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="font-mono">{wo.id}</span>
              <ChevronRight className="h-3 w-3" />
              <span>{wo.lineId} · Mixer Line A</span>
            </div>
            <h2 className="mt-1 text-xl font-semibold">{wo.product}</h2>
            <p className="text-xs text-muted-foreground">{wo.sku} · Lot LOT-GRA060-24A11 · Operator {wo.operator}</p>
          </div>
          <div className="flex gap-2">
            <button className="flex items-center gap-1.5 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-xs font-medium text-warning">
              <PauseCircle className="h-4 w-4" /> Pause
            </button>
            <button className="flex items-center gap-1.5 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive">
              <ShieldAlert className="h-4 w-4" /> Raise Hold
            </button>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-4">
          <Stat label="Step" value={`${completed + 1} / ${steps.length}`} />
          <Stat label="Target" value={`${wo.qtyTarget.toLocaleString()} ${wo.uom}`} />
          <Stat label="Produced" value={`${wo.qtyProduced.toLocaleString()}`} accent="primary" />
          <Stat label="Yield" value={`${wo.progress}%`} accent="success" />
        </div>

        <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-gradient-to-r from-primary via-info to-success" style={{ width: `${wo.progress}%` }} />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Steps list */}
        <div className="glass-panel rounded-2xl p-5 lg:col-span-2">
          <h3 className="mb-3 text-sm font-semibold">Recipe Steps</h3>
          <ol className="space-y-2">
            {steps.map((s) => {
              const isActive = s.status === "active";
              const isDone = s.status === "done";
              return (
                <li
                  key={s.id}
                  className={`rounded-xl border p-3 transition ${
                    isActive
                      ? "border-primary/50 bg-primary/5 shadow-[var(--shadow-glow)]"
                      : isDone
                      ? "border-success/30 bg-success/5"
                      : "border-border/60 bg-card/30"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-card/80 font-mono text-xs">
                      {isDone ? <CheckCircle2 className="h-4 w-4 text-success" /> : isActive ? <PlayCircle className="h-4 w-4 text-primary animate-pulse" /> : <Circle className="h-4 w-4 text-muted-foreground" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium">Step {s.sequence}. {s.instruction}</span>
                        <span className="font-mono text-[10px] text-muted-foreground">target {s.target}</span>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
                        <span>Tolerance {s.tolerance}</span>
                        {s.capturedValue && <span className="font-mono text-foreground">→ {s.capturedValue}</span>}
                      </div>
                      {isActive && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          <button className="flex items-center gap-1.5 rounded-lg bg-gradient-to-br from-primary to-info px-3 py-1.5 text-xs font-medium text-primary-foreground">
                            <CheckCircle2 className="h-3.5 w-3.5" /> Mark complete
                          </button>
                          <button className="flex items-center gap-1.5 rounded-lg border border-border/60 bg-card/60 px-3 py-1.5 text-xs">
                            <ScanLine className="h-3.5 w-3.5" /> Scan lot
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>

        {/* Live sensors */}
        <div className="space-y-4">
          <SensorCard title="Mixer Temperature" unit="°C" data={sensorSeries.temperature} target="65 ±2" />
          <SensorCard title="Vessel Pressure" unit="bar" data={sensorSeries.pressure} target="2.4 ±0.4" />
          <SensorCard title="Line Speed" unit="ppm" data={sensorSeries.speed} target="140 ±15" />

          <div className="glass-panel rounded-2xl p-4">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Active Step</h4>
            <p className="mt-2 text-sm font-medium">{active?.instruction}</p>
            <div className="mt-3 flex items-center gap-2">
              <StatusPill status="active" />
              <span className="font-mono text-xs">{active?.capturedValue}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: "primary" | "success" }) {
  const c = accent === "primary" ? "text-primary" : accent === "success" ? "text-success" : "text-foreground";
  return (
    <div className="rounded-xl border border-border/60 bg-card/40 p-3">
      <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{label}</div>
      <div className={`mt-1 font-mono text-xl font-semibold ${c}`}>{value}</div>
    </div>
  );
}

function SensorCard({ title, unit, data, target }: { title: string; unit: string; data: { t: string; v: number }[]; target: string }) {
  return (
    <div className="glass-panel rounded-2xl p-4">
      <div className="flex items-start justify-between">
        <div>
          <h4 className="text-xs font-semibold">{title}</h4>
          <p className="text-[10px] text-muted-foreground">Target {target}</p>
        </div>
        <span className="font-mono text-lg font-semibold text-primary">
          {data.at(-1)?.v}<span className="ml-0.5 text-[10px] text-muted-foreground">{unit}</span>
        </span>
      </div>
      <div className="mt-2 h-16">
        <ResponsiveContainer>
          <AreaChart data={data}>
            <defs>
              <linearGradient id={`sg-${title}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="oklch(0.78 0.16 195)" stopOpacity={0.5} />
                <stop offset="100%" stopColor="oklch(0.78 0.16 195)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <Area type="monotone" dataKey="v" stroke="oklch(0.78 0.16 195)" fill={`url(#sg-${title})`} strokeWidth={1.5} />
            <Tooltip contentStyle={{ background: "oklch(0.16 0.02 240 / 0.95)", border: "1px solid oklch(0.3 0.02 245)", borderRadius: 8, fontSize: 11 }} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
