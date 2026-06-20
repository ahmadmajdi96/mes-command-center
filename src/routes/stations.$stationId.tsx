import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useState } from "react";
import { useMes } from "@/lib/mes-store";
import type { StepTemplate } from "@/lib/mes-data";
import {
  ArrowLeft, Cpu, Hand, Network, Wifi, User as UserIcon, ShieldAlert,
  ClipboardList, Activity, Gauge, Clock, Radio, AlertOctagon, ListChecks, Plus,
} from "lucide-react";

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
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
              <UserIcon className="h-3 w-3" /> Operator on station
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
              </div>
            ) : (
              <div className="mt-2 text-xs text-warning">No operator currently assigned. Assign from the Assignments page.</div>
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
