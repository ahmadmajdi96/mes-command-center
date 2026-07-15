import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useState } from "react";
import { useMes } from "@/lib/mes-store";
import type { StepTemplate, StationCommand } from "@/lib/mes-data";
import { useOpenStationVisits, useUnitsRealtime } from "@/lib/units-db";
import {
  ArrowLeft, Cpu, Hand, Network, Wifi, User as UserIcon, ShieldAlert,
  ClipboardList, Activity, Gauge, Clock, Radio, AlertOctagon, ListChecks, Plus,
  Check, Ban, FileUp, FileText, X, History, RefreshCw, Package,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/stations/$stationId")({
  head: ({ params }) => ({
    meta: [
      { title: `Station ${params.stationId} · Profile · Cortanex MES` },
      { name: "description", content: "Full station profile — machine details, operator, telemetry, downtime history and step templates." },
    ],
  }),
  component: StationProfile,
  notFoundComponent: () => (
    <div className="grid place-items-center p-12 text-sm text-muted-foreground">Station not found.</div>
  ),
});

function StationProfile() {
  const { stationId } = Route.useParams();
  const store = useMes();
  const station = store.stations.find((s) => s.id === stationId);
  useUnitsRealtime();
  const { data: liveVisits = [] } = useOpenStationVisits({ station: stationId });
  if (!station) throw notFound();


  const line = store.lines.find((l) => l.id === station.lineId);
  const asmt = store.assignments.find((a) => a.active && a.targetType === "station" && a.targetId === station.id);
  const op = asmt ? store.users.find((u) => u.id === asmt.userId) : undefined;
  const wo = line?.currentWorkOrder
    ? store.workOrders.find((w) => w.id === line.currentWorkOrder)
    : store.workOrders.find((w) => w.lineId === station.lineId && w.status === "running");
  const downtime = store.downtime.filter((d) => d.stationId === station.id).slice(0, 8);
  const templates = (station.templateIds ?? [])
    .map((id) => store.stepTemplates.find((t) => t.id === id))
    .filter(Boolean) as NonNullable<ReturnType<typeof store.stepTemplates.find>>[];
  const outputs = store.outputs.filter((o) => o.stationId === station.id);
  const commands = store.commands.filter((c) => c.stationId === station.id).slice(0, 15);

  // Assignment history: audit entries that involved this station as a target
  const assignmentHistory = store.audit.filter((e) => {
    if (e.entity !== "assignment") return false;
    const t = (e.after as any)?.targetId ?? (e.before as any)?.targetId;
    if (t === station.id) return true;
    // fallback: match assignment id from summary that ever targeted this station
    const asmtIds = new Set(store.assignments.filter((a) => a.targetId === station.id && a.targetType === "station").map((a) => a.id));
    return asmtIds.has(e.entityId);
  }).slice(0, 20);

  const statusTone =
    station.status === "running" ? "border-success/40 bg-success/10 text-success"
    : station.status === "down" ? "border-destructive/40 bg-destructive/10 text-destructive"
    : station.status === "maintenance" ? "border-warning/40 bg-warning/10 text-warning"
    : "border-border/60 bg-card/60 text-muted-foreground";

  return (
    <div className="space-y-6">
      <div>
        <Link to="/stations" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3 w-3" /> All stations
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <div className={`grid h-12 w-12 place-items-center rounded-xl border ${
            station.type === "automatic" ? "border-primary/40 bg-primary/10 text-primary" : "border-accent/40 bg-accent/10 text-accent"
          }`}>
            {station.type === "automatic" ? <Cpu className="h-6 w-6" /> : <Hand className="h-6 w-6" />}
          </div>
          <div>
            <h1 className="font-display text-2xl font-semibold tracking-tight">{station.name}</h1>
            <p className="text-xs text-muted-foreground">
              <span className="font-mono">{station.id}</span> · Seq {station.sequence} · {station.type}
              {line && <> · on <Link to="/lines/$lineId" params={{ lineId: line.id }} className="text-primary hover:underline">{line.name}</Link></>}
            </p>
          </div>
          <span className={`rounded-full border px-2.5 py-0.5 text-[10px] uppercase tracking-wider ${statusTone}`}>{station.status}</span>
          {station.lastTickAt && station.status === "running" && (
            <span className="inline-flex items-center gap-1 text-[11px] text-success">
              <Radio className="h-3 w-3 animate-pulse" /> live · {station.lastTickAt}
            </span>
          )}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <KPI label="OEE" value={`${station.oee ?? 0}%`} icon={<Gauge className="h-4 w-4" />} tone="primary" />
        <KPI label="Cycle time" value={`${station.cycleTimeSec}s`} icon={<Clock className="h-4 w-4" />} tone="info" />
        <KPI label="Current value" value={station.currentValue ?? "—"} icon={<Activity className="h-4 w-4" />} tone="success" />
        <KPI label="Target" value={station.target ?? "—"} icon={<ShieldAlert className="h-4 w-4" />} tone="accent" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Current step + WO */}
        <div className="glass-panel rounded-2xl p-4 lg:col-span-2">
          <h2 className="font-display text-sm font-semibold uppercase tracking-wider text-muted-foreground">Current step</h2>
          <div className="mt-2 rounded-xl border border-border/40 bg-background/40 p-3">
            <div className="text-sm">{station.currentStep ?? "— No active step —"}</div>
            <div className="mt-2 flex items-end justify-between">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Live value</div>
                <div className="font-mono text-xl font-semibold text-primary">{station.currentValue ?? "—"}</div>
              </div>
              <div className="text-right">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Target</div>
                <div className="font-mono text-sm">{station.target ?? "—"}</div>
              </div>
            </div>
          </div>

          {wo && (
            <div className="mt-4 rounded-xl border border-primary/30 bg-primary/5 p-3">
              <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-primary/80">
                <ClipboardList className="h-3 w-3" /> Active work order
              </div>
              <div className="mt-1 flex flex-wrap items-baseline gap-2">
                <Link to="/work-orders/$woId" params={{ woId: wo.id }} className="font-mono text-sm font-semibold hover:underline">{wo.id}</Link>
                <span className="text-sm">{wo.product}</span>
                <span className="font-mono text-[10px] text-muted-foreground">{wo.sku}</span>
              </div>
              <div className="mt-2 grid gap-2 text-xs sm:grid-cols-3">
                <div className="rounded-md border border-border/40 bg-background/40 p-2">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Produced</div>
                  <div className="font-mono">{wo.qtyProduced.toLocaleString()} / {wo.qtyTarget.toLocaleString()} {wo.uom}</div>
                </div>
                <div className="rounded-md border border-border/40 bg-background/40 p-2">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Window</div>
                  <div className="font-mono">{wo.startedAt} → {wo.endsAt}</div>
                </div>
                <div className="rounded-md border border-border/40 bg-background/40 p-2">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Progress</div>
                  <div className="font-mono">{wo.progress}%</div>
                </div>
              </div>
            </div>
          )}

          <div className="mt-4 rounded-xl border border-success/30 bg-success/5 p-3">
            <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-success/80">
              <span className="inline-flex items-center gap-1.5">
                <Radio className="h-3 w-3 animate-pulse" /> Currently processing at this station
              </span>
              <span>{liveVisits.length} live</span>
            </div>
            {liveVisits.length === 0 ? (
              <div className="mt-1.5 text-xs text-muted-foreground">No unit is inside the station right now.</div>
            ) : (
              <div className="mt-2 space-y-1.5">
                {liveVisits.slice(0, 5).map((v) => {
                  const secs = v.entered_at ? Math.round((Date.now() - new Date(v.entered_at).getTime()) / 1000) : 0;
                  return (
                    <Link key={v.id} to="/units/$uid" params={{ uid: v.unit_uid }}
                      className="flex items-center justify-between rounded-md border border-border/50 bg-card/60 px-2 py-1.5 text-xs hover:border-primary/40 hover:text-primary">
                      <span className="inline-flex items-center gap-2 font-mono">
                        <Package className="h-3.5 w-3.5 text-primary" />
                        {v.unit_uid}
                      </span>
                      <span className="font-mono text-[10px] text-muted-foreground">
                        entered {new Date(v.entered_at!).toLocaleTimeString([], { hour12: false })} · {secs}s
                      </span>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>


          <div className="mt-4">
            <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <ListChecks className="h-3 w-3" /> Step templates · {templates.length}
              </span>
              <TemplatePicker
                assigned={templates.map((t) => t.id)}
                all={store.stepTemplates}
                onAdd={(tid: string) => store.applyTemplateToStation(station.id, tid)}
              />
            </div>
            {templates.length === 0 ? (
              <div className="mt-1.5 text-xs text-warning">No templates attached. Add at least one.</div>
            ) : (
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {templates.map((t) => (
                  <span key={t.id} className="group inline-flex items-center gap-1 rounded border border-primary/30 bg-primary/5 px-2 py-0.5 text-[10px]">
                    {t.isCCP && <ShieldAlert className="h-2.5 w-2.5 text-destructive" />}
                    <span className="font-mono">{t.id}</span>
                    <span>{t.name}</span>
                    <button
                      onClick={() => store.removeTemplateFromStation(station.id, t.id)}
                      className="ml-1 text-destructive opacity-0 transition group-hover:opacity-100"
                      title="Remove"
                    >
                      ✕
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Operator + machine */}
        <div className="space-y-4">
          <div className="glass-panel rounded-2xl p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                <UserIcon className="h-3 w-3" /> Operator on station
              </div>
              <AssignOperatorPicker stationId={station.id} currentUserId={op?.id} />
            </div>
            {op ? (
              <div className="mt-2 flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-primary to-info text-sm font-bold text-primary-foreground">
                  {op.name.split(" ").map((p) => p[0]).join("").slice(0, 2)}
                </div>
                <div className="min-w-0 flex-1">
                  <Link to="/users/$userId" params={{ userId: op.id }} className="block truncate text-sm font-semibold hover:text-primary">
                    {op.name}
                  </Link>
                  <div className="truncate text-[11px] text-muted-foreground">{op.role.replace("_", " ")} · Shift {op.shift}</div>
                  <div className="truncate font-mono text-[11px] text-muted-foreground">{op.mobile}</div>
                </div>
                <button
                  onClick={() => asmt && store.updateAssignment(asmt.id, { active: false })}
                  className="rounded border border-destructive/40 bg-destructive/10 px-2 py-0.5 text-[10px] text-destructive hover:bg-destructive/20"
                >
                  Unassign
                </button>
              </div>
            ) : (
              <div className="mt-2 text-xs text-warning">No operator currently assigned. Use "Assign" above.</div>
            )}
          </div>

          {station.machine ? (
            <div className="glass-panel rounded-2xl p-4">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Machine</div>
              <div className="mt-1 text-sm font-semibold">{station.machine.vendor} · {station.machine.model}</div>
              <div className="text-[11px] text-muted-foreground">Firmware {station.machine.firmware ?? "—"}</div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <Info label="Protocol" icon={<Wifi className="h-3 w-3 text-primary" />} value={station.machine.protocol} />
                <Info label="IP : Port" icon={<Network className="h-3 w-3 text-info" />} value={`${station.machine.ipAddress}:${station.machine.port}`} />
              </div>
              <div className="mt-3 text-[11px]">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Received tags</div>
                <div className="mt-0.5 font-mono text-success">↓ {station.machine.receivedDataTypes}</div>
                <div className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">Sent tags</div>
                <div className="mt-0.5 font-mono text-accent">↑ {station.machine.sentDataTypes}</div>
              </div>
              {station.machine.outputKind && station.machine.outputKind !== "none" && (
                <div className="mt-3 rounded-lg border border-info/30 bg-info/5 p-2 text-[11px]">
                  <div className="text-[10px] uppercase tracking-wider text-info">
                    Output · {station.machine.outputKind}
                    {station.machine.outputProtocol ? ` · via ${station.machine.outputProtocol}` : ""}
                  </div>
                  {station.machine.outputLabel && (
                    <div className="mt-0.5 truncate font-mono">{station.machine.outputLabel}</div>
                  )}
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {station.machine.acceptCommand && (
                      <span className="rounded border border-success/40 bg-success/10 px-1.5 py-0.5 font-mono text-[10px] text-success">
                        ACCEPT → {station.machine.acceptCommand}
                      </span>
                    )}
                    {station.machine.rejectCommand && (
                      <span className="rounded border border-destructive/40 bg-destructive/10 px-1.5 py-0.5 font-mono text-[10px] text-destructive">
                        REJECT → {station.machine.rejectCommand}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="glass-panel rounded-2xl p-4">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Machine</div>
              <div className="mt-2 text-xs text-muted-foreground">This is a manual station — no machine attached.</div>
            </div>
          )}
        </div>
      </div>

      {/* Downtime history */}
      <div className="glass-panel rounded-2xl p-4">
        <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
          <AlertOctagon className="h-3 w-3" /> Downtime history · {downtime.length}
        </div>
        {downtime.length === 0 ? (
          <div className="mt-2 text-xs text-muted-foreground">No downtime recorded for this station.</div>
        ) : (
          <table className="mt-2 w-full text-xs">
            <thead className="text-[10px] uppercase tracking-wider text-muted-foreground">
              <tr><th className="px-2 py-1 text-left">ID</th><th className="px-2 py-1 text-left">Reason</th><th className="px-2 py-1 text-left">Category</th><th className="px-2 py-1 text-left">Started</th><th className="px-2 py-1 text-left">Duration</th><th className="px-2 py-1 text-left">Status</th></tr>
            </thead>
            <tbody>
              {downtime.map((d) => (
                <tr key={d.id} className="border-t border-border/40">
                  <td className="px-2 py-1.5 font-mono">{d.id}</td>
                  <td className="px-2 py-1.5">{d.reasonCode}</td>
                  <td className="px-2 py-1.5 text-muted-foreground">{d.category}</td>
                  <td className="px-2 py-1.5 font-mono">{d.startedAt}</td>
                  <td className="px-2 py-1.5 font-mono">{d.durationMin}m</td>
                  <td className="px-2 py-1.5">
                    <span className={`rounded px-1.5 py-0.5 text-[10px] ${d.status === "open" ? "bg-destructive/10 text-destructive" : "bg-success/10 text-success"}`}>{d.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Machine communication: send accept/reject + result log (automatic + configured only) */}
      {station.machine && station.machine.outputKind && station.machine.outputKind !== "none" && (
        <div className="glass-panel rounded-2xl p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
              <Wifi className="h-3 w-3" /> Machine communication
              <span className="ml-1 font-mono text-info">{station.machine.outputProtocol ?? "—"}</span>
              <span className="ml-1 font-mono text-muted-foreground">
                {station.machine.ipAddress}:{station.machine.port}
              </span>
            </div>
            <div className="flex gap-2">
              {station.machine.acceptCommand && (
                <button
                  onClick={() => {
                    store.sendStationCommand(station.id, "accept", outputs[0]?.id);
                    toast.success(`ACCEPT sent → ${station.machine!.acceptCommand}`);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-success/40 bg-success/10 px-3 py-1.5 text-xs font-medium text-success hover:bg-success/20"
                >
                  <Check className="h-3.5 w-3.5" /> Send ACCEPT <span className="font-mono text-[10px] opacity-70">{station.machine.acceptCommand}</span>
                </button>
              )}
              {station.machine.rejectCommand && (
                <button
                  onClick={() => {
                    store.sendStationCommand(station.id, "reject", outputs[0]?.id);
                    toast.error(`REJECT sent → ${station.machine!.rejectCommand}`);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/20"
                >
                  <Ban className="h-3.5 w-3.5" /> Send REJECT <span className="font-mono text-[10px] opacity-70">{station.machine.rejectCommand}</span>
                </button>
              )}
            </div>
          </div>

          {commands.length === 0 ? (
            <div className="mt-3 rounded-lg border border-dashed border-border/60 p-4 text-center text-xs text-muted-foreground">
              No commands sent yet. Use ACCEPT or REJECT above to test the machine protocol.
            </div>
          ) : (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-2 py-1 text-left">Time</th>
                    <th className="px-2 py-1 text-left">Kind</th>
                    <th className="px-2 py-1 text-left">Command</th>
                    <th className="px-2 py-1 text-left">Protocol</th>
                    <th className="px-2 py-1 text-left">Status</th>
                    <th className="px-2 py-1 text-left">Response</th>
                    <th className="px-2 py-1 text-left">Sent by</th>
                  </tr>
                </thead>
                <tbody>
                  {commands.map((c) => <CommandRow key={c.id} c={c} />)}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Output history (outputKind=file) */}
      {station.machine && station.machine.outputKind === "file" && (
        <div className="glass-panel rounded-2xl p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
              <History className="h-3 w-3" /> Output history · {outputs.length}
              {station.machine.outputLabel && (
                <span className="ml-1 font-mono text-muted-foreground">pattern: {station.machine.outputLabel}</span>
              )}
            </div>
            <UploadOutputButton onUpload={(f) => { store.uploadStationOutput(station.id, f); toast.success(`Uploaded ${f.name}`); }} />
          </div>

          {outputs.length === 0 ? (
            <div className="mt-3 rounded-lg border border-dashed border-border/60 p-4 text-center text-xs text-muted-foreground">
              No output files yet. Upload the payload the machine emits (image, report, batch record…).
            </div>
          ) : (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-2 py-1 text-left">File</th>
                    <th className="px-2 py-1 text-left">Size</th>
                    <th className="px-2 py-1 text-left">Decision</th>
                    <th className="px-2 py-1 text-left">Uploaded by</th>
                    <th className="px-2 py-1 text-left">Uploaded at</th>
                    <th className="px-2 py-1 text-left">Decided at</th>
                    <th className="px-2 py-1 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {outputs.map((o) => (
                    <tr key={o.id} className="border-t border-border/40">
                      <td className="px-2 py-1.5">
                        <div className="flex items-center gap-1.5">
                          <FileText className="h-3.5 w-3.5 text-info shrink-0" />
                          <a href={o.dataUrl} download={o.name} className="truncate font-medium hover:text-primary" title={o.name}>
                            {o.name}
                          </a>
                        </div>
                        <div className="font-mono text-[10px] text-muted-foreground">{o.mime ?? "binary"} · {o.id}</div>
                      </td>
                      <td className="px-2 py-1.5 font-mono text-[11px]">{Math.round(o.size / 1024)} KB</td>
                      <td className="px-2 py-1.5">
                        {o.decision ? (
                          <span className={`rounded-md border px-2 py-0.5 text-[10px] font-mono uppercase ${
                            o.decision === "accept"
                              ? "border-success/40 bg-success/10 text-success"
                              : "border-destructive/40 bg-destructive/10 text-destructive"
                          }`}>{o.decision}</span>
                        ) : (
                          <span className="rounded-md border border-border/60 bg-card/60 px-2 py-0.5 text-[10px] font-mono uppercase text-muted-foreground">pending</span>
                        )}
                      </td>
                      <td className="px-2 py-1.5">
                        <div>{o.actorName}</div>
                        <div className="font-mono text-[10px] text-muted-foreground">{o.actorId}</div>
                      </td>
                      <td className="px-2 py-1.5 font-mono text-[11px]">
                        {new Date(o.uploadedAt).toLocaleString([], { dateStyle: "short", timeStyle: "medium" })}
                      </td>
                      <td className="px-2 py-1.5 font-mono text-[11px] text-muted-foreground">
                        {o.decidedAt
                          ? new Date(o.decidedAt).toLocaleString([], { dateStyle: "short", timeStyle: "medium" })
                          : "—"}
                      </td>
                      <td className="px-2 py-1.5">
                        <div className="flex justify-end gap-1">
                          <a href={o.dataUrl} download={o.name} className="grid h-6 w-6 place-items-center rounded-md border border-border/60 bg-card/60 hover:text-primary" title="Download">
                            <span className="text-[10px]">↓</span>
                          </a>
                          <button onClick={() => { store.deleteStationOutput(o.id); toast.success("Removed"); }} className="grid h-6 w-6 place-items-center rounded-md border border-destructive/40 bg-destructive/10 text-destructive hover:bg-destructive/20" title="Delete">
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Assignment history */}
      <div className="glass-panel rounded-2xl p-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
            <History className="h-3 w-3" /> Operator assignment history · {assignmentHistory.length}
          </div>
          <button
            onClick={() => { store.refreshLive(); toast.success("Refreshed"); }}
            className="inline-flex items-center gap-1 rounded border border-border/60 bg-card/60 px-2 py-0.5 text-[10px] hover:border-primary/40 hover:text-primary"
          >
            <RefreshCw className="h-3 w-3" /> Refresh
          </button>
        </div>
        {assignmentHistory.length === 0 ? (
          <div className="mt-2 text-xs text-muted-foreground">No assignment changes recorded yet.</div>
        ) : (
          <ol className="mt-3 space-y-1.5">
            {assignmentHistory.map((e) => {
              const t = new Date(e.at).toLocaleString([], { dateStyle: "short", timeStyle: "medium" });
              const uid = (e.after as any)?.userId ?? (e.before as any)?.userId;
              const user = uid ? store.users.find((u) => u.id === uid) : undefined;
              const tone =
                e.action === "create" ? "border-success/40 bg-success/10 text-success"
                : e.action === "activate" ? "border-primary/40 bg-primary/10 text-primary"
                : e.action === "deactivate" ? "border-warning/40 bg-warning/10 text-warning"
                : e.action === "delete" ? "border-destructive/40 bg-destructive/10 text-destructive"
                : "border-info/40 bg-info/10 text-info";
              const label =
                e.action === "create" ? "Assigned"
                : e.action === "activate" ? "Reactivated"
                : e.action === "deactivate" ? "Unassigned"
                : e.action === "delete" ? "Removed"
                : "Updated";
              return (
                <li key={e.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-border/40 bg-background/40 p-2 text-xs">
                  <span className={`rounded border px-1.5 py-0.5 font-mono text-[10px] uppercase ${tone}`}>{label}</span>
                  {user ? (
                    <Link to="/users/$userId" params={{ userId: user.id }} className="font-medium hover:text-primary">
                      {user.name}
                    </Link>
                  ) : (
                    <span className="font-mono text-muted-foreground">{uid ?? "—"}</span>
                  )}
                  <span className="ml-auto font-mono text-[10px] text-muted-foreground">{t}</span>
                  <span className="w-full text-[11px] text-muted-foreground">
                    by <span className="text-foreground">{e.actorName}</span>
                    <span className="ml-1 font-mono text-[10px]">{e.entityId}</span>
                  </span>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </div>
  );
}

function KPI({ label, value, icon, tone }: { label: string; value: string; icon: React.ReactNode; tone: "primary" | "info" | "success" | "accent" }) {
  const ring = { primary: "border-primary/30 text-primary", info: "border-info/30 text-info", success: "border-success/30 text-success", accent: "border-accent/30 text-accent" }[tone];
  return (
    <div className="glass-panel rounded-xl p-4">
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
        <span className={`grid h-7 w-7 place-items-center rounded-md border ${ring}`}>{icon}</span>
      </div>
      <div className="mt-1 truncate font-mono text-lg font-semibold">{value}</div>
    </div>
  );
}

function Info({ label, icon, value }: { label: string; icon: React.ReactNode; value: string }) {
  return (
    <div className="rounded-md border border-border/40 bg-background/40 p-2">
      <div className="flex items-center gap-1 text-[9px] uppercase tracking-wider text-muted-foreground">{icon} {label}</div>
      <div className="mt-0.5 truncate font-mono">{value}</div>
    </div>
  );
}

function TemplatePicker({ assigned, all, onAdd }: { assigned: string[]; all: StepTemplate[]; onAdd: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const available = all.filter((t) => !assigned.includes(t.id));
  if (available.length === 0) return null;
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-0.5 rounded border border-primary/40 bg-primary/10 px-2 py-0.5 text-[10px] text-primary hover:bg-primary/20"
      >
        <Plus className="h-3 w-3" /> Add template
      </button>
      {open && (
        <div className="absolute right-0 top-full z-20 mt-1 max-h-56 w-64 overflow-y-auto rounded-lg border border-border/60 bg-card p-1 shadow-xl">
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

function AssignOperatorPicker({ stationId, currentUserId }: { stationId: string; currentUserId?: string }) {
  const store = useMes();
  const [open, setOpen] = useState(false);
  const candidates = store.users.filter((u) => u.role === "operator" || u.role === "team_lead");
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-0.5 rounded border border-primary/40 bg-primary/10 px-2 py-0.5 text-[10px] text-primary hover:bg-primary/20"
      >
        <Plus className="h-3 w-3" /> {currentUserId ? "Reassign" : "Assign"}
      </button>
      {open && (
        <div className="absolute right-0 top-full z-20 mt-1 max-h-56 w-64 overflow-y-auto rounded-lg border border-border/60 bg-card p-1 shadow-xl">
          {candidates.map((u) => (
            <button
              key={u.id}
              type="button"
              onClick={() => {
                // deactivate any current active assignment for this station
                store.assignments
                  .filter((a) => a.active && a.targetType === "station" && a.targetId === stationId)
                  .forEach((a) => store.updateAssignment(a.id, { active: false }));
                store.createAssignment({
                  userId: u.id,
                  targetType: "station",
                  targetId: stationId,
                  shift: u.shift,
                  startedAt: new Date().toTimeString().slice(0, 5),
                  active: true,
                });
                setOpen(false);
              }}
              className="block w-full rounded px-2 py-1 text-left text-[11px] hover:bg-primary/10"
              disabled={u.id === currentUserId}
            >
              <span className="font-mono text-[10px] text-muted-foreground">{u.id}</span> · {u.name}
              <span className="ml-1 text-[9px] uppercase text-muted-foreground">{u.role.replace("_", " ")}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function CommandRow({ c }: { c: StationCommand }) {
  const tone =
    c.status === "acknowledged" ? "border-success/40 bg-success/10 text-success"
    : c.status === "pending" ? "border-border/60 bg-card/60 text-muted-foreground"
    : c.status === "timeout" ? "border-warning/40 bg-warning/10 text-warning"
    : "border-destructive/40 bg-destructive/10 text-destructive";
  const at = new Date(c.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  return (
    <tr className="border-t border-border/40">
      <td className="px-2 py-1.5 font-mono text-[11px]">{at}</td>
      <td className="px-2 py-1.5">
        <span className={`rounded px-1.5 py-0.5 text-[10px] font-mono uppercase ${
          c.kind === "accept" ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"
        }`}>{c.kind}</span>
      </td>
      <td className="px-2 py-1.5 font-mono text-[11px]">{c.command}</td>
      <td className="px-2 py-1.5 font-mono text-[11px] text-muted-foreground">{c.protocol ?? "—"}</td>
      <td className="px-2 py-1.5">
        <span className={`rounded-md border px-1.5 py-0.5 text-[10px] font-mono uppercase ${tone}`}>
          {c.status === "pending" ? "sending…" : c.status}
        </span>
      </td>
      <td className="px-2 py-1.5 font-mono text-[11px] text-muted-foreground">{c.response ?? "—"}</td>
      <td className="px-2 py-1.5 text-[11px]">{c.actorName}</td>
    </tr>
  );
}

function UploadOutputButton({ onUpload }: { onUpload: (f: { name: string; size: number; mime?: string; dataUrl: string }) => void }) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20">
      <FileUp className="h-3.5 w-3.5" /> Upload output file
      <input
        type="file"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.currentTarget.value = "";
          if (!file) return;
          const max = 3 * 1024 * 1024;
          if (file.size > max) {
            toast.error("File too large — max 3MB");
            return;
          }
          const reader = new FileReader();
          reader.onload = () => onUpload({ name: file.name, size: file.size, mime: file.type, dataUrl: reader.result as string });
          reader.readAsDataURL(file);
        }}
      />
    </label>
  );
}
