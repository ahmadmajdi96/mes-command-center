import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMes } from "@/lib/mes-store";
import type { Station, CommProtocol, StationStatus, StationType, DowntimeEvent, StepTemplate } from "@/lib/mes-data";
import { StatusPill } from "@/components/status-pill";
import {
  Factory, ArrowLeft, ArrowRight, Cpu, Hand, Plus, Pencil, Network, Wifi,
  Activity, User as UserIcon, Gauge, Clock, AlertTriangle, AlertOctagon, ShieldAlert,
  ListChecks, Radio, X,
} from "lucide-react";
import { EntityFormDialog, type Field } from "@/components/crud/entity-form-dialog";
import { ConfirmDelete } from "@/components/crud/confirm-delete";
import { toast } from "sonner";

export const Route = createFileRoute("/lines/$lineId")({
  head: ({ params }) => ({
    meta: [
      { title: `Line ${params.lineId} · Live View · Cortanex MES` },
      { name: "description", content: "Live production line view with stations, machines and assigned operators." },
    ],
  }),
  component: LineDetailPage,
  notFoundComponent: () => (
    <div className="grid place-items-center p-12 text-sm text-muted-foreground">Line not found.</div>
  ),
  errorComponent: ({ error }) => (
    <div className="grid place-items-center p-12 text-sm text-destructive">{error.message}</div>
  ),
});

const protocols: CommProtocol[] = ["OPC-UA", "MQTT", "Modbus-TCP", "EtherNet/IP", "Profinet", "REST"];

const baseStationFields = (lineId: string, templates: { id: string; name: string }[]): Field[] => [
  { name: "id", label: "Station ID", type: "text", placeholder: "ST-110", required: true },
  { name: "name", label: "Name", type: "text", required: true },
  { name: "sequence", label: "Sequence # (same number = parallel station in same step)", type: "number", required: true },
  { name: "type", label: "Type", type: "select", required: true, options: [
    { value: "manual", label: "Manual (operator)" },
    { value: "automatic", label: "Automatic (machine)" },
  ]},
  { name: "status", label: "Status", type: "select", required: true, options: [
    { value: "running", label: "running" },
    { value: "idle", label: "idle" },
    { value: "down", label: "down" },
    { value: "maintenance", label: "maintenance" },
  ]},
  { name: "cycleTimeSec", label: "Cycle time (s)", type: "number" },
  { name: "currentStep", label: "Current step", type: "text", span: 2 },
  { name: "currentValue", label: "Current value", type: "text" },
  { name: "target", label: "Target", type: "text" },
  { name: "oee", label: "OEE %", type: "number" },
  { name: "lineId", label: "Line ID", type: "text", placeholder: lineId },

  { name: "templateIds", label: "Step templates (select at least one)", type: "multiselect", span: 2,
    section: "Step templates", required: true, minSelected: 1,
    options: templates.map((t) => ({ value: t.id, label: `${t.id} · ${t.name}` })) },

  { name: "machine_model", label: "Machine model", type: "text", section: "Machine (automatic only)",
    visibleWhen: { field: "type", equals: "automatic" } },
  { name: "machine_vendor", label: "Vendor", type: "text",
    visibleWhen: { field: "type", equals: "automatic" } },
  { name: "machine_ipAddress", label: "IP address", type: "text", placeholder: "10.0.0.10",
    visibleWhen: { field: "type", equals: "automatic" } },
  { name: "machine_port", label: "Port", type: "number", placeholder: "4840",
    visibleWhen: { field: "type", equals: "automatic" } },
  { name: "machine_protocol", label: "Protocol", type: "select",
    options: protocols.map((p) => ({ value: p, label: p })),
    visibleWhen: { field: "type", equals: "automatic" } },
  { name: "machine_firmware", label: "Firmware", type: "text",
    visibleWhen: { field: "type", equals: "automatic" } },
  { name: "machine_receivedDataTypes", label: "Received data types (comma list)", type: "textarea", span: 2,
    placeholder: "temp_c,pressure_bar,rpm,vibration",
    visibleWhen: { field: "type", equals: "automatic" } },
  { name: "machine_sentDataTypes", label: "Sent data types (comma list)", type: "textarea", span: 2,
    placeholder: "setpoint_rpm,recipe_id,start,stop",
    visibleWhen: { field: "type", equals: "automatic" } },

  { name: "machine_outputKind", label: "Output kind", type: "select",
    section: "Output (automatic only)",
    options: [
      { value: "none", label: "No output" },
      { value: "text", label: "Text (e.g. PASS/FAIL, reading)" },
      { value: "file", label: "File (e.g. inspection image, report)" },
    ],
    visibleWhen: { field: "type", equals: "automatic" } },
  { name: "machine_outputLabel", label: "Output label / filename pattern", type: "text",
    placeholder: "inspection_{lot}.png",
    visibleWhen: { field: "type", equals: "automatic" } },
  { name: "machine_outputProtocol", label: "Decision protocol", type: "select",
    options: protocols.map((p) => ({ value: p, label: p })),
    visibleWhen: { field: "type", equals: "automatic" } },
  { name: "machine_acceptCommand", label: "Accept command", type: "text", placeholder: "ACK / PASS",
    visibleWhen: { field: "type", equals: "automatic" } },
  { name: "machine_rejectCommand", label: "Reject command", type: "text", placeholder: "NAK / REJECT",
    visibleWhen: { field: "type", equals: "automatic" } },
];

function toFlat(s: Partial<Station>) {
  return {
    ...s,
    templateIds: s.templateIds ?? [],
    machine_model: s.machine?.model ?? "",
    machine_vendor: s.machine?.vendor ?? "",
    machine_ipAddress: s.machine?.ipAddress ?? "",
    machine_port: s.machine?.port ?? 4840,
    machine_protocol: s.machine?.protocol ?? "OPC-UA",
    machine_firmware: s.machine?.firmware ?? "",
    machine_receivedDataTypes: s.machine?.receivedDataTypes ?? "",
    machine_sentDataTypes: s.machine?.sentDataTypes ?? "",
    machine_outputKind: s.machine?.outputKind ?? "none",
    machine_outputLabel: s.machine?.outputLabel ?? "",
    machine_outputProtocol: s.machine?.outputProtocol ?? "REST",
    machine_acceptCommand: s.machine?.acceptCommand ?? "",
    machine_rejectCommand: s.machine?.rejectCommand ?? "",
  } as any;
}

function fromFlat(v: any, lineId: string): Station {
  const base: Station = {
    id: v.id,
    lineId: v.lineId || lineId,
    name: v.name,
    sequence: Number(v.sequence) || 1,
    type: v.type as StationType,
    status: v.status as StationStatus,
    cycleTimeSec: Number(v.cycleTimeSec) || 0,
    currentStep: v.currentStep || undefined,
    currentValue: v.currentValue || undefined,
    target: v.target || undefined,
    oee: Number(v.oee) || 0,
    templateIds: Array.isArray(v.templateIds) ? v.templateIds : [],
  };
  if (v.type === "automatic") {
    base.machine = {
      model: v.machine_model,
      vendor: v.machine_vendor,
      ipAddress: v.machine_ipAddress,
      port: Number(v.machine_port) || 4840,
      protocol: v.machine_protocol as CommProtocol,
      receivedDataTypes: v.machine_receivedDataTypes,
      sentDataTypes: v.machine_sentDataTypes,
      firmware: v.machine_firmware,
      outputKind: v.machine_outputKind || "none",
      outputLabel: v.machine_outputLabel || undefined,
      outputProtocol: v.machine_outputProtocol as CommProtocol,
      acceptCommand: v.machine_acceptCommand || undefined,
      rejectCommand: v.machine_rejectCommand || undefined,
    };
  }
  return base;
}

function LineDetailPage() {
  const { lineId } = Route.useParams();
  const store = useMes();
  const line = store.lines.find((l) => l.id === lineId);
  if (!line) throw notFound();

  const lineStations = useMemo(
    () => store.stations.filter((s) => s.lineId === lineId).sort((a, b) => a.sequence - b.sequence),
    [store.stations, lineId],
  );

  // Group stations by sequence — same sequence = parallel stations in the same step
  const stepsGrouped = useMemo(() => {
    const map = new Map<number, Station[]>();
    for (const s of lineStations) {
      const arr = map.get(s.sequence) ?? [];
      arr.push(s);
      map.set(s.sequence, arr);
    }
    return [...map.entries()].sort((a, b) => a[0] - b[0]);
  }, [lineStations]);

  const stationFields = baseStationFields(lineId, store.stepTemplates);

  // Resolve assignments → user(s) per station/team — recomputes on every assignment change
  const stationOperators = (stationId: string) =>
    store.assignments
      .filter((a) => a.active && a.targetType === "station" && a.targetId === stationId)
      .map((a) => store.users.find((u) => u.id === a.userId))
      .filter(Boolean);

  // Open downtime (live) per station + line-wide
  const lineDowntime = useMemo(
    () => store.downtime.filter((d) => d.lineId === lineId),
    [store.downtime, lineId],
  );
  const openByStation = useMemo(() => {
    const m: Record<string, DowntimeEvent[]> = {};
    for (const d of lineDowntime) {
      if (d.status !== "open" || !d.stationId) continue;
      (m[d.stationId] ??= []).push(d);
    }
    return m;
  }, [lineDowntime]);
  const openLineWide = lineDowntime.filter((d) => d.status === "open" && !d.stationId);

  // Last tick across this line — proves the live update path is wired
  const lastTick = useMemo(() => {
    const ticks = lineStations.map((s) => s.lastTickAt).filter(Boolean) as string[];
    return ticks.sort().at(-1);
  }, [lineStations]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link to="/lines" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-3 w-3" /> All lines
          </Link>
          <div className="mt-1 flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-primary to-info text-primary-foreground shadow-[var(--shadow-glow)]">
              <Factory className="h-5 w-5" />
            </div>
            <div>
              <h1 className="font-display text-2xl font-semibold tracking-tight">{line.name}</h1>
              <p className="text-xs text-muted-foreground">
                <span className="font-mono">{line.id}</span> · {line.plant} · {line.product ?? "no product"}
              </p>
            </div>
            <StatusPill status={line.status} />
          </div>
        </div>
        <EntityFormDialog<Station>
          title={`Add Station to ${line.name}`}
          fields={stationFields}
          initial={toFlat({ lineId, type: "manual", status: "idle", sequence: lineStations.length + 1, oee: 0, cycleTimeSec: 0 })}
          onSubmit={(v) => store.createStation(fromFlat(v, lineId) as any)}
          trigger={
            <button className="flex items-center gap-1.5 rounded-lg bg-gradient-to-br from-primary to-info px-3 py-1.5 text-xs font-medium text-primary-foreground shadow-[var(--shadow-glow)]">
              <Plus className="h-3.5 w-3.5" /> Add station
            </button>
          }
        />
      </div>

      {/* KPI strip */}
      <div className="grid gap-3 sm:grid-cols-4">
        <KPI label="OEE" value={`${line.oee}%`} icon={<Gauge className="h-4 w-4" />} accent="primary" />
        <KPI label="Output / Target" value={`${line.output.toLocaleString()} / ${line.target.toLocaleString()}`} icon={<Activity className="h-4 w-4" />} accent="info" />
        <KPI label="Uptime" value={line.uptime} icon={<Clock className="h-4 w-4" />} accent="success" />
        <KPI label="Stations" value={`${lineStations.length}`} icon={<Cpu className="h-4 w-4" />} accent="accent" />
      </div>

      {/* Open downtime banner (line-wide + summary) */}
      {(openLineWide.length > 0 || Object.keys(openByStation).length > 0) && (
        <div className="glass-panel rounded-2xl border border-destructive/30 bg-destructive/5 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-destructive">
            <AlertOctagon className="h-4 w-4" />
            {lineDowntime.filter((d) => d.status === "open").length} open downtime event{lineDowntime.filter((d) => d.status === "open").length === 1 ? "" : "s"} on this line
          </div>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {[...openLineWide, ...Object.values(openByStation).flat()].map((d) => {
              const st = d.stationId ? store.stations.find((s) => s.id === d.stationId) : null;
              return (
                <div key={d.id} className="flex items-start justify-between gap-2 rounded-lg border border-destructive/30 bg-background/40 p-2 text-xs">
                  <div className="min-w-0">
                    <div className="font-medium">{d.reasonCode}</div>
                    <div className="font-mono text-[11px] text-muted-foreground">
                      {st ? `${st.id} · ${st.name}` : "line-wide"} · since {d.startedAt} · {d.durationMin}m
                      {d.operatorName ? ` · ${d.operatorName}` : ""}
                    </div>
                    {d.notes && <div className="mt-1 text-[11px] text-muted-foreground">{d.notes}</div>}
                  </div>
                  <button
                    onClick={() => { store.updateDowntime(d.id, { status: "resolved" }); toast.success(`Resolved ${d.id}`); }}
                    className="rounded-md border border-success/40 bg-success/10 px-2 py-0.5 text-[10px] font-medium text-success hover:bg-success/20"
                  >
                    Resolve
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Flow visualization */}
      <div className="glass-panel rounded-2xl p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold tracking-tight">Live station flow</h2>
          <div className="flex items-center gap-3 text-[10px] uppercase tracking-wider text-muted-foreground">
            <span className="flex items-center gap-1 text-success">
              <Radio className="h-3 w-3 animate-pulse" /> live{lastTick ? ` · ${lastTick}` : ""}
            </span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-success" /> running</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-warning" /> idle/maint.</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-destructive" /> down</span>
          </div>
        </div>

        {lineStations.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/60 p-10 text-center text-sm text-muted-foreground">
            No stations yet. Click <span className="text-foreground">Add station</span> to design this line.
          </div>
        ) : (
          <div className="relative overflow-x-auto pb-2">
            <div className="flex min-w-max items-stretch gap-3">
              {lineStations.map((s, idx) => {
                const operators = stationOperators(s.id);
                return (
                  <div key={s.id} className="flex items-stretch gap-3">
                    <StationCard
                      station={s}
                      operatorNames={operators.map((o) => o!.name)}
                      templates={(s.templateIds ?? []).map((id) => store.stepTemplates.find((t) => t.id === id)).filter(Boolean) as StepTemplate[]}
                      openDowntime={openByStation[s.id] ?? []}
                      onEdit={(patch) => store.updateStation(s.id, patch)}
                      onDelete={() => store.deleteStation(s.id)}
                      onRemoveTemplate={(tid) => store.removeTemplateFromStation(s.id, tid)}
                      onLogDowntime={(reason, category, durationMin) => {
                        const activeAsmt = store.assignments.find((a) => a.active && a.targetType === "station" && a.targetId === s.id);
                        const op = activeAsmt ? store.users.find((u) => u.id === activeAsmt.userId) : undefined;
                        store.createDowntime({
                          lineId,
                          lineName: line.name,
                          stationId: s.id,
                          assignmentId: activeAsmt?.id,
                          operatorId: op?.id,
                          operatorName: op?.name,
                          reasonCode: reason,
                          category,
                          startedAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
                          durationMin,
                          status: "open",
                        });
                        store.updateStation(s.id, { status: category === "equipment_failure" ? "down" : s.status });
                        toast.error(`Downtime logged on ${s.id}`);
                      }}
                      fields={stationFields}
                      lineId={lineId}
                    />
                    {idx < lineStations.length - 1 && (
                      <div className="flex w-6 items-center justify-center">
                        <div className="relative h-px w-full bg-gradient-to-r from-primary/60 to-info/60">
                          <ArrowRight className="absolute -right-1 -top-2 h-4 w-4 text-primary" />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Station table — config view */}
      <div className="glass-panel rounded-2xl p-5">
        <h2 className="mb-3 font-display text-lg font-semibold tracking-tight">Stations · configuration</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-[10px] uppercase tracking-wider text-muted-foreground">
              <tr className="border-b border-border/60">
                <th className="px-3 py-2 text-left">#</th>
                <th className="px-3 py-2 text-left">Station</th>
                <th className="px-3 py-2 text-left">Type</th>
                <th className="px-3 py-2 text-left">Machine</th>
                <th className="px-3 py-2 text-left">Comms</th>
                <th className="px-3 py-2 text-left">Tags</th>
                <th className="px-3 py-2 text-left">Operator(s)</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {lineStations.map((s) => {
                const operators = stationOperators(s.id);
                return (
                  <tr key={s.id} className="border-b border-border/30 align-top">
                    <td className="px-3 py-3 font-mono text-xs">{s.sequence}</td>
                    <td className="px-3 py-3">
                      <div className="font-medium">{s.name}</div>
                      <div className="text-[11px] font-mono text-muted-foreground">{s.id}</div>
                    </td>
                    <td className="px-3 py-3">
                      <span className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] uppercase tracking-wider ${
                        s.type === "automatic" ? "border-primary/40 bg-primary/10 text-primary" : "border-accent/40 bg-accent/10 text-accent"
                      }`}>
                        {s.type === "automatic" ? <Cpu className="h-3 w-3" /> : <Hand className="h-3 w-3" />}
                        {s.type}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-xs">
                      {s.machine ? (
                        <>
                          <div>{s.machine.vendor} · {s.machine.model}</div>
                          <div className="text-[11px] text-muted-foreground">{s.machine.firmware ?? "—"}</div>
                        </>
                      ) : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="px-3 py-3 text-xs">
                      {s.machine ? (
                        <div className="flex flex-col gap-0.5">
                          <span className="inline-flex items-center gap-1"><Network className="h-3 w-3 text-info" /> <span className="font-mono">{s.machine.ipAddress}:{s.machine.port}</span></span>
                          <span className="inline-flex items-center gap-1"><Wifi className="h-3 w-3 text-primary" /> {s.machine.protocol}</span>
                        </div>
                      ) : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="px-3 py-3 text-[11px]">
                      {s.machine ? (
                        <>
                          <div><span className="text-success">↓ in:</span> {s.machine.receivedDataTypes}</div>
                          <div className="mt-0.5"><span className="text-accent">↑ out:</span> {s.machine.sentDataTypes}</div>
                        </>
                      ) : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="px-3 py-3 text-xs">
                      {operators.length === 0 ? (
                        <span className="inline-flex items-center gap-1 text-warning">
                          <AlertTriangle className="h-3 w-3" /> unassigned
                        </span>
                      ) : (
                        operators.map((o) => (
                          <div key={o!.id} className="inline-flex items-center gap-1.5">
                            <UserIcon className="h-3 w-3 text-muted-foreground" /> {o!.name}
                          </div>
                        ))
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex justify-end gap-1.5">
                        <EntityFormDialog<Station>
                          title={`Edit ${s.id}`}
                          fields={stationFields}
                          initial={toFlat(s) as any}
                          onSubmit={(v) => store.updateStation(s.id, fromFlat(v, lineId))}
                          trigger={
                            <button className="grid h-8 w-8 place-items-center rounded-lg border border-border/60 bg-card/60 text-muted-foreground hover:border-primary/40 hover:text-primary">
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                          }
                        />
                        <ConfirmDelete label={`Delete ${s.id}`} onConfirm={() => store.deleteStation(s.id)} />
                      </div>
                    </td>
                  </tr>
                );
              })}
              {lineStations.length === 0 && (
                <tr><td colSpan={8} className="px-3 py-8 text-center text-sm text-muted-foreground">No stations configured.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function KPI({ label, value, icon, accent }: { label: string; value: string; icon: React.ReactNode; accent: "primary" | "info" | "success" | "accent" }) {
  const ring = { primary: "border-primary/30 text-primary", info: "border-info/30 text-info", success: "border-success/30 text-success", accent: "border-accent/30 text-accent" }[accent];
  return (
    <div className="glass-panel rounded-xl p-4">
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
        <span className={`grid h-7 w-7 place-items-center rounded-md border ${ring}`}>{icon}</span>
      </div>
      <div className="mt-1 font-mono text-xl font-semibold">{value}</div>
    </div>
  );
}

function StationCard({
  station: s,
  operatorNames,
  templates,
  openDowntime,
  fields,
  lineId,
  onEdit,
  onDelete,
  onRemoveTemplate,
  onLogDowntime,
}: {
  station: Station;
  operatorNames: string[];
  templates: StepTemplate[];
  openDowntime: DowntimeEvent[];
  fields: Field[];
  lineId: string;
  onEdit: (patch: Partial<Station>) => void;
  onDelete: () => void;
  onRemoveTemplate: (templateId: string) => void;
  onLogDowntime: (reason: string, category: DowntimeEvent["category"], durationMin: number) => void;
}) {
  const statusTone =
    s.status === "running" ? "border-success/40 ring-success/20"
    : s.status === "down" ? "border-destructive/40 ring-destructive/30"
    : s.status === "maintenance" ? "border-warning/40 ring-warning/20"
    : "border-border/60";

  const dot =
    s.status === "running" ? "bg-success animate-pulse"
    : s.status === "down" ? "bg-destructive"
    : s.status === "maintenance" ? "bg-warning"
    : "bg-muted-foreground";

  const hasOpenDowntime = openDowntime.length > 0;

  return (
    <div className={`relative w-72 shrink-0 rounded-xl border bg-card/70 p-4 backdrop-blur ${statusTone} ring-1`}>
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
            <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
            Seq {s.sequence} · {s.status}
            {s.lastTickAt && s.status === "running" && (
              <span className="ml-1 inline-flex items-center gap-0.5 text-success">
                <Radio className="h-2.5 w-2.5" /> {s.lastTickAt}
              </span>
            )}
          </div>
          <h3 className="mt-0.5 truncate text-sm font-semibold">{s.name}</h3>
          <div className="font-mono text-[11px] text-muted-foreground">{s.id}</div>
        </div>
        <span className={`grid h-7 w-7 place-items-center rounded-md border ${
          s.type === "automatic" ? "border-primary/40 bg-primary/10 text-primary" : "border-accent/40 bg-accent/10 text-accent"
        }`}>
          {s.type === "automatic" ? <Cpu className="h-3.5 w-3.5" /> : <Hand className="h-3.5 w-3.5" />}
        </span>
      </div>

      {/* Open-downtime badge */}
      {hasOpenDowntime && (
        <div className="mt-2 rounded-md border border-destructive/40 bg-destructive/10 px-2 py-1 text-[11px] text-destructive">
          <div className="flex items-center gap-1 font-medium">
            <AlertOctagon className="h-3 w-3" /> {openDowntime.length} open · {openDowntime[0].reasonCode}
          </div>
          <div className="font-mono text-[10px] text-destructive/80">
            since {openDowntime[0].startedAt} · {openDowntime.reduce((a, d) => a + d.durationMin, 0)}m total
          </div>
        </div>
      )}

      {/* Step + live value */}
      <div className="mt-3 rounded-lg bg-background/60 p-2.5">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Current step</div>
        <div className="mt-0.5 text-xs">{s.currentStep ?? "—"}</div>
        <div className="mt-2 flex items-end justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Value</div>
            <div className="font-mono text-base font-semibold text-primary">{s.currentValue ?? "—"}</div>
          </div>
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Target</div>
            <div className="font-mono text-xs">{s.target ?? "—"}</div>
          </div>
        </div>
      </div>

      {/* OEE bar */}
      <div className="mt-3">
        <div className="flex justify-between text-[10px] uppercase tracking-wider text-muted-foreground">
          <span>OEE</span><span className="font-mono">{s.oee ?? 0}%</span>
        </div>
        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-gradient-to-r from-primary to-info" style={{ width: `${s.oee ?? 0}%` }} />
        </div>
      </div>

      {/* Operator (live — reacts to assignment changes via store context) */}
      <div className="mt-3 rounded-lg border border-border/40 bg-background/40 p-2">
        <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
          <UserIcon className="h-3 w-3" /> Operator
        </div>
        {operatorNames.length === 0 ? (
          <div className="mt-0.5 text-[11px] text-warning">unassigned</div>
        ) : (
          operatorNames.map((n) => (
            <div key={n} className="mt-0.5 text-xs">{n}</div>
          ))
        )}
      </div>

      {/* Templates applied */}
      {templates.length > 0 && (
        <div className="mt-3 rounded-lg border border-border/40 bg-background/40 p-2">
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
            <ListChecks className="h-3 w-3" /> Step templates · {templates.length}
          </div>
          <div className="mt-1 flex flex-wrap gap-1">
            {templates.map((t) => (
              <span key={t.id} className="group inline-flex items-center gap-1 rounded border border-primary/30 bg-primary/5 px-1.5 py-0.5 text-[10px]">
                {t.isCCP && <ShieldAlert className="h-2.5 w-2.5 text-destructive" />}
                <span className="font-mono">{t.id}</span>
                <span className="max-w-[7rem] truncate text-muted-foreground">{t.name}</span>
                <button onClick={() => onRemoveTemplate(t.id)} className="opacity-0 transition group-hover:opacity-100" title="Remove">
                  <X className="h-2.5 w-2.5 text-destructive" />
                </button>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Machine quick stats */}
      {s.machine && (
        <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
          <div className="rounded-md border border-border/40 bg-background/40 p-2">
            <div className="text-[9px] uppercase tracking-wider text-muted-foreground">Protocol</div>
            <div className="font-mono">{s.machine.protocol}</div>
          </div>
          <div className="rounded-md border border-border/40 bg-background/40 p-2">
            <div className="text-[9px] uppercase tracking-wider text-muted-foreground">IP : Port</div>
            <div className="truncate font-mono">{s.machine.ipAddress}:{s.machine.port}</div>
          </div>
        </div>
      )}

      <div className="mt-3 flex items-center justify-between gap-1.5">
        <LogDowntimeButton onSubmit={onLogDowntime} />
        <div className="flex gap-1.5">
          <EntityFormDialog<Station>
            title={`Edit ${s.id}`}
            fields={fields}
            initial={toFlat(s) as any}
            onSubmit={(v) => onEdit(fromFlat(v, lineId))}
            trigger={
              <button className="grid h-7 w-7 place-items-center rounded-md border border-border/60 bg-card/60 text-muted-foreground hover:border-primary/40 hover:text-primary">
                <Pencil className="h-3 w-3" />
              </button>
            }
          />
          <ConfirmDelete label={`Delete ${s.id}`} onConfirm={onDelete} />
        </div>
      </div>
    </div>
  );
}

function LogDowntimeButton({ onSubmit }: { onSubmit: (reason: string, category: DowntimeEvent["category"], durationMin: number) => void }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [category, setCategory] = useState<DowntimeEvent["category"]>("equipment_failure");
  const [duration, setDuration] = useState(5);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 rounded-md border border-destructive/40 bg-destructive/10 px-2 py-1 text-[10px] font-medium text-destructive hover:bg-destructive/20"
      >
        <AlertOctagon className="h-3 w-3" /> Log downtime
      </button>
    );
  }

  return (
    <div className="absolute inset-x-3 bottom-3 z-10 rounded-lg border border-destructive/40 bg-card p-2 shadow-xl">
      <div className="mb-1 flex items-center justify-between text-[10px] uppercase tracking-wider text-destructive">
        <span>Log downtime</span>
        <button onClick={() => setOpen(false)}><X className="h-3 w-3" /></button>
      </div>
      <input
        autoFocus
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Reason (e.g. Capper jam)"
        className="h-7 w-full rounded border border-border/60 bg-background/60 px-2 text-[11px]"
      />
      <div className="mt-1 grid grid-cols-2 gap-1">
        <select value={category} onChange={(e) => setCategory(e.target.value as any)} className="h-7 rounded border border-border/60 bg-background/60 px-1 text-[11px]">
          <option value="equipment_failure">Equipment failure</option>
          <option value="changeover">Changeover</option>
          <option value="material_shortage">Material shortage</option>
          <option value="quality_hold">Quality hold</option>
          <option value="operator_break">Operator break</option>
        </select>
        <input type="number" min={1} value={duration} onChange={(e) => setDuration(Number(e.target.value))} className="h-7 rounded border border-border/60 bg-background/60 px-2 text-[11px]" />
      </div>
      <div className="mt-1 flex justify-end gap-1">
        <button onClick={() => setOpen(false)} className="rounded border border-border/60 px-2 py-0.5 text-[10px]">Cancel</button>
        <button
          disabled={!reason.trim()}
          onClick={() => { onSubmit(reason.trim(), category, duration); setOpen(false); setReason(""); }}
          className="rounded bg-destructive px-2 py-0.5 text-[10px] font-medium text-destructive-foreground disabled:opacity-50"
        >
          Log
        </button>
      </div>
    </div>
  );
}
