import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMes } from "@/lib/mes-store";
import type { LineStatus, ProductionLine } from "@/lib/mes-data";
import { StatusPill } from "@/components/status-pill";
import { ResponsiveContainer, RadialBar, RadialBarChart, PolarAngleAxis } from "recharts";
import { Factory, Plus, Pencil, ArrowRight, Cpu, Hand, SlidersHorizontal } from "lucide-react";
import { EntityFormDialog, type Field } from "@/components/crud/entity-form-dialog";
import { ConfirmDelete } from "@/components/crud/confirm-delete";
import { useListControls } from "@/components/list-controls";
import { LineOperatorAssignments } from "@/components/line-operator-assignments";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/lines/")({
  head: () => ({
    meta: [
      { title: "Production Lines · Cortanex MES" },
      { name: "description", content: "Create, search, export and monitor production lines, stations, work orders and assigned operators." },
      { property: "og:title", content: "Production Lines · Cortanex MES" },
      { property: "og:description", content: "Create, search, export and monitor production lines, stations, work orders and assigned operators." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LinesPage,
});

const createFields: Field[] = [
  { name: "name", label: "Line name", type: "text", required: true, span: 2, placeholder: "Primary Packaging Line", description: "A clear shop-floor name. The line ID is generated automatically." },
  { name: "plant", label: "Plant", type: "text", required: true, span: 2, placeholder: "Plant 01 — Riyadh", description: "The facility where this line operates." },
  { name: "status", label: "Initial status", type: "select", required: true, description: "Set the line's state when it is first created.", options: [
    { value: "running", label: "Running" }, { value: "idle", label: "Idle" },
    { value: "down", label: "Down" }, { value: "changeover", label: "Changeover" },
  ] },
  { name: "target", label: "Production target", type: "number", required: true, description: "Planned quantity for the active production window." },
];

const editFields: Field[] = [
  { name: "name", label: "Line name", type: "text", required: true, span: 2 },
  { name: "plant", label: "Plant", type: "text", required: true, span: 2 },
  { name: "status", label: "Status", type: "select", required: true, options: [
    { value: "running", label: "Running" }, { value: "idle", label: "Idle" },
    { value: "down", label: "Down" }, { value: "changeover", label: "Changeover" },
  ] },
  { name: "target", label: "Production target", type: "number", required: true },
];

function LinesPage() {
  const store = useMes();
  const [plant, setPlant] = useState("all");
  const [status, setStatus] = useState<"all" | LineStatus>("all");
  const [workOrder, setWorkOrder] = useState("all");
  const plants = useMemo(() => [...new Set(store.lines.map((line) => line.plant))].sort(), [store.lines]);
  const filtered = useMemo(() => store.lines.filter((line) =>
    (plant === "all" || line.plant === plant) &&
    (status === "all" || line.status === status) &&
    (workOrder === "all" || (workOrder === "active" ? Boolean(line.currentWorkOrder) : !line.currentWorkOrder)),
  ), [store.lines, plant, status, workOrder]);
  const lc = useListControls(filtered, {
    searchKeys: ["id", "name", "plant", "status", "currentWorkOrder", "product"],
    exportName: "production-lines",
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Production Lines</h1>
          <p className="text-sm text-muted-foreground">{store.lines.length} lines · {store.stations.length} stations monitored · {lc.filtered.length} shown</p>
        </div>
        <EntityFormDialog<ProductionLine>
          title="New Production Line"
          description="Live performance values are populated by the connected external service."
          fields={createFields}
          initial={{ status: "idle", target: 0 } as any}
          onSubmit={(values) => store.createLine({
            name: values.name,
            plant: values.plant,
            status: values.status,
            target: Number(values.target) || 0,
            oee: 0,
            availability: 0,
            performance: 0,
            quality: 0,
            output: 0,
            uptime: "—",
          })}
          trigger={<Button size="sm"><Plus /> New Line</Button>}
        />
      </div>

      {lc.toolbar}
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border/60 bg-card/40 p-3">
        <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
        <select value={plant} onChange={(event) => setPlant(event.target.value)} aria-label="Filter by plant" className="h-9 min-w-48 rounded-md border border-border/60 bg-background px-2 text-xs">
          <option value="all">All plants</option>
          {plants.map((value) => <option key={value} value={value}>{value}</option>)}
        </select>
        <select value={status} onChange={(event) => setStatus(event.target.value as "all" | LineStatus)} aria-label="Filter by status" className="h-9 rounded-md border border-border/60 bg-background px-2 text-xs">
          <option value="all">All statuses</option>
          <option value="running">Running</option><option value="idle">Idle</option><option value="down">Down</option><option value="changeover">Changeover</option>
        </select>
        <select value={workOrder} onChange={(event) => setWorkOrder(event.target.value)} aria-label="Filter by work order" className="h-9 rounded-md border border-border/60 bg-background px-2 text-xs">
          <option value="all">All work-order states</option><option value="active">With current WO</option><option value="none">Without current WO</option>
        </select>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {lc.visible.map((line) => {
          const lineStations = store.stations.filter((station) => station.lineId === line.id).sort((a, b) => a.sequence - b.sequence);
          const automatic = lineStations.filter((station) => station.type === "automatic").length;
          const linkedWorkOrder = store.workOrders.find((order) => order.id === line.currentWorkOrder);
          return (
            <article key={line.id} className="glass-panel rounded-lg p-5">
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground"><Factory className="h-3.5 w-3.5" /><span className="font-mono">{line.id}</span><span>·</span><span className="truncate">{line.plant}</span></div>
                  <h2 className="mt-1 truncate text-lg font-semibold">{line.name}</h2>
                  <p className="truncate text-xs text-muted-foreground">{line.product ?? "— no work order —"}</p>
                </div>
                <StatusPill status={line.status} />
              </div>

              <div className="mt-4 grid grid-cols-[auto_minmax(0,1fr)] items-center gap-4">
                <div className="relative h-24 w-24">
                  <ResponsiveContainer><RadialBarChart innerRadius="65%" outerRadius="100%" data={[{ value: line.oee, fill: "var(--color-primary)" }]} startAngle={90} endAngle={-270}><PolarAngleAxis type="number" domain={[0, 100]} tick={false} /><RadialBar dataKey="value" background={{ fill: "var(--color-muted)" }} cornerRadius={8} /></RadialBarChart></ResponsiveContainer>
                  <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center"><span className="font-mono text-lg font-semibold">{line.oee}</span><span className="text-[9px] uppercase text-muted-foreground">OEE</span></div>
                </div>
                <div className="space-y-1.5 text-xs"><Metric label="Availability" value={line.availability} /><Metric label="Performance" value={line.performance} /><Metric label="Quality" value={line.quality} /></div>
              </div>

              <div className="mt-4 rounded-lg border border-border/40 bg-background/40 p-2">
                <div className="mb-1.5 flex items-center justify-between text-[10px] uppercase text-muted-foreground"><span>Station flow · {lineStations.length}</span><span className="flex items-center gap-1"><Cpu className="h-3 w-3 text-primary" /> {automatic} auto · <Hand className="h-3 w-3 text-accent" /> {lineStations.length - automatic} manual</span></div>
                <div className="flex items-center gap-1 overflow-x-auto">{lineStations.length === 0 && <span className="px-2 py-1 text-[11px] text-muted-foreground">No stations configured</span>}{lineStations.map((station, index) => <div key={station.id} className="flex items-center gap-1"><div className="grid h-9 min-w-9 place-items-center rounded-md border border-border/60 bg-card/60 px-2 text-[10px] font-mono" title={`${station.name} (${station.type})`}>{station.sequence}</div>{index < lineStations.length - 1 && <ArrowRight className="h-3 w-3 text-muted-foreground/60" />}</div>)}</div>
              </div>

              <div className="mt-4 border-t border-border/40 pt-3 text-xs">
                <div className="flex justify-between gap-3"><span className="text-muted-foreground">Current WO</span>{linkedWorkOrder ? <Link to="/work-orders/$woId" params={{ woId: linkedWorkOrder.id }} className="font-mono text-primary hover:underline">{linkedWorkOrder.id}</Link> : <span className="font-mono text-muted-foreground" title={line.currentWorkOrder ? "Work-order profile is unavailable" : undefined}>{line.currentWorkOrder ?? "—"}</span>}</div>
                <div className="mt-1 flex justify-between"><span className="text-muted-foreground">Output</span><span className="font-mono">{line.output.toLocaleString()} / {line.target.toLocaleString()}</span></div>
              </div>

              <LineOperatorAssignments lineId={line.id} compact />

              <div className="mt-3 flex items-center justify-between gap-2">
                <Button asChild size="sm" variant="outline"><Link to="/lines/$lineId" params={{ lineId: line.id }}>Open live view <ArrowRight /></Link></Button>
                <div className="flex gap-1.5">
                  <EntityFormDialog<ProductionLine> title="Edit Line" fields={editFields} initial={line} onSubmit={(values) => store.updateLine(line.id, values)} trigger={<Button size="icon" variant="outline" title={`Edit ${line.name}`}><Pencil /></Button>} />
                  <ConfirmDelete label={`Delete ${line.id}`} onConfirm={() => store.deleteLine(line.id)} />
                </div>
              </div>
            </article>
          );
        })}
        {lc.visible.length === 0 && <div className="col-span-full rounded-lg border border-dashed border-border/60 p-10 text-center text-sm text-muted-foreground">No production lines match these filters.</div>}
      </div>
      {lc.pager}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return <div><div className="flex justify-between"><span className="text-muted-foreground">{label}</span><span className="font-mono">{value}%</span></div><div className="mt-1 h-1 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(0, Math.min(100, value))}%` }} /></div></div>;
}