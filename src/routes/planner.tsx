import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { useProductionOrders, useUpdatePo, usePosRealtime, type ProductionOrder } from "@/lib/production-orders-db";
import { useMes } from "@/lib/mes-store";
import { toast } from "sonner";

export const Route = createFileRoute("/planner")({
  head: () => ({
    meta: [
      { title: "Production Planner · Cortanex MES" },
      { name: "description", content: "Day-timeline calendar for scheduling production orders across lines, with drag-free start/end editing." },
    ],
  }),
  component: Planner,
});

const HOUR_PX = 56; // 24 hours -> 1344px min width
const START_HOUR = 0;
const END_HOUR = 24;

function startOfDay(d: Date) { const c = new Date(d); c.setHours(0, 0, 0, 0); return c; }
function fmtDay(d: Date) { return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" }); }
function toIsoDate(d: Date) { return d.toISOString().slice(0, 10); }

function statusColor(s: string) {
  if (s === "running") return "from-success/60 to-success/30 border-success/50";
  if (s === "hold" || s === "paused") return "from-warning/60 to-warning/30 border-warning/50";
  if (s === "completed") return "from-muted/60 to-muted/30 border-border/60";
  if (s === "cancelled") return "from-destructive/40 to-destructive/20 border-destructive/40";
  return "from-primary/50 to-info/30 border-primary/40";
}

function Planner() {
  usePosRealtime();
  const [day, setDay] = useState<Date>(() => startOfDay(new Date()));
  const { data: pos = [], isLoading } = useProductionOrders();
  const store = useMes();
  const lines = store.lines;
  const update = useUpdatePo();

  const dayStart = day.getTime();
  const dayEnd = dayStart + 24 * 3600_000;

  const scheduledForDay = useMemo(
    () => pos.filter((o) => {
      if (!o.planned_start || !o.planned_end) return false;
      const s = new Date(o.planned_start).getTime();
      const e = new Date(o.planned_end).getTime();
      return e > dayStart && s < dayEnd;
    }),
    [pos, dayStart, dayEnd],
  );

  const unscheduled = useMemo(
    () => pos.filter((o) => (!o.planned_start || !o.planned_end) && o.status !== "completed" && o.status !== "cancelled"),
    [pos],
  );

  function blockFor(o: ProductionOrder) {
    const s = Math.max(new Date(o.planned_start!).getTime(), dayStart);
    const e = Math.min(new Date(o.planned_end!).getTime(), dayEnd);
    const startH = (s - dayStart) / 3600_000;
    const endH = (e - dayStart) / 3600_000;
    return { left: startH * HOUR_PX, width: Math.max(HOUR_PX * 0.3, (endH - startH) * HOUR_PX) };
  }

  function assignHere(o: ProductionOrder, lineId: string, hour: number) {
    const start = new Date(dayStart + hour * 3600_000);
    const end = new Date(start.getTime() + 4 * 3600_000); // default 4h block
    update.mutate(
      { id: o.id, patch: { line_id: lineId, planned_start: start.toISOString(), planned_end: end.toISOString() } },
      { onSuccess: () => toast.success(`Scheduled ${o.number} on ${lineId} at ${start.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`) },
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Production Planner</h1>
          <p className="text-sm text-muted-foreground">Day timeline · drop unscheduled orders on a line slot to plan</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setDay((d) => new Date(d.getTime() - 86400_000))} className="grid h-9 w-9 place-items-center rounded-lg border border-border/60 bg-card/60">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-card/60 px-3 py-1.5 text-sm">
            <CalendarDays className="h-4 w-4 text-primary" />
            <input
              type="date"
              value={toIsoDate(day)}
              onChange={(e) => setDay(startOfDay(new Date(e.target.value)))}
              className="bg-transparent text-sm focus:outline-none"
            />
            <span className="text-xs text-muted-foreground">{fmtDay(day)}</span>
          </div>
          <button onClick={() => setDay((d) => new Date(d.getTime() + 86400_000))} className="grid h-9 w-9 place-items-center rounded-lg border border-border/60 bg-card/60">
            <ChevronRight className="h-4 w-4" />
          </button>
          <button onClick={() => setDay(startOfDay(new Date()))} className="rounded-lg border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs text-primary">Today</button>
        </div>
      </div>

      {/* Unscheduled queue */}
      <div className="glass-panel rounded-2xl p-4">
        <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Unscheduled queue ({unscheduled.length})</div>
        <div className="flex flex-wrap gap-2">
          {unscheduled.length === 0 && <span className="text-xs text-muted-foreground">Nothing pending — every order has a slot.</span>}
          {unscheduled.map((o) => (
            <UnscheduledChip key={o.id} o={o} lines={lines.map((l) => ({ id: l.id, name: l.name }))} onAssign={assignHere} />
          ))}
        </div>
      </div>

      {/* Timeline */}
      <div className="glass-panel overflow-hidden rounded-2xl">
        <div className="overflow-x-auto">
          <div style={{ minWidth: 24 * HOUR_PX + 200 }}>
            {/* Header hours */}
            <div className="grid grid-cols-[200px_1fr] border-b border-border/60">
              <div className="p-3 text-[11px] uppercase tracking-wider text-muted-foreground">Line</div>
              <div className="relative h-10">
                {Array.from({ length: END_HOUR - START_HOUR }).map((_, i) => (
                  <div key={i} className="absolute top-0 h-full border-l border-border/40 text-[10px] text-muted-foreground"
                    style={{ left: i * HOUR_PX, width: HOUR_PX }}>
                    <div className="px-2 pt-2">{String(i).padStart(2, "0")}:00</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Rows */}
            {lines.map((line) => {
              const items = scheduledForDay.filter((o) => o.line_id === line.id);
              return (
                <div key={line.id} className="grid grid-cols-[200px_1fr] border-b border-border/40">
                  <div className="border-r border-border/40 p-3">
                    <div className="text-sm font-medium">{line.name}</div>
                    <div className="font-mono text-[10px] text-muted-foreground">{line.id} · {line.plant}</div>
                  </div>
                  <div className="relative h-20 bg-card/20">
                    {/* hour grid lines */}
                    {Array.from({ length: END_HOUR - START_HOUR }).map((_, i) => (
                      <div key={i} className="absolute inset-y-0 border-l border-border/20" style={{ left: i * HOUR_PX }} />
                    ))}
                    {items.map((o) => {
                      const b = blockFor(o);
                      return (
                        <Link
                          key={o.id}
                          to="/production-orders/$poId"
                          params={{ poId: o.id }}
                          className={`absolute top-2 h-16 rounded-lg border bg-gradient-to-br ${statusColor(o.status)} p-2 text-left text-[11px] shadow-sm transition hover:brightness-110`}
                          style={{ left: b.left, width: b.width }}
                          title={`${o.number} · ${o.product_name}`}
                        >
                          <div className="truncate font-mono text-[10px] opacity-80">{o.number}</div>
                          <div className="truncate text-xs font-semibold">{o.product_name}</div>
                          <div className="truncate font-mono text-[10px] opacity-80">
                            {new Date(o.planned_start!).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} → {new Date(o.planned_end!).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {isLoading && <div className="p-6 text-center text-xs text-muted-foreground">Loading orders…</div>}
      </div>
    </div>
  );
}

function UnscheduledChip({ o, lines, onAssign }: {
  o: ProductionOrder;
  lines: { id: string; name: string }[];
  onAssign: (o: ProductionOrder, lineId: string, hour: number) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button onClick={() => setOpen((v) => !v)}
        className="rounded-lg border border-border/60 bg-card/70 px-3 py-1.5 text-left text-xs hover:border-primary/40">
        <div className="font-mono text-[10px] text-muted-foreground">{o.number}</div>
        <div className="text-xs font-medium">{o.product_name} · {Number(o.qty)}{o.uom}</div>
      </button>
      {open && (
        <div className="absolute left-0 top-full z-20 mt-1 w-64 rounded-lg border border-border/60 bg-popover p-2 shadow-xl">
          <div className="mb-1 px-1 text-[10px] uppercase tracking-wider text-muted-foreground">Schedule at</div>
          {lines.map((l) => (
            <div key={l.id} className="mb-1">
              <div className="px-1 py-0.5 text-[11px] font-medium">{l.id} · {l.name}</div>
              <div className="flex flex-wrap gap-1">
                {[6, 8, 10, 12, 14, 16, 18, 20, 22].map((h) => (
                  <button key={h} onClick={() => { onAssign(o, l.id, h); setOpen(false); }}
                    className="rounded border border-border/60 bg-card/60 px-1.5 py-0.5 font-mono text-[10px] hover:bg-primary/10 hover:text-primary">
                    {String(h).padStart(2, "0")}:00
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
