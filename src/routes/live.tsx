import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { useMes } from "@/lib/mes-store";
import { StatusPill } from "@/components/status-pill";
import {
  Factory, Activity, Cpu, Hand, User as UserIcon, Radio, ArrowRight,
  Package, ClipboardList, Gauge, AlertOctagon, ShieldAlert, Clock,
} from "lucide-react";

export const Route = createFileRoute("/live")({
  head: () => ({
    meta: [
      { title: "Live Shop Floor · Cortanex MES" },
      { name: "description", content: "Real-time visualization of every production line — current work orders, items, operators and station-level telemetry." },
    ],
  }),
  component: LivePage,
});

function initials(n: string) {
  return n.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();
}

function LivePage() {
  const store = useMes();

  const lastTick = useMemo(() => {
    const ticks = store.stations.map((s) => s.lastTickAt).filter(Boolean) as string[];
    return ticks.sort().at(-1);
  }, [store.stations]);

  const running = store.lines.filter((l) => l.status === "running").length;
  const down = store.lines.filter((l) => l.status === "down").length;
  const openDt = store.downtime.filter((d) => d.status === "open").length;
  const activeOps = store.assignments.filter((a) => a.active && a.targetType === "station").length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Live Shop Floor</h1>
          <p className="text-sm text-muted-foreground">
            Real-time view of every line, work order and operator on the floor.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-success/40 bg-success/10 px-3 py-1 text-xs text-success">
          <Radio className="h-3 w-3 animate-pulse" />
          live{lastTick ? ` · last tick ${lastTick}` : ""}
        </div>
      </div>

      {/* Top strip */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={<Factory />} label="Lines running" value={`${running}/${store.lines.length}`} tone="success" />
        <StatCard icon={<AlertOctagon />} label="Lines down" value={String(down)} tone="destructive" />
        <StatCard icon={<UserIcon />} label="Operators on station" value={String(activeOps)} tone="info" />
        <StatCard icon={<ShieldAlert />} label="Open downtime" value={String(openDt)} tone="warning" />
      </div>

      {/* Per-line live cards */}
      <div className="space-y-4">
        {store.lines.map((line) => {
          const stations = store.stations
            .filter((s) => s.lineId === line.id)
            .sort((a, b) => a.sequence - b.sequence);

          const wo = line.currentWorkOrder
            ? store.workOrders.find((w) => w.id === line.currentWorkOrder)
            : store.workOrders.find((w) => w.lineId === line.id && w.status === "running");

          const lineAssignments = store.assignments.filter(
            (a) => a.active && a.targetType === "station" && stations.some((s) => s.id === a.targetId),
          );
          const operators = lineAssignments
            .map((a) => ({ asmt: a, user: store.users.find((u) => u.id === a.userId)! }))
            .filter((x) => x.user);

          const openDtLine = store.downtime.filter((d) => d.lineId === line.id && d.status === "open");

          return (
            <div key={line.id} className="glass-panel overflow-hidden rounded-2xl">
              {/* Line header */}
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border/40 bg-card/40 p-4">
                <div className="flex items-start gap-3">
                  <div className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-primary to-info text-primary-foreground shadow-[var(--shadow-glow)]">
                    <Factory className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <Link to="/lines/$lineId" params={{ lineId: line.id }} className="text-base font-semibold hover:text-primary">
                        {line.name}
                      </Link>
                      <StatusPill status={line.status} />
                    </div>
                    <p className="font-mono text-[11px] text-muted-foreground">{line.id} · {line.plant}</p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="rounded-md border border-border/60 bg-background/40 px-2 py-1">
                    <Gauge className="mr-1 inline h-3 w-3 text-primary" /> OEE <span className="ml-1 font-mono">{line.oee}%</span>
                  </span>
                  <span className="rounded-md border border-border/60 bg-background/40 px-2 py-1">
                    <Clock className="mr-1 inline h-3 w-3 text-success" /> Uptime <span className="ml-1 font-mono">{line.uptime}</span>
                  </span>
                  <span className="rounded-md border border-border/60 bg-background/40 px-2 py-1">
                    <Activity className="mr-1 inline h-3 w-3 text-info" /> <span className="font-mono">{line.output.toLocaleString()} / {line.target.toLocaleString()}</span>
                  </span>
                </div>
              </div>

              {/* Body: WO + operators + stations */}
              <div className="grid gap-4 p-4 lg:grid-cols-[320px_1fr]">
                {/* Work order + operators column */}
                <div className="space-y-3">
                  <div className="rounded-xl border border-primary/30 bg-primary/5 p-3">
                    <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-primary/80">
                      <ClipboardList className="h-3 w-3" /> Active work order
                    </div>
                    {wo ? (
                      <div className="mt-1.5">
                        <Link to="/work-orders/$woId" params={{ woId: wo.id }} className="font-mono text-sm font-semibold hover:underline">
                          {wo.id}
                        </Link>
                        <div className="mt-1 flex items-center gap-1.5 text-xs">
                          <Package className="h-3 w-3 text-muted-foreground" />
                          <span className="truncate font-medium">{wo.product}</span>
                          <span className="font-mono text-[10px] text-muted-foreground">· {wo.sku}</span>
                        </div>
                        <div className="mt-2 text-[11px] text-muted-foreground">
                          <span className="font-mono">{wo.productionOrderId}</span> · Shift {wo.shift} · {wo.startedAt} → {wo.endsAt}
                        </div>
                        <div className="mt-2">
                          <div className="flex justify-between text-[10px] uppercase tracking-wider text-muted-foreground">
                            <span>Progress</span><span className="font-mono">{wo.progress}%</span>
                          </div>
                          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                            <div className="h-full rounded-full bg-gradient-to-r from-primary to-info" style={{ width: `${wo.progress}%` }} />
                          </div>
                          <div className="mt-1 font-mono text-[10px] text-muted-foreground">
                            {wo.qtyProduced.toLocaleString()} / {wo.qtyTarget.toLocaleString()} {wo.uom}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-1.5 text-xs text-muted-foreground">No active work order on this line.</div>
                    )}
                  </div>

                  <div className="rounded-xl border border-border/40 bg-background/40 p-3">
                    <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                      <UserIcon className="h-3 w-3" /> Operators on station · {operators.length}
                    </div>
                    {operators.length === 0 ? (
                      <div className="mt-1.5 text-xs text-warning">No operators assigned.</div>
                    ) : (
                      <ul className="mt-2 space-y-1.5">
                        {operators.map(({ asmt, user }) => {
                          const st = stations.find((s) => s.id === asmt.targetId);
                          return (
                            <li key={asmt.id} className="flex items-center gap-2 rounded-md border border-border/40 bg-card/40 p-1.5">
                              <div className="grid h-7 w-7 place-items-center rounded-md bg-gradient-to-br from-primary to-info text-[10px] font-bold text-primary-foreground">
                                {initials(user.name)}
                              </div>
                              <div className="min-w-0 flex-1">
                                <Link to="/users/$userId" params={{ userId: user.id }} className="block truncate text-xs font-medium hover:text-primary">
                                  {user.name}
                                </Link>
                                <div className="truncate font-mono text-[10px] text-muted-foreground">
                                  {st ? `${st.id} · ${st.name}` : asmt.targetId}
                                </div>
                              </div>
                              <span className="rounded border border-border/60 bg-background/60 px-1.5 py-0.5 text-[9px] uppercase">{user.role.replace("_", " ")}</span>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>

                  {openDtLine.length > 0 && (
                    <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-3">
                      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-destructive">
                        <AlertOctagon className="h-3 w-3" /> {openDtLine.length} open downtime
                      </div>
                      {openDtLine.slice(0, 3).map((d) => (
                        <div key={d.id} className="mt-1 text-[11px]">
                          <span className="font-medium">{d.reasonCode}</span>
                          <span className="ml-1 font-mono text-muted-foreground">· {d.durationMin}m</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Live station flow */}
                <div className="rounded-xl border border-border/40 bg-background/30 p-3">
                  <div className="mb-2 flex items-center justify-between text-[10px] uppercase tracking-wider text-muted-foreground">
                    <span>Live station flow · {stations.length}</span>
                    <Link to="/lines/$lineId" params={{ lineId: line.id }} className="inline-flex items-center gap-1 text-primary hover:underline">
                      Open line <ArrowRight className="h-3 w-3" />
                    </Link>
                  </div>
                  {stations.length === 0 ? (
                    <div className="rounded-md border border-dashed border-border/60 p-6 text-center text-xs text-muted-foreground">
                      No stations configured.
                    </div>
                  ) : (
                    <div className="flex items-stretch gap-2 overflow-x-auto pb-1">
                      {stations.map((s, idx) => {
                        const op = store.assignments.find(
                          (a) => a.active && a.targetType === "station" && a.targetId === s.id,
                        );
                        const opUser = op ? store.users.find((u) => u.id === op.userId) : undefined;
                        const dot =
                          s.status === "running" ? "bg-success animate-pulse"
                          : s.status === "down" ? "bg-destructive"
                          : s.status === "maintenance" ? "bg-warning"
                          : "bg-muted-foreground";
                        const ring =
                          s.status === "running" ? "border-success/40"
                          : s.status === "down" ? "border-destructive/40"
                          : s.status === "maintenance" ? "border-warning/40"
                          : "border-border/60";
                        return (
                          <div key={s.id} className="flex items-stretch gap-1">
                            <Link
                              to="/stations/$stationId"
                              params={{ stationId: s.id }}
                              className={`block w-56 shrink-0 rounded-lg border bg-card/60 p-2.5 transition hover:border-primary/50 ${ring}`}
                            >
                              <div className="flex items-start justify-between">
                                <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                                  <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
                                  Seq {s.sequence}
                                </div>
                                <span className={`grid h-5 w-5 place-items-center rounded border ${s.type === "automatic" ? "border-primary/40 text-primary" : "border-accent/40 text-accent"}`}>
                                  {s.type === "automatic" ? <Cpu className="h-3 w-3" /> : <Hand className="h-3 w-3" />}
                                </span>
                              </div>
                              <div className="mt-1 truncate text-xs font-semibold">{s.name}</div>
                              <div className="font-mono text-[10px] text-muted-foreground">{s.id}</div>

                              <div className="mt-2 rounded bg-background/60 p-1.5">
                                <div className="truncate text-[10px] text-muted-foreground">{s.currentStep ?? "—"}</div>
                                <div className="mt-0.5 flex items-baseline justify-between">
                                  <span className="font-mono text-sm font-semibold text-primary">{s.currentValue ?? "—"}</span>
                                  <span className="font-mono text-[10px] text-muted-foreground">/ {s.target ?? "—"}</span>
                                </div>
                              </div>

                              <div className="mt-2 flex items-center gap-1.5 border-t border-border/40 pt-1.5 text-[11px]">
                                <UserIcon className="h-3 w-3 text-muted-foreground" />
                                {opUser ? (
                                  <span className="truncate">{opUser.name}</span>
                                ) : (
                                  <span className="text-warning">unassigned</span>
                                )}
                              </div>
                            </Link>
                            {idx < stations.length - 1 && (
                              <div className="flex items-center"><ArrowRight className="h-3 w-3 text-muted-foreground/60" /></div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: string; tone: "success" | "destructive" | "info" | "warning" }) {
  const ring = {
    success: "border-success/30 text-success",
    destructive: "border-destructive/30 text-destructive",
    info: "border-info/30 text-info",
    warning: "border-warning/30 text-warning",
  }[tone];
  return (
    <div className="glass-panel rounded-xl p-4">
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
        <span className={`grid h-7 w-7 place-items-center rounded-md border ${ring}`}>{icon}</span>
      </div>
      <div className="mt-1 font-mono text-2xl font-semibold">{value}</div>
    </div>
  );
}
