import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, CalendarDays, Layers, Trash2, Undo2 } from "lucide-react";
import { useBatches, useUpdateBatch, useDeleteBatch, useBatchesRealtime, type ProductionBatch } from "@/lib/batches-db";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useMes } from "@/lib/mes-store";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/planner")({
  head: () => ({
    meta: [
      { title: "Production Planner · Cortanex MES" },
      { name: "description", content: "Day-timeline calendar for scheduling production batches across lines." },
      { property: "og:title", content: "Production Planner · Cortanex MES" },
      { property: "og:description", content: "Schedule production batches on lines across a day timeline." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Planner,
});

const HOUR_PX = 56;
const LANE_PX = 68;

/** Put overlapping batches on separate lanes so cards never cover each other. */
function assignLanes<T extends { s: number; e: number }>(items: T[]) {
  const ends: number[] = [];
  const out = [...items].sort((a, b) => a.s - b.s).map((it) => {
    let lane = ends.findIndex((end) => end <= it.s);
    if (lane === -1) { lane = ends.length; ends.push(it.e); } else ends[lane] = it.e;
    return { ...it, lane };
  });
  return { items: out, lanes: Math.max(1, ends.length) };
}
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
  useBatchesRealtime();
  const [day, setDay] = useState<Date>(() => startOfDay(new Date()));
  const { data: batches = [], isLoading } = useBatches();
  const store = useMes();
  const lines = store.lines;
  const update = useUpdateBatch();
  const del = useDeleteBatch();
  const [toDelete, setToDelete] = useState<ProductionBatch | null>(null);

  function unschedule(b: ProductionBatch) {
    update.mutate(
      { id: b.id, patch: { planned_start: null, planned_end: null } as never },
      { onSuccess: () => toast.success(`${b.number} moved back to unscheduled`), onError: (e) => toast.error(`Not changed — ${(e as Error).message}`) },
    );
  }
  function confirmDelete() {
    const b = toDelete; if (!b) return;
    del.mutate(b.id, {
      onSuccess: () => { toast.success(`${b.number} deleted`); setToDelete(null); },
      onError: (e) => { toast.error(`Not deleted — ${(e as Error).message}`); setToDelete(null); },
    });
  }
  const canDelete = (b: ProductionBatch) => !["running", "completed"].includes(b.status) && Number(b.qty_produced) === 0;

  const dayStart = day.getTime();
  const dayEnd = dayStart + 24 * 3600_000;

  const scheduledForDay = useMemo(
    () => batches.filter((b) => {
      if (!b.planned_start || !b.planned_end) return false;
      const s = new Date(b.planned_start).getTime();
      const e = new Date(b.planned_end).getTime();
      return e > dayStart && s < dayEnd;
    }),
    [batches, dayStart, dayEnd],
  );

  const unscheduled = useMemo(
    () => batches.filter((b) => (!b.planned_start || !b.planned_end) && b.status !== "completed" && b.status !== "cancelled"),
    [batches],
  );

  function blockFor(b: ProductionBatch) {
    const s = Math.max(new Date(b.planned_start!).getTime(), dayStart);
    const e = Math.min(new Date(b.planned_end!).getTime(), dayEnd);
    const startH = (s - dayStart) / 3600_000;
    const endH = (e - dayStart) / 3600_000;
    return { left: startH * HOUR_PX, width: Math.max(HOUR_PX * 0.3, (endH - startH) * HOUR_PX) };
  }

  function assignHere(b: ProductionBatch, lineId: string, hour: number) {
    const start = new Date(dayStart + hour * 3600_000);
    const end = new Date(start.getTime() + 4 * 3600_000);
    update.mutate(
      { id: b.id, patch: { line_id: lineId, planned_start: start.toISOString(), planned_end: end.toISOString() } },
      { onError: (e) => toast.error(`Not scheduled — ${(e as Error).message}`), onSuccess: () => toast.success(`Scheduled ${b.number} on ${lineId} at ${start.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`) },
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Production Planner</h1>
          <p className="text-sm text-muted-foreground">Day timeline · schedule <b>batches</b> on lines. Orders split into batches on the order page.</p>
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

      <div className="glass-panel rounded-2xl p-4">
        <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <Layers className="h-3.5 w-3.5" /> Unscheduled batches ({unscheduled.length})
        </div>
        <div className="flex flex-wrap gap-2">
          {unscheduled.length === 0 && <span className="text-xs text-muted-foreground">Nothing pending — every batch has a slot.</span>}
          {unscheduled.map((b) => (
            <UnscheduledChip key={b.id} b={b} lines={lines.map((l) => ({ id: l.id, name: l.name }))} onAssign={assignHere} onDelete={canDelete(b) ? () => setToDelete(b) : undefined} />
          ))}
        </div>
      </div>

      <div className="glass-panel overflow-hidden rounded-2xl">
        <div className="overflow-x-auto">
          <div style={{ minWidth: 24 * HOUR_PX + 200 }}>
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

            {lines.map((line) => {
              const { items, lanes } = assignLanes(
                scheduledForDay.filter((b) => b.line_id === line.id).map((b) => ({ b, s: new Date(b.planned_start!).getTime(), e: new Date(b.planned_end!).getTime() })),
              );
              return (
                <div key={line.id} className="grid grid-cols-[200px_1fr] border-b border-border/40">
                  <div className="border-r border-border/40 p-3">
                    <div className="text-sm font-medium">{line.name}</div>
                    <div className="font-mono text-[10px] text-muted-foreground">{line.id} · {line.plant}</div>
                    {lanes > 1 && <div className="mt-1 text-[10px] text-warning">{lanes} batches overlap</div>}
                  </div>
                  <div className="relative bg-card/20" style={{ height: lanes * LANE_PX + 12 }}>
                    {Array.from({ length: END_HOUR - START_HOUR }).map((_, i) => (
                      <div key={i} className="absolute inset-y-0 border-l border-border/20" style={{ left: i * HOUR_PX }} />
                    ))}
                    {items.map(({ b, lane }) => {
                      const box = blockFor(b);
                      const pct = Number(b.qty) > 0 ? Math.round((Number(b.qty_produced) / Number(b.qty)) * 100) : 0;
                      return (
                        <div
                          key={b.id}
                          data-testid={`plan-${b.id}`}
                          className={`group absolute h-16 rounded-lg border bg-gradient-to-br ${statusColor(b.status)} text-[11px] shadow-sm`}
                          style={{ left: box.left, width: box.width, top: 6 + lane * LANE_PX }}
                          title={`${b.number} · ${b.product_name}`}
                        >
                          <Link to="/batches/$batchId" params={{ batchId: b.id }} className="block h-full overflow-hidden p-2 pr-14 text-left hover:brightness-110">
                            <div className="truncate font-mono text-[10px] opacity-80">{b.number}</div>
                            <div className="truncate text-xs font-semibold">{b.product_name}</div>
                            <div className="truncate font-mono text-[10px] opacity-80">
                              {new Date(b.planned_start!).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} → {new Date(b.planned_end!).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} · {pct}%
                            </div>
                          </Link>
                          <div className="absolute right-1 top-1 flex gap-1">
                            {b.status !== "running" && b.status !== "completed" && (
                              <button type="button" onClick={() => unschedule(b)} aria-label={`Unschedule ${b.number}`} title="Move back to unscheduled"
                                className="grid h-6 w-6 place-items-center rounded border border-border/60 bg-background/80 text-muted-foreground hover:text-foreground"><Undo2 className="h-3 w-3" /></button>
                            )}
                            {canDelete(b) && (
                              <button type="button" onClick={() => setToDelete(b)} aria-label={`Delete ${b.number}`} title="Delete batch"
                                className="grid h-6 w-6 place-items-center rounded border border-destructive/40 bg-background/80 text-destructive hover:bg-destructive/10"><Trash2 className="h-3 w-3" /></button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {isLoading && <div className="p-6 text-center text-xs text-muted-foreground">Loading batches…</div>}
      </div>

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete batch {toDelete?.number}?</AlertDialogTitle>
            <AlertDialogDescription>
              The batch is removed from the plan and from its order. Batches that have started or produced output can't be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function UnscheduledChip({ b, lines, onAssign, onDelete }: {
  b: ProductionBatch;
  lines: { id: string; name: string }[];
  onAssign: (b: ProductionBatch, lineId: string, hour: number) => void;
  onDelete?: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex items-stretch overflow-hidden rounded-lg border border-border/60 bg-card/70 hover:border-primary/40">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button type="button" className="px-3 py-1.5 text-left text-xs">
            <div className="font-mono text-[10px] text-muted-foreground">{b.number}</div>
            <div className="text-xs font-medium">{b.product_name} · {Number(b.qty)}{b.uom}</div>
          </button>
        </PopoverTrigger>
        {/* Rendered in a portal so it floats above the timeline and flips when space is short. */}
        <PopoverContent align="start" collisionPadding={12} className="z-50 max-h-[60vh] w-72 overflow-y-auto p-2">
          <div className="mb-1 px-1 text-[10px] uppercase tracking-wider text-muted-foreground">Schedule at</div>
          {lines.map((l) => (
            <div key={l.id} className="mb-1">
              <div className="px-1 py-0.5 text-[11px] font-medium">{l.id} · {l.name}</div>
              <div className="flex flex-wrap gap-1">
                {[0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22].map((h) => (
                  <button type="button" key={h} onClick={() => { onAssign(b, l.id, h); setOpen(false); }}
                    className="rounded border border-border/60 bg-card/60 px-1.5 py-0.5 font-mono text-[10px] hover:border-primary/40">
                    {String(h).padStart(2, "0")}:00
                  </button>
                ))}
              </div>
            </div>
          ))}
        </PopoverContent>
      </Popover>
      {onDelete && (
        <button type="button" onClick={onDelete} aria-label={`Delete ${b.number}`} title="Delete batch"
          className="ml-1 grid w-8 place-items-center border-l border-border/60 text-destructive hover:bg-destructive/10">
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
