import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, Package, Send, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { useUnit, useUnitEvents, useProcessUnitAtStation, useUnitsRealtime } from "@/lib/units-db";
import { DataMatrix } from "@/components/datamatrix";
import { useMes } from "@/lib/mes-store";

export const Route = createFileRoute("/units/$uid")({
  head: ({ params }) => ({ meta: [{ title: `Unit ${params.uid} · Cortanex MES` }] }),
  component: UnitDetail,
});

function UnitDetail() {
  const { uid } = useParams({ from: "/units/$uid" });
  useUnitsRealtime();
  const { data: unit, isLoading } = useUnit(uid);
  const { data: events = [] } = useUnitEvents(uid);
  const process = useProcessUnitAtStation();

  const store = useMes();
  const stations = store.stations;
  const [stationId, setStationId] = useState<string>("");
  const [event, setEvent] = useState<string>("processed");
  const [notes, setNotes] = useState("");

  if (isLoading) return <div className="text-sm text-muted-foreground">Loading…</div>;
  if (!unit) return (
    <div className="glass-panel rounded-2xl p-8 text-center text-sm text-muted-foreground">
      Unit not found. <Link to="/tracking" className="text-primary">Back to tracking</Link>
    </div>
  );

  const station = stations.find((s) => s.id === stationId);

  return (
    <div className="space-y-6">
      <Link to="/tracking" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5" /> Tracking
      </Link>

      <div className="glass-panel rounded-2xl p-6">
        <div className="grid gap-6 md:grid-cols-[1fr_auto]">
          <div>
            <div className="flex items-center gap-3">
              <Package className="h-5 w-5 text-primary" />
              <h1 className="font-display text-2xl font-semibold tracking-tight">{unit.uid}</h1>
              <span className="rounded-full border border-border/60 bg-card/60 px-2 py-0.5 text-[10px] uppercase tracking-wider">{unit.status}</span>
            </div>
            <p className="mt-1 text-sm">{unit.product_name} <span className="text-muted-foreground">· {unit.sku}</span></p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Info label="Lot" value={unit.lot_number} />
              <Info label="Production order" value={
                <Link to="/production-orders/$poId" params={{ poId: unit.production_order_id ?? "" }} className="text-primary">
                  {unit.production_order_id ?? "—"}
                </Link>
              } />
              <Info label="Current station" value={unit.current_station_id ?? "—"} />
              <Info label="Current line" value={unit.current_line_id ?? "—"} />
            </div>
          </div>

          <div className="grid place-items-center rounded-2xl border border-border/40 bg-card/40 p-4">
            <DataMatrix text={unit.uid} scale={6} className="rounded bg-white" />
            <div className="mt-2 text-center font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{unit.uid}</div>
          </div>
        </div>
      </div>

      {/* Scan-at-station form */}
      <div className="glass-panel rounded-2xl p-5">
        <h2 className="text-sm font-semibold">Process at station</h2>
        <p className="text-xs text-muted-foreground">Record this unit passing through, or being rejected at, a station.</p>
        <div className="mt-3 grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
          <select value={stationId} onChange={(e) => setStationId(e.target.value)}
            className="h-9 rounded-lg border border-border/60 bg-card/60 px-2 text-sm">
            <option value="">Select station…</option>
            {stations.map((s) => <option key={s.id} value={s.id}>{s.id} · {s.name} ({s.lineId})</option>)}
          </select>
          <select value={event} onChange={(e) => setEvent(e.target.value)}
            className="h-9 rounded-lg border border-border/60 bg-card/60 px-2 text-sm">
            <option value="enter">Enter station (start timer)</option>
            <option value="exit_pass">Exit · pass</option>
            <option value="exit_reject">Exit · reject (fail)</option>
            <option value="exit_complete">Exit · final step complete</option>
          </select>
          <button
            disabled={!stationId || process.isPending}
            onClick={() => {
              if (!station) return;
              process.mutate({
                unit_uid: unit.uid,
                station_id: station.id,
                station_name: station.name,
                line_id: station.lineId,
                event,
                operator_id: store.currentActor.id,
                operator_name: store.currentActor.name,
                notes: notes || undefined,
              }, {
                onSuccess: () => { toast.success(`${event} at ${station.id}`); setNotes(""); },
                onError: (e) => toast.error(String(e)),
              });
            }}
            className="flex items-center gap-1.5 rounded-lg bg-gradient-to-br from-primary to-info px-3 py-1.5 text-xs font-medium text-primary-foreground shadow-[var(--shadow-glow)] disabled:opacity-50"
          >
            <Send className="h-3.5 w-3.5" /> Record
          </button>
        </div>
        <input
          value={notes} onChange={(e) => setNotes(e.target.value)}
          placeholder="Notes (optional)…"
          className="mt-2 h-9 w-full rounded-lg border border-border/60 bg-card/60 px-2 text-sm focus:border-primary/50 focus:outline-none"
        />
      </div>

      {/* Timeline */}
      <div className="glass-panel rounded-2xl p-5">
        <h2 className="text-sm font-semibold">Station history</h2>
        <p className="text-xs text-muted-foreground">{events.length} events</p>
        {events.length === 0 && <p className="mt-3 text-xs text-muted-foreground">This unit hasn't been scanned at any station yet.</p>}
        <ol className="mt-4 space-y-3">
          {events.map((e) => (
            <li key={e.id} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-3 rounded-xl border border-border/40 bg-card/40 p-3 text-xs">
              {e.event === "rejected" ? <XCircle className="mt-0.5 h-4 w-4 text-destructive" /> : <CheckCircle2 className="mt-0.5 h-4 w-4 text-success" />}
              <div className="min-w-0">
                <div className="font-medium">
                  {e.event.toUpperCase()} at <span className="font-mono text-primary">{e.station_id}</span>
                  {e.station_name ? <span className="text-muted-foreground"> · {e.station_name}</span> : null}
                </div>
                {e.operator_name && <div className="text-[10px] text-muted-foreground">by {e.operator_name}</div>}
                {e.notes && <div className="mt-1 text-[11px] text-muted-foreground">{e.notes}</div>}
              </div>
              <div className="font-mono text-[10px] text-muted-foreground">{new Date(e.at).toLocaleString()}</div>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border/40 bg-card/40 p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 font-mono text-sm">{value}</div>
    </div>
  );
}
