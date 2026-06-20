import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMes } from "@/lib/mes-store";
import type { Station, CommProtocol, StationStatus, StationType } from "@/lib/mes-data";
import { EntityFormDialog, type Field } from "@/components/crud/entity-form-dialog";
import { ConfirmDelete } from "@/components/crud/confirm-delete";
import { Plus, Pencil, Search, Cpu, Hand, Network, Wifi, ArrowRight, Copy } from "lucide-react";

export const Route = createFileRoute("/stations")({
  head: () => ({
    meta: [
      { title: "Stations · Cortanex MES" },
      { name: "description", content: "All stations across every line — manual or automatic, with machine details, comms and operator assignments." },
    ],
  }),
  component: StationsPage,
});

const protocols: CommProtocol[] = ["OPC-UA", "MQTT", "Modbus-TCP", "EtherNet/IP", "Profinet", "REST"];

function stationFields(lines: { id: string; name: string }[], templates: { id: string; name: string }[]): Field[] {
  return [
    { name: "id", label: "Station ID", type: "text", placeholder: "ST-110", required: true },
    { name: "name", label: "Name", type: "text", required: true },
    { name: "lineId", label: "Line", type: "select", required: true,
      options: lines.map((l) => ({ value: l.id, label: `${l.id} · ${l.name}` })) },
    { name: "sequence", label: "Sequence # (same number = parallel in same step)", type: "number", required: true },
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

    { name: "templateIds", label: "Step templates (select at least one)", type: "multiselect", span: 2,
      section: "Step templates", required: true, minSelected: 1,
      options: templates.map((t) => ({ value: t.id, label: `${t.id} · ${t.name}` })) },

    { name: "machine_model", label: "Machine model", type: "text", section: "Machine (automatic only)",
      visibleWhen: { field: "type", equals: "automatic" } },
    { name: "machine_vendor", label: "Vendor", type: "text", visibleWhen: { field: "type", equals: "automatic" } },
    { name: "machine_ipAddress", label: "IP address", type: "text", placeholder: "10.0.0.10",
      visibleWhen: { field: "type", equals: "automatic" } },
    { name: "machine_port", label: "Port", type: "number", placeholder: "4840",
      visibleWhen: { field: "type", equals: "automatic" } },
    { name: "machine_protocol", label: "Protocol", type: "select",
      options: protocols.map((p) => ({ value: p, label: p })),
      visibleWhen: { field: "type", equals: "automatic" } },
    { name: "machine_firmware", label: "Firmware", type: "text", visibleWhen: { field: "type", equals: "automatic" } },
    { name: "machine_receivedDataTypes", label: "Received data types", type: "textarea", span: 2,
      placeholder: "temp_c,pressure_bar,rpm,vibration",
      visibleWhen: { field: "type", equals: "automatic" } },
    { name: "machine_sentDataTypes", label: "Sent data types", type: "textarea", span: 2,
      placeholder: "setpoint_rpm,recipe_id,start,stop",
      visibleWhen: { field: "type", equals: "automatic" } },

    { name: "machine_outputKind", label: "Output kind", type: "select",
      section: "Output (automatic only)",
      options: [
        { value: "none", label: "No output" },
        { value: "text", label: "Text (e.g. PASS/FAIL, reading)" },
        { value: "file", label: "File (e.g. inspection image)" },
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
}

export function toFlatStation(s: Partial<Station>) {
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

export function fromFlatStation(v: any): Station {
  const base: Station = {
    id: v.id,
    lineId: v.lineId,
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

function StationsPage() {
  const store = useMes();
  const [q, setQ] = useState("");
  const [lineFilter, setLineFilter] = useState<"all" | string>("all");
  const [typeFilter, setTypeFilter] = useState<"all" | StationType>("all");

  const fields = useMemo(() => stationFields(store.lines, store.stepTemplates), [store.lines, store.stepTemplates]);

  const filtered = useMemo(() => {
    return store.stations
      .filter((s) => (lineFilter === "all" ? true : s.lineId === lineFilter))
      .filter((s) => (typeFilter === "all" ? true : s.type === typeFilter))
      .filter((s) => {
        if (!q) return true;
        const t = q.toLowerCase();
        return (
          s.name.toLowerCase().includes(t) ||
          s.id.toLowerCase().includes(t) ||
          (s.machine?.vendor.toLowerCase().includes(t) ?? false) ||
          (s.machine?.model.toLowerCase().includes(t) ?? false)
        );
      })
      .sort((a, b) => a.lineId.localeCompare(b.lineId) || a.sequence - b.sequence);
  }, [store.stations, q, lineFilter, typeFilter]);

  const counts = {
    total: store.stations.length,
    automatic: store.stations.filter((s) => s.type === "automatic").length,
    manual: store.stations.filter((s) => s.type === "manual").length,
    down: store.stations.filter((s) => s.status === "down").length,
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Stations</h1>
          <p className="text-sm text-muted-foreground">
            {counts.total} stations · {counts.automatic} automatic · {counts.manual} manual · {counts.down} down
          </p>
        </div>
        <EntityFormDialog<Station>
          title="New Station"
          fields={fields}
          initial={toFlatStation({ type: "manual", status: "idle", sequence: 1, oee: 0, cycleTimeSec: 0 })}
          onSubmit={(v) => store.createStation(fromFlatStation(v) as any)}
          trigger={
            <button className="flex items-center gap-1.5 rounded-lg bg-gradient-to-br from-primary to-info px-3 py-1.5 text-xs font-medium text-primary-foreground shadow-[var(--shadow-glow)]">
              <Plus className="h-3.5 w-3.5" /> New Station
            </button>
          }
        />
      </div>

      <div className="glass-panel flex flex-wrap items-center gap-2 rounded-2xl p-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search id, name, machine vendor or model…"
            className="h-9 w-full rounded-lg border border-border/60 bg-card/60 pl-8 pr-3 text-sm focus:border-primary/50 focus:outline-none"
          />
        </div>
        <select
          value={lineFilter}
          onChange={(e) => setLineFilter(e.target.value)}
          className="h-9 rounded-lg border border-border/60 bg-card/60 px-2 text-xs"
        >
          <option value="all">All lines</option>
          {store.lines.map((l) => <option key={l.id} value={l.id}>{l.id} · {l.name}</option>)}
        </select>
        <div className="flex gap-1">
          {(["all", "automatic", "manual"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={`rounded-md border px-2.5 py-1 text-xs capitalize ${
                typeFilter === t ? "border-primary/50 bg-primary/15 text-primary" : "border-border/60 bg-card/60 text-muted-foreground hover:text-foreground"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="glass-panel overflow-hidden rounded-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-card/60 text-[11px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Station</th>
                <th className="px-4 py-3 text-left font-medium">Line</th>
                <th className="px-4 py-3 text-left font-medium">Type</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
                <th className="px-4 py-3 text-left font-medium">Machine</th>
                <th className="px-4 py-3 text-left font-medium">Comms</th>
                <th className="px-4 py-3 text-left font-medium">Operator</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => {
                const line = store.lines.find((l) => l.id === s.lineId);
                const asmt = store.assignments.find((a) => a.active && a.targetType === "station" && a.targetId === s.id);
                const op = asmt ? store.users.find((u) => u.id === asmt.userId) : undefined;
                const dot =
                  s.status === "running" ? "bg-success animate-pulse"
                  : s.status === "down" ? "bg-destructive"
                  : s.status === "maintenance" ? "bg-warning"
                  : "bg-muted-foreground";
                return (
                  <tr key={s.id} className="border-t border-border/40 hover:bg-card/40">
                    <td className="px-4 py-3">
                      <Link to="/stations/$stationId" params={{ stationId: s.id }} className="font-medium hover:text-primary">
                        {s.name}
                      </Link>
                      <div className="font-mono text-[10px] text-muted-foreground">{s.id} · seq {s.sequence}</div>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {line ? (
                        <Link to="/lines/$lineId" params={{ lineId: line.id }} className="hover:text-primary">
                          {line.name}
                        </Link>
                      ) : s.lineId}
                      <div className="font-mono text-[10px] text-muted-foreground">{s.lineId}</div>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <span className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] uppercase ${
                        s.type === "automatic" ? "border-primary/40 bg-primary/10 text-primary" : "border-accent/40 bg-accent/10 text-accent"
                      }`}>
                        {s.type === "automatic" ? <Cpu className="h-3 w-3" /> : <Hand className="h-3 w-3" />}
                        {s.type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <span className="inline-flex items-center gap-1.5">
                        <span className={`h-1.5 w-1.5 rounded-full ${dot}`} /> {s.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {s.machine ? (
                        <>
                          <div>{s.machine.vendor} · {s.machine.model}</div>
                          <div className="text-[10px] text-muted-foreground">{s.machine.firmware ?? "—"}</div>
                        </>
                      ) : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {s.machine ? (
                        <div className="flex flex-col gap-0.5">
                          <span className="inline-flex items-center gap-1"><Network className="h-3 w-3 text-info" /> <span className="font-mono">{s.machine.ipAddress}:{s.machine.port}</span></span>
                          <span className="inline-flex items-center gap-1"><Wifi className="h-3 w-3 text-primary" /> {s.machine.protocol}</span>
                        </div>
                      ) : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {op ? (
                        <Link to="/users/$userId" params={{ userId: op.id }} className="hover:text-primary">{op.name}</Link>
                      ) : <span className="text-warning">unassigned</span>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1.5">
                        <Link
                          to="/stations/$stationId"
                          params={{ stationId: s.id }}
                          className="inline-flex h-8 items-center gap-1 rounded-lg border border-primary/30 bg-primary/10 px-2 text-[11px] text-primary hover:bg-primary/20"
                        >
                          Profile <ArrowRight className="h-3 w-3" />
                        </Link>
                        <button
                          onClick={() => store.duplicateStation(s.id)}
                          title="Duplicate at same step"
                          className="grid h-8 w-8 place-items-center rounded-lg border border-info/40 bg-info/10 text-info hover:bg-info/20"
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </button>
                        <EntityFormDialog<Station>
                          title={`Edit ${s.id}`}
                          fields={fields}
                          initial={toFlatStation(s)}
                          onSubmit={(v) => store.updateStation(s.id, fromFlatStation(v))}
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
              {filtered.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-10 text-center text-sm text-muted-foreground">No stations match those filters.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
