import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useMes } from "@/lib/mes-store";
import { StatusPill } from "@/components/status-pill";
import {
  ArrowLeft, Package, Factory, User as UserIcon, Clock, Gauge, ClipboardList,
  GitBranch, AlertOctagon, ShieldAlert, CheckCircle2, Circle, AlertTriangle,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/work-orders/$woId")({
  head: ({ params }) => ({
    meta: [
      { title: `Work Order ${params.woId} · Profile · Cortanex MES` },
      { name: "description", content: "Work order profile — item, line, recipe steps, genealogy, holds and downtime." },
    ],
  }),
  component: WorkOrderProfile,
  notFoundComponent: () => (
    <div className="grid place-items-center p-12 text-sm text-muted-foreground">Work order not found.</div>
  ),
});

function WorkOrderProfile() {
  const { woId } = Route.useParams();
  const store = useMes();
  const wo = store.workOrders.find((w) => w.id === woId);
  if (!wo) throw notFound();

  const line = store.lines.find((l) => l.id === wo.lineId);
  const steps = store.steps.filter((s) => s.workOrderId === wo.id).sort((a, b) => a.sequence - b.sequence);
  const genealogy = store.genealogy.filter((g) => g.workOrderId === wo.id);
  const holds = store.holds.filter((h) => h.workOrderId === wo.id);
  const downtime = store.downtime.filter((d) => d.workOrderId === wo.id);
  const stations = line ? store.stations.filter((s) => s.lineId === line.id).sort((a, b) => a.sequence - b.sequence) : [];
  const operators = stations
    .map((s) => {
      const a = store.assignments.find((x) => x.active && x.targetType === "station" && x.targetId === s.id);
      return a ? { station: s, user: store.users.find((u) => u.id === a.userId)! } : null;
    })
    .filter(Boolean) as { station: typeof stations[number]; user: NonNullable<ReturnType<typeof store.users.find>> }[];

  return (
    <div className="space-y-6">
      <div>
        <Link to="/work-orders" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3 w-3" /> All work orders
        </Link>
      </div>

      {/* Hero */}
      <div className="glass-panel rounded-2xl p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-primary to-info text-primary-foreground shadow-[var(--shadow-glow)]">
              <ClipboardList className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-display text-2xl font-semibold tracking-tight font-mono">{wo.id}</h1>
                <StatusPill status={wo.status} />
              </div>
              <p className="text-xs text-muted-foreground">
                ERP <span className="font-mono">{wo.productionOrderId}</span> · Shift {wo.shift} ·
                {line ? <> on <Link to="/lines/$lineId" params={{ lineId: line.id }} className="text-primary hover:underline ml-1">{line.name}</Link></> : ` ${wo.lineId}`}
              </p>
            </div>
          </div>
          <div className="rounded-xl border border-primary/30 bg-primary/5 p-3 min-w-[220px]">
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-primary/80">
              <Package className="h-3 w-3" /> Item
            </div>
            <div className="mt-1 text-sm font-semibold">{wo.product}</div>
            <div className="font-mono text-[11px] text-muted-foreground">{wo.sku} · {wo.uom}</div>
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-4">
          <KPI icon={<Gauge />} label="Progress" value={`${wo.progress}%`} tone="primary" />
          <KPI icon={<Package />} label="Produced" value={`${wo.qtyProduced.toLocaleString()} / ${wo.qtyTarget.toLocaleString()}`} tone="info" />
          <KPI icon={<Clock />} label="Window" value={`${wo.startedAt ?? "—"} → ${wo.endsAt ?? "—"}`} tone="success" />
          <KPI icon={<UserIcon />} label="Operator (WO)" value={wo.operator ?? "—"} tone="accent" />
        </div>

        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-gradient-to-r from-primary to-info" style={{ width: `${wo.progress}%` }} />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Recipe steps */}
        <div className="glass-panel rounded-2xl p-4 lg:col-span-2">
          <h2 className="font-display text-sm font-semibold uppercase tracking-wider text-muted-foreground">Recipe steps · {steps.length}</h2>
          {steps.length === 0 ? (
            <div className="mt-2 text-xs text-muted-foreground">No recipe steps defined for this work order.</div>
          ) : (
            <ol className="mt-2 space-y-2">
              {steps.map((s) => {
                const Icon = s.status === "done" ? CheckCircle2 : s.status === "active" ? Circle : s.status === "warn" ? AlertTriangle : Circle;
                const tone = s.status === "done" ? "text-success" : s.status === "active" ? "text-primary" : s.status === "warn" ? "text-warning" : "text-muted-foreground";
                return (
                  <li key={s.id} className="rounded-lg border border-border/40 bg-background/40 p-3">
                    <div className="flex items-start gap-2">
                      <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${tone}`} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-2">
                          <div className="text-sm font-medium">{s.sequence}. {s.instruction}</div>
                          <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{s.status}</span>
                        </div>
                        <div className="mt-1 grid gap-2 text-[11px] sm:grid-cols-3">
                          <span className="text-muted-foreground">Target: <span className="font-mono text-foreground">{s.target}</span></span>
                          <span className="text-muted-foreground">Tolerance: <span className="font-mono text-foreground">{s.tolerance}</span></span>
                          <span className="text-muted-foreground">Captured: <span className="font-mono text-foreground">{s.capturedValue ?? "—"}</span></span>
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </div>

        {/* Operators on this WO's line */}
        <div className="glass-panel rounded-2xl p-4">
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
            <UserIcon className="h-3 w-3" /> Operators on the floor
          </div>
          {operators.length === 0 ? (
            <div className="mt-2 text-xs text-muted-foreground">No operators currently on stations of this line.</div>
          ) : (
            <ul className="mt-2 space-y-1.5">
              {operators.map(({ station, user }) => (
                <li key={station.id} className="rounded-md border border-border/40 bg-background/40 p-2">
                  <Link to="/users/$userId" params={{ userId: user.id }} className="block text-sm font-medium hover:text-primary">{user.name}</Link>
                  <div className="font-mono text-[10px] text-muted-foreground">{station.id} · {station.name}</div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Genealogy */}
        <div className="glass-panel rounded-2xl p-4 lg:col-span-2">
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
            <GitBranch className="h-3 w-3" /> Genealogy · {genealogy.length}
          </div>
          {genealogy.length === 0 ? (
            <div className="mt-2 text-xs text-muted-foreground">No genealogy records yet.</div>
          ) : (
            <table className="mt-2 w-full text-xs">
              <thead className="text-[10px] uppercase tracking-wider text-muted-foreground">
                <tr><th className="px-2 py-1 text-left">Input lot</th><th className="px-2 py-1 text-left">Material</th><th className="px-2 py-1 text-left">Supplier</th><th className="px-2 py-1 text-right">Qty</th><th className="px-2 py-1 text-left">At</th></tr>
              </thead>
              <tbody>
                {genealogy.map((g) => (
                  <tr key={g.id} className="border-t border-border/40">
                    <td className="px-2 py-1.5 font-mono">{g.inputLotId}</td>
                    <td className="px-2 py-1.5">{g.material}</td>
                    <td className="px-2 py-1.5 text-muted-foreground">{g.supplier}</td>
                    <td className="px-2 py-1.5 text-right font-mono">{g.qtyConsumed} {g.uom}</td>
                    <td className="px-2 py-1.5 font-mono text-muted-foreground">{g.recordedAt}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Holds + Downtime */}
        <div className="space-y-4">
          <div className="glass-panel rounded-2xl p-4">
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
              <ShieldAlert className="h-3 w-3" /> Quality holds · {holds.length}
            </div>
            {holds.length === 0 ? (
              <div className="mt-2 text-xs text-muted-foreground">No holds.</div>
            ) : holds.map((h) => (
              <div key={h.id} className="mt-2 rounded border border-border/40 bg-background/40 p-2 text-[11px]">
                <div className="font-medium">{h.reason}</div>
                <div className="font-mono text-[10px] text-muted-foreground">{h.id} · {h.severity} · {h.status}</div>
              </div>
            ))}
          </div>

          <div className="glass-panel rounded-2xl p-4">
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
              <AlertOctagon className="h-3 w-3" /> Downtime · {downtime.length}
            </div>
            {downtime.length === 0 ? (
              <div className="mt-2 text-xs text-muted-foreground">No downtime.</div>
            ) : downtime.map((d) => (
              <div key={d.id} className="mt-2 rounded border border-border/40 bg-background/40 p-2 text-[11px]">
                <div className="font-medium">{d.reasonCode}</div>
                <div className="font-mono text-[10px] text-muted-foreground">{d.startedAt} · {d.durationMin}m · {d.status}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function KPI({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: string; tone: "primary" | "info" | "success" | "accent" }) {
  const ring = { primary: "border-primary/30 text-primary", info: "border-info/30 text-info", success: "border-success/30 text-success", accent: "border-accent/30 text-accent" }[tone];
  return (
    <div className="rounded-xl border border-border/60 bg-background/40 p-3">
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
        <span className={`grid h-6 w-6 place-items-center rounded-md border ${ring}`}>{icon}</span>
      </div>
      <div className="mt-1 truncate font-mono text-sm font-semibold">{value}</div>
    </div>
  );
}
