import { useMes } from "@/lib/mes-store";
import { INTERVALS, SHIFT_WINDOWS, type DashFilters } from "@/lib/dashboard-metrics";
import { Factory, Clock, CalendarRange } from "lucide-react";

const sel = "rounded-lg border border-border/60 bg-card/60 px-2.5 py-1.5 text-xs outline-none focus:border-primary/60";

export function DashFilterBar({ f, set, showLine = false }: { f: DashFilters; set: (p: Partial<DashFilters>) => void; showLine?: boolean }) {
  const store = useMes();
  const plants = [...new Set(store.lines.map((l) => l.plant))].sort();
  const lines = store.lines.filter((l) => f.plant === "all" || l.plant === f.plant);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Factory className="h-3.5 w-3.5" />
        <select aria-label="Plant" className={sel} value={f.plant} onChange={(e) => set({ plant: e.target.value, lineId: "all", stationId: "all" })}>
          <option value="all">All plants</option>
          {plants.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
      </label>
      <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Clock className="h-3.5 w-3.5" />
        <select aria-label="Shift" className={sel} value={f.shift} onChange={(e) => set({ shift: e.target.value as DashFilters["shift"] })}>
          <option value="all">All shifts</option>
          {(Object.keys(SHIFT_WINDOWS) as Array<keyof typeof SHIFT_WINDOWS>).map((k) => <option key={k} value={k}>{SHIFT_WINDOWS[k].label}</option>)}
        </select>
      </label>
      <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <CalendarRange className="h-3.5 w-3.5" />
        <select aria-label="Time interval" className={sel} value={f.interval} onChange={(e) => set({ interval: e.target.value as DashFilters["interval"] })}>
          {INTERVALS.map((i) => <option key={i.key} value={i.key}>{i.label}</option>)}
        </select>
      </label>
      {showLine && (
        <select aria-label="Line" className={sel} value={f.lineId} onChange={(e) => set({ lineId: e.target.value, stationId: "all" })}>
          <option value="all">All lines</option>
          {lines.map((l) => <option key={l.id} value={l.id}>{l.id} · {l.name}</option>)}
        </select>
      )}
    </div>
  );
}
