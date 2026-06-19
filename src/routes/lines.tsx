import { createFileRoute } from "@tanstack/react-router";
import { useMes } from "@/lib/mes-store";
import type { ProductionLine } from "@/lib/mes-data";
import { StatusPill } from "@/components/status-pill";
import { ResponsiveContainer, RadialBar, RadialBarChart, PolarAngleAxis } from "recharts";
import { Factory, Plus, Pencil } from "lucide-react";
import { EntityFormDialog, type Field } from "@/components/crud/entity-form-dialog";
import { ConfirmDelete } from "@/components/crud/confirm-delete";

export const Route = createFileRoute("/lines")({
  head: () => ({
    meta: [
      { title: "Production Lines · Cortanex MES" },
      { name: "description", content: "Create, edit and monitor production lines — OEE breakdown, current work order and output." },
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
          <p className="text-sm text-muted-foreground">All plants · {store.lines.length} lines monitored</p>
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
        {store.lines.map((l) => (
          <div key={l.id} className="glass-panel rounded-2xl p-5">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Factory className="h-3.5 w-3.5" />
                  <span className="font-mono">{l.id}</span>
                  <span>·</span>
                  <span className="truncate">{l.plant}</span>
                </div>
                <h3 className="mt-1 text-lg font-semibold truncate">{l.name}</h3>
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

            <div className="mt-3 flex justify-end gap-1.5">
              <EntityFormDialog<ProductionLine>
                title="Edit Line"
                fields={lineFields}
                initial={l}
                onSubmit={(v) => store.updateLine(l.id, v)}
                trigger={
                  <button className="grid h-8 w-8 place-items-center rounded-lg border border-border/60 bg-card/60 text-muted-foreground hover:text-primary hover:border-primary/40">
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                }
              />
              <ConfirmDelete label={`Delete ${l.id}`} onConfirm={() => store.deleteLine(l.id)} />
            </div>
          </div>
        ))}
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
