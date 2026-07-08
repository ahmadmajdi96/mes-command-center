import { createFileRoute, Link } from "@tanstack/react-router";
import { useMes } from "@/lib/mes-store";
import type { ProductionLine } from "@/lib/mes-data";
import { StatusPill } from "@/components/status-pill";
import { ResponsiveContainer, RadialBar, RadialBarChart, PolarAngleAxis } from "recharts";
import { Factory, Plus, Pencil, ArrowRight, Cpu, Hand } from "lucide-react";
import { EntityFormDialog, type Field } from "@/components/crud/entity-form-dialog";
import { ConfirmDelete } from "@/components/crud/confirm-delete";

export const Route = createFileRoute("/lines/")({
  head: () => ({
    meta: [
      { title: "Production Lines · Cortanex MES" },
      { name: "description", content: "Create, edit and monitor production lines — OEE breakdown, stations and live flow." },
    ],
  }),
  component: LinesPage,
});

const lineFields: Field[] = [
  { name: "id", label: "Line ID", type: "text", placeholder: "L-07", required: true },
  { name: "name", label: "Name", type: "text", required: true },
  { name: "plant", label: "Plant", type: "text", required: true, span: 2 },
  { name: "status", label: "Status", type: "select", required: true, options: [
    { value: "running", label: "running" },
    { value: "idle", label: "idle" },
    { value: "down", label: "down" },
    { value: "changeover", label: "changeover" },
  ]},
  { name: "uptime", label: "Uptime", type: "text", placeholder: "0h 00m" },
  { name: "product", label: "Current Product", type: "text", span: 2 },
  { name: "currentWorkOrder", label: "Current WO", type: "text" },
  { name: "oee", label: "OEE %", type: "number" },
  { name: "availability", label: "Availability %", type: "number" },
  { name: "performance", label: "Performance %", type: "number" },
  { name: "quality", label: "Quality %", type: "number" },
  { name: "output", label: "Output", type: "number" },
  { name: "target", label: "Target", type: "number" },
];

function LinesPage() {
  const store = useMes();
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Production Lines</h1>
          <p className="text-sm text-muted-foreground">
            All plants · {store.lines.length} lines · {store.stations.length} stations monitored
          </p>
        </div>
        <EntityFormDialog<ProductionLine>
          title="New Production Line"
          fields={lineFields}
          initial={{ status: "idle", oee: 0, availability: 0, performance: 0, quality: 0, output: 0, target: 0, uptime: "—" } as any}
          onSubmit={(v) => store.createLine(v as any)}
          trigger={
            <button className="flex items-center gap-1.5 rounded-lg bg-gradient-to-br from-primary to-info px-3 py-1.5 text-xs font-medium text-primary-foreground shadow-[var(--shadow-glow)]">
              <Plus className="h-3.5 w-3.5" /> New Line
            </button>
          }
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {store.lines.map((l) => {
          const lineStations = store.stations
            .filter((s) => s.lineId === l.id)
            .sort((a, b) => a.sequence - b.sequence);
          const autoCount = lineStations.filter((s) => s.type === "automatic").length;

          return (
            <div key={l.id} className="glass-panel rounded-2xl p-5">
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Factory className="h-3.5 w-3.5" />
                    <span className="font-mono">{l.id}</span>
                    <span>·</span>
                    <span className="truncate">{l.plant}</span>
                  </div>
                  <h3 className="mt-1 truncate text-lg font-semibold">{l.name}</h3>
                  <p className="truncate text-xs text-muted-foreground">{l.product ?? "— no work order —"}</p>
                </div>
                <StatusPill status={l.status} />
              </div>

              <div className="mt-4 grid grid-cols-[auto_minmax(0,1fr)] items-center gap-4">
                <div className="relative h-24 w-24">
                  <ResponsiveContainer>
                    <RadialBarChart innerRadius="65%" outerRadius="100%" data={[{ value: l.oee, fill: "oklch(0.78 0.16 195)" }]} startAngle={90} endAngle={-270}>
                      <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
                      <RadialBar dataKey="value" background={{ fill: "oklch(0.25 0.02 245)" }} cornerRadius={10} />
                    </RadialBarChart>
                  </ResponsiveContainer>
                  <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                    <span className="font-mono text-lg font-semibold">{l.oee}</span>
                    <span className="text-[9px] uppercase text-muted-foreground">OEE</span>
                  </div>
                </div>
                <div className="space-y-1.5 text-xs">
                  <Row label="Availability" value={l.availability} />
                  <Row label="Performance" value={l.performance} />
                  <Row label="Quality" value={l.quality} />
                </div>
              </div>

              {/* Mini station flow */}
              <div className="mt-4 rounded-xl border border-border/40 bg-background/40 p-2">
                <div className="mb-1.5 flex items-center justify-between text-[10px] uppercase tracking-wider text-muted-foreground">
                  <span>Station flow · {lineStations.length}</span>
                  <span className="flex items-center gap-1"><Cpu className="h-3 w-3 text-primary" /> {autoCount} auto · <Hand className="h-3 w-3 text-accent" /> {lineStations.length - autoCount} manual</span>
                </div>
                <div className="flex items-center gap-1 overflow-x-auto">
                  {lineStations.length === 0 && (
                    <span className="px-2 py-1 text-[11px] text-muted-foreground">No stations configured</span>
                  )}
                  {lineStations.map((s, idx) => (
                    <div key={s.id} className="flex items-center gap-1">
                      <div
                        className={`grid h-9 min-w-9 place-items-center rounded-md border px-2 text-[10px] font-mono ${
                          s.status === "running"
                            ? "border-success/40 bg-success/10 text-success"
                            : s.status === "down"
                            ? "border-destructive/40 bg-destructive/10 text-destructive"
                            : s.status === "maintenance"
                            ? "border-warning/40 bg-warning/10 text-warning"
                            : "border-border/60 bg-card/60 text-muted-foreground"
                        }`}
                        title={`${s.name} (${s.type})`}
                      >
                        {s.type === "automatic" ? <Cpu className="mr-1 h-3 w-3" /> : <Hand className="mr-1 h-3 w-3" />}
                        {s.sequence}
                      </div>
                      {idx < lineStations.length - 1 && <ArrowRight className="h-3 w-3 text-muted-foreground/60" />}
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-4 border-t border-border/40 pt-3 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Current WO</span>
                  <span className="font-mono">{l.currentWorkOrder ?? "—"}</span>
                </div>
                <div className="mt-1 flex justify-between">
                  <span className="text-muted-foreground">Output</span>
                  <span className="font-mono">{l.output.toLocaleString()} / {l.target.toLocaleString()}</span>
                </div>
                <div className="mt-1 flex justify-between">
                  <span className="text-muted-foreground">Uptime</span>
                  <span className="font-mono">{l.uptime}</span>
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between gap-1.5">
                <Link
                  to="/lines/$lineId"
                  params={{ lineId: l.id }}
                  className="inline-flex items-center gap-1 rounded-lg border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20"
                >
                  Open live view <ArrowRight className="h-3 w-3" />
                </Link>
                <div className="flex gap-1.5">
                  <EntityFormDialog<ProductionLine>
                    title="Edit Line"
                    fields={lineFields}
                    initial={l}
                    onSubmit={(v) => store.updateLine(l.id, v)}
                    trigger={
                      <button className="grid h-8 w-8 place-items-center rounded-lg border border-border/60 bg-card/60 text-muted-foreground hover:border-primary/40 hover:text-primary">
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                    }
                  />
                  <ConfirmDelete label={`Delete ${l.id}`} onConfirm={() => store.deleteLine(l.id)} />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="flex justify-between">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-mono">{value}%</span>
      </div>
      <div className="mt-1 h-1 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-gradient-to-r from-primary to-info" style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}
