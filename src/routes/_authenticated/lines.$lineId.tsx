import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMes } from "@/lib/mes-store";
import type { Station, CommProtocol, StationStatus, StationType, DowntimeEvent, StepTemplate, StationOutputFile, StationCommand } from "@/lib/mes-data";
import { StatusPill } from "@/components/status-pill";
import {
  Factory, ArrowLeft, ArrowRight, Cpu, Hand, Plus, Pencil, Network, Wifi,
  Activity, User as UserIcon, Gauge, Clock, AlertTriangle, AlertOctagon, ShieldAlert,
  ListChecks, Radio, X, RefreshCw, ChevronUp, ChevronDown, Check, Ban, FileUp, Download, FileText,
} from "lucide-react";
import { EntityFormDialog, type Field } from "@/components/crud/entity-form-dialog";
import { ConfirmDelete } from "@/components/crud/confirm-delete";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/lines/$lineId")({
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
  { name: "initialOutputFile", label: "Attach an initial output file (optional, max 3MB)", type: "file", span: 2,
    section: "Initial output payload (file kind only)",
    accept: "image/*,application/pdf,application/json,text/csv,text/plain",
    visibleWhen: { field: "machine_outputKind", equals: "file" } },
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

  // Auto-poll the live state every 5s (in addition to the 3s store live tick).
  useEffect(() => {
    const id = window.setInterval(() => store.refreshLive(), 5000);
    return () => window.clearInterval(id);
  }, [store]);


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
        <div className="flex gap-2">
          <button
            onClick={() => { store.refreshLive(); toast.success("Live view refreshed"); }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 bg-card/60 px-3 py-1.5 text-xs hover:border-primary/40 hover:text-primary"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Refresh live view
          </button>
          <EntityFormDialog<Station>
            title={`Add Station to ${line.name}`}
            fields={stationFields}
            initial={toFlat({ lineId, type: "manual", status: "idle", sequence: lineStations.length + 1, oee: 0, cycleTimeSec: 0 })}
            onSubmit={(v: any) => {
              const st = fromFlat(v, lineId);
              store.createStation(st as any);
              if (v.initialOutputFile && typeof v.initialOutputFile === "object") {
                store.uploadStationOutput(st.id, v.initialOutputFile);
              }
            }}
            trigger={
              <button className="flex items-center gap-1.5 rounded-lg bg-gradient-to-br from-primary to-info px-3 py-1.5 text-xs font-medium text-primary-foreground shadow-[var(--shadow-glow)]">
                <Plus className="h-3.5 w-3.5" /> Add station
              </button>
            }
          />
        </div>
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
              {stepsGrouped.map(([seq, group], idx) => (
                <div key={seq} className="flex items-stretch gap-3">
                  {/* Step column: stack parallel stations vertically */}
                  <div className="flex w-72 flex-col gap-3">
                    <div className="flex items-center justify-between rounded-md border border-primary/20 bg-primary/5 px-2 py-1 text-[10px] uppercase tracking-wider text-primary/80">
                      <span>Step {seq}</span>
                      {group.length > 1 && (
                        <span className="rounded bg-primary/15 px-1.5 py-0.5 text-[9px] text-primary">
                          {group.length} parallel
                        </span>
                      )}
                    </div>
                    {group.map((s, siblingIdx) => {
                      const operators = stationOperators(s.id);
                      const stationCmds = store.commands.filter((c) => c.stationId === s.id).slice(0, 3);
                      const stationOutputs = store.outputs.filter((o) => o.stationId === s.id);
                      return (
                        <StationCard
                          key={s.id}
                          station={s}
                          operatorNames={operators.map((o) => o!.name)}
                          templates={(s.templateIds ?? []).map((id) => store.stepTemplates.find((t) => t.id === id)).filter(Boolean) as StepTemplate[]}
                          allTemplates={store.stepTemplates}
                          openDowntime={openByStation[s.id] ?? []}
                          recentCommands={stationCmds}
                          outputs={stationOutputs}
                          siblingsCount={group.length}
                          siblingPosition={siblingIdx}
                          onEdit={(patch) => store.updateStation(s.id, patch)}
                          onDelete={() => store.deleteStation(s.id)}
                          onDuplicate={() => { store.duplicateStation(s.id); toast.success(`Duplicated ${s.id} at step ${s.sequence}`); }}
                          onMoveUp={() => store.moveStationSibling(s.id, "up")}
                          onMoveDown={() => store.moveStationSibling(s.id, "down")}
                          onAddTemplate={(tid) => store.applyTemplateToStation(s.id, tid)}
                          onRemoveTemplate={(tid) => store.removeTemplateFromStation(s.id, tid)}
                          onSendCommand={(kind, outId) => {
                            store.sendStationCommand(s.id, kind, outId);
                            toast.success(`${kind === "accept" ? "ACCEPT" : "REJECT"} sent to ${s.id}`);
                          }}
                          onUploadOutput={(file) => {
                            store.uploadStationOutput(s.id, file);
                            toast.success(`Uploaded ${file.name}`);
                          }}
                          onDeleteOutput={(oid) => store.deleteStationOutput(oid)}
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
                      );
                    })}
                  </div>
                  {idx < stepsGrouped.length - 1 && (
                    <div className="flex w-6 items-center justify-center">
                      <div className="relative h-px w-full bg-gradient-to-r from-primary/60 to-info/60">
                        <ArrowRight className="absolute -right-1 -top-2 h-4 w-4 text-primary" />
                      </div>
                    </div>
                  )}
                </div>
              ))}
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
  allTemplates,
  openDowntime,
  recentCommands,
  outputs,
  siblingsCount,
  siblingPosition,
  fields,
  lineId,
  onEdit,
  onDelete,
  onDuplicate,
  onMoveUp,
  onMoveDown,
  onAddTemplate,
  onRemoveTemplate,
  onSendCommand,
  onUploadOutput,
  onDeleteOutput,
  onLogDowntime,
}: {
  station: Station;
  operatorNames: string[];
  templates: StepTemplate[];
  allTemplates: StepTemplate[];
  openDowntime: DowntimeEvent[];
  recentCommands: StationCommand[];
  outputs: StationOutputFile[];
  siblingsCount: number;
  siblingPosition: number;
  fields: Field[];
  lineId: string;
  onEdit: (patch: Partial<Station>) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onAddTemplate: (templateId: string) => void;
  onRemoveTemplate: (templateId: string) => void;
  onSendCommand: (kind: "accept" | "reject", outputId?: string) => void;
  onUploadOutput: (file: { name: string; size: number; mime?: string; dataUrl: string }) => void;
  onDeleteOutput: (outputId: string) => void;
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

      {/* Templates applied — always shown so users can add/remove */}
      <div className="mt-3 rounded-lg border border-border/40 bg-background/40 p-2">
        <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <ListChecks className="h-3 w-3" /> Step templates · {templates.length}
          </span>
          <AddTemplatePicker
            assigned={templates.map((t) => t.id)}
            all={allTemplates}
            onAdd={onAddTemplate}
          />
        </div>
        {templates.length === 0 ? (
          <div className="mt-1 text-[11px] text-warning">No templates — add at least one.</div>
        ) : (
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
        )}
      </div>

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

      {/* Output config + live send controls (automatic only) */}
      {s.machine && s.machine.outputKind && s.machine.outputKind !== "none" && (
        <div className="mt-3 rounded-lg border border-info/30 bg-info/5 p-2 text-[11px]">
          <div className="flex items-center justify-between text-[9px] uppercase tracking-wider text-info">
            <span>
              Output · {s.machine.outputKind}
              {s.machine.outputProtocol ? ` · via ${s.machine.outputProtocol}` : ""}
            </span>
            {s.machine.outputKind === "file" && (
              <UploadFileButton onUpload={onUploadOutput} label={s.machine.outputLabel} />
            )}
          </div>
          {s.machine.outputLabel && <div className="mt-0.5 truncate font-mono">{s.machine.outputLabel}</div>}

          {/* Uploaded output files (for outputKind=file) */}
          {s.machine.outputKind === "file" && (
            <div className="mt-1.5">
              <div className="mb-1 flex items-center justify-between text-[9px] uppercase tracking-wider text-muted-foreground">
                <span>Output history · {outputs.length}</span>
                {outputs.length > 3 && (
                  <Link to="/stations/$stationId" params={{ stationId: s.id }} className="text-primary hover:underline">
                    view all
                  </Link>
                )}
              </div>
              {outputs.length === 0 ? (
                <div className="rounded border border-dashed border-border/60 px-1.5 py-1 text-[10px] text-muted-foreground">
                  no output files yet
                </div>
              ) : (
                <ul className="space-y-1">
                  {outputs.slice(0, 3).map((o) => (
                    <li key={o.id} className="rounded border border-border/40 bg-background/40 px-1.5 py-1">
                      <div className="flex items-center gap-1">
                        <FileText className="h-3 w-3 shrink-0 text-muted-foreground" />
                        <a href={o.dataUrl} download={o.name} className="min-w-0 flex-1 truncate font-mono text-[10px] hover:text-primary" title={o.name}>
                          {o.name}
                        </a>
                        <span className="font-mono text-[9px] text-muted-foreground">{Math.round(o.size / 1024)}KB</span>
                        {o.decision ? (
                          <span className={`rounded px-1 py-0 font-mono text-[9px] uppercase ${
                            o.decision === "accept" ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"
                          }`}>{o.decision}</span>
                        ) : (
                          <span className="rounded bg-muted/40 px-1 py-0 font-mono text-[9px] uppercase text-muted-foreground">pending</span>
                        )}
                        <a href={o.dataUrl} download={o.name} className="text-muted-foreground hover:text-primary" title="Download">
                          <Download className="h-2.5 w-2.5" />
                        </a>
                        <button onClick={() => onDeleteOutput(o.id)} className="text-destructive/70 hover:text-destructive" title="Remove">
                          <X className="h-2.5 w-2.5" />
                        </button>
                      </div>
                      <div className="mt-0.5 font-mono text-[9px] text-muted-foreground">
                        {new Date(o.uploadedAt).toLocaleString([], { dateStyle: "short", timeStyle: "medium" })} · {o.actorName}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* Send accept/reject */}
          <div className="mt-1.5 flex gap-1">
            {s.machine.acceptCommand && (
              <button
                onClick={() => onSendCommand("accept", outputs[0]?.id)}
                className="inline-flex items-center gap-1 rounded border border-success/40 bg-success/10 px-2 py-0.5 font-mono text-[10px] text-success hover:bg-success/20"
                title={`Send ${s.machine.acceptCommand} via ${s.machine.outputProtocol ?? "protocol"}`}
              >
                <Check className="h-2.5 w-2.5" /> Send ACCEPT
              </button>
            )}
            {s.machine.rejectCommand && (
              <button
                onClick={() => onSendCommand("reject", outputs[0]?.id)}
                className="inline-flex items-center gap-1 rounded border border-destructive/40 bg-destructive/10 px-2 py-0.5 font-mono text-[10px] text-destructive hover:bg-destructive/20"
                title={`Send ${s.machine.rejectCommand} via ${s.machine.outputProtocol ?? "protocol"}`}
              >
                <Ban className="h-2.5 w-2.5" /> Send REJECT
              </button>
            )}
          </div>

          {/* Latest command result */}
          {recentCommands.length > 0 && (
            <div className="mt-1.5 space-y-0.5">
              {recentCommands.slice(0, 2).map((c) => (
                <CommandResultRow key={c.id} c={c} />
              ))}
            </div>
          )}
        </div>
      )}

      <div className="mt-3 flex items-center justify-between gap-1.5">
        <LogDowntimeButton onSubmit={onLogDowntime} />
        <div className="flex gap-1.5">
          {siblingsCount > 1 && (
            <>
              <button
                onClick={onMoveUp}
                disabled={siblingPosition === 0}
                title="Move up in parallel step"
                className="grid h-7 w-7 place-items-center rounded-md border border-border/60 bg-card/60 text-muted-foreground hover:border-primary/40 hover:text-primary disabled:opacity-30"
              >
                <ChevronUp className="h-3 w-3" />
              </button>
              <button
                onClick={onMoveDown}
                disabled={siblingPosition === siblingsCount - 1}
                title="Move down in parallel step"
                className="grid h-7 w-7 place-items-center rounded-md border border-border/60 bg-card/60 text-muted-foreground hover:border-primary/40 hover:text-primary disabled:opacity-30"
              >
                <ChevronDown className="h-3 w-3" />
              </button>
            </>
          )}
          <button
            onClick={onDuplicate}
            title="Duplicate at same step (parallel station)"
            className="grid h-7 w-7 place-items-center rounded-md border border-info/40 bg-info/10 text-info hover:bg-info/20"
          >
            <Plus className="h-3 w-3" />
          </button>
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

function UploadFileButton({ onUpload, label }: { onUpload: (f: { name: string; size: number; mime?: string; dataUrl: string }) => void; label?: string }) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-1 rounded border border-primary/40 bg-primary/10 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider text-primary hover:bg-primary/20">
      <FileUp className="h-2.5 w-2.5" />
      <span>Upload</span>
      <input
        type="file"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.currentTarget.value = "";
          if (!file) return;
          const max = 3 * 1024 * 1024;
          if (file.size > max) {
            toast.error(`File too large — max 3MB (${label ?? "output"})`);
            return;
          }
          const reader = new FileReader();
          reader.onload = () => onUpload({
            name: file.name, size: file.size, mime: file.type, dataUrl: reader.result as string,
          });
          reader.readAsDataURL(file);
        }}
      />
    </label>
  );
}

function CommandResultRow({ c }: { c: StationCommand }) {
  const tone =
    c.status === "acknowledged" ? "text-success"
    : c.status === "pending" ? "text-muted-foreground"
    : c.status === "timeout" ? "text-warning"
    : "text-destructive";
  const time = new Date(c.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  return (
    <div className={`flex items-center justify-between gap-1 rounded bg-background/40 px-1.5 py-0.5 font-mono text-[9px] ${tone}`}>
      <span className="truncate">
        {c.kind === "accept" ? "→ ACK" : "→ NAK"} <span className="opacity-70">{c.command}</span>
      </span>
      <span className="truncate opacity-80">{c.status === "pending" ? "sending…" : c.response ?? c.status}</span>
      <span className="opacity-60">{time}</span>
    </div>
  );
}

function AddTemplatePicker({ assigned, all, onAdd }: { assigned: string[]; all: StepTemplate[]; onAdd: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const available = all.filter((t) => !assigned.includes(t.id));
  if (available.length === 0) return null;
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-0.5 rounded border border-primary/40 bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary hover:bg-primary/20"
      >
        <Plus className="h-2.5 w-2.5" /> Add
      </button>
      {open && (
        <div className="absolute right-0 top-full z-20 mt-1 max-h-48 w-56 overflow-y-auto rounded-lg border border-border/60 bg-card p-1 shadow-xl">
          {available.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => { onAdd(t.id); setOpen(false); }}
              className="block w-full rounded px-2 py-1 text-left text-[11px] hover:bg-primary/10"
            >
              <span className="font-mono text-[10px] text-muted-foreground">{t.id}</span> · {t.name}
            </button>
          ))}
        </div>
      )}
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
