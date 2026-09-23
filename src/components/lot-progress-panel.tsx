import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Boxes } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useLotProgress, useRecordLotProgress } from "@/lib/lifecycle-db";
import { useWasteReasons } from "@/lib/hmi-db";
import { useCan } from "@/lib/access";

/**
 * Quantity capture for lines that track lots instead of individual items.
 * Either the batch or the station can be fixed by the caller; the other is
 * picked here.
 */
export function LotProgressPanel({
  batchId,
  stationId,
  lineId,
}: {
  batchId?: string;
  stationId?: string;
  lineId?: string | null;
}) {
  const canRecord = useCan("execution.record");
  const record = useRecordLotProgress();

  const { data: batches = [] } = useQuery({
    queryKey: ["lot_batches", lineId ?? "all"],
    enabled: !batchId,
    queryFn: async () => {
      let q = supabase
        .from("production_batches")
        .select("id, number, lot_number, qty, uom, status, line_id")
        .in("status", ["released", "running", "paused"])
        .order("sequence");
      if (lineId) q = q.eq("line_id", lineId);
      const { data, error } = await q.limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: stations = [] } = useQuery({
    queryKey: ["lot_stations", lineId ?? "all"],
    enabled: !stationId,
    queryFn: async () => {
      let q = supabase.from("stations").select("id, name, line_id, sequence").order("sequence");
      if (lineId) q = q.eq("line_id", lineId);
      const { data, error } = await q.limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });

  const [batch, setBatch] = useState(batchId ?? "");
  const [station, setStation] = useState(stationId ?? "");
  const [good, setGood] = useState(0);
  const [rework, setRework] = useState(0);
  const [scrap, setScrap] = useState(0);
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");

  const effBatch = batchId ?? batch;
  const effStation = stationId ?? station;

  const { data: reasons = [] } = useWasteReasons();
  const { data: history = [] } = useLotProgress({
    batch_id: effBatch || undefined,
    station_id: effStation || undefined,
    limit: 25,
  });

  const totals = useMemo(
    () =>
      history.reduce(
        (t, r) => ({
          good: t.good + Number(r.qty_good),
          rework: t.rework + Number(r.qty_rework),
          scrap: t.scrap + Number(r.qty_scrap),
        }),
        { good: 0, rework: 0, scrap: 0 },
      ),
    [history],
  );

  function submit() {
    if (!effBatch) return toast.error("Pick a batch");
    if (!effStation) return toast.error("Pick a station");
    record.mutate(
      {
        batch_id: effBatch,
        station_id: effStation,
        qty_good: good,
        qty_rework: rework,
        qty_scrap: scrap,
        scrap_reason_code: scrap > 0 ? reason || null : null,
        notes: notes || undefined,
      },
      {
        onSuccess: () => {
          toast.success("Quantities recorded");
          setGood(0);
          setRework(0);
          setScrap(0);
          setReason("");
          setNotes("");
        },
        onError: (e) => toast.error(e instanceof Error ? e.message : String(e)),
      },
    );
  }

  return (
    <div className="glass-panel rounded-2xl p-5">
      <h2 className="flex items-center gap-2 text-sm font-semibold">
        <Boxes className="h-4 w-4 text-primary" /> Lot quantities
      </h2>
      <p className="text-xs text-muted-foreground">
        This line records quantities per batch and station instead of scanning each item.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {!batchId && (
          <label className="block text-xs">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Batch</span>
            <select
              value={batch}
              onChange={(e) => setBatch(e.target.value)}
              className="mt-1 h-9 w-full rounded-lg border border-border/60 bg-card/60 px-2 text-sm"
            >
              <option value="">— select batch —</option>
              {batches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.number} · {b.lot_number} ({Number(b.qty)} {b.uom})
                </option>
              ))}
            </select>
          </label>
        )}
        {!stationId && (
          <label className="block text-xs">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Station</span>
            <select
              value={station}
              onChange={(e) => setStation(e.target.value)}
              className="mt-1 h-9 w-full rounded-lg border border-border/60 bg-card/60 px-2 text-sm"
            >
              <option value="">— select station —</option>
              {stations.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.id} · {s.name}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <QtyInput label="Good" value={good} onChange={setGood} tone="success" />
        <QtyInput label="Rework" value={rework} onChange={setRework} tone="warning" />
        <QtyInput label="Scrap" value={scrap} onChange={setScrap} tone="destructive" />
      </div>

      {scrap > 0 && (
        <label className="mt-3 block text-xs">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Scrap reason</span>
          <select
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="mt-1 h-9 w-full rounded-lg border border-border/60 bg-card/60 px-2 text-sm"
          >
            <option value="">— select reason —</option>
            {reasons.map((r) => (
              <option key={r.id} value={r.code}>
                [{r.category}] {r.label}
              </option>
            ))}
          </select>
        </label>
      )}

      <input
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Notes (optional)…"
        className="mt-3 h-9 w-full rounded-lg border border-border/60 bg-card/60 px-2 text-sm"
      />

      <div className="mt-3 flex items-center justify-between gap-3">
        <div className="font-mono text-[10px] text-muted-foreground">
          Recorded here so far — good {totals.good} · rework {totals.rework} · scrap {totals.scrap}
        </div>
        <button
          onClick={submit}
          disabled={!canRecord || record.isPending}
          className="rounded-lg bg-gradient-to-br from-primary to-info px-3 py-2 text-xs font-medium text-primary-foreground shadow-[var(--shadow-glow)] disabled:opacity-50"
        >
          {record.isPending ? "Recording…" : "Record quantities"}
        </button>
      </div>
      {!canRecord && (
        <p className="mt-2 text-[11px] text-muted-foreground">
          You do not have permission to record production quantities.
        </p>
      )}

      {history.length > 0 && (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-card/60 text-[10px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left">When</th>
                <th className="px-3 py-2 text-left">Station</th>
                <th className="px-3 py-2 text-right">Good</th>
                <th className="px-3 py-2 text-right">Rework</th>
                <th className="px-3 py-2 text-right">Scrap</th>
                <th className="px-3 py-2 text-left">By</th>
              </tr>
            </thead>
            <tbody>
              {history.map((r) => (
                <tr key={r.id} className="border-t border-border/40">
                  <td className="px-3 py-2 font-mono text-[10px]">
                    {new Date(r.created_at).toLocaleString([], {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </td>
                  <td className="px-3 py-2 font-mono">{r.station_name ?? r.station_id ?? "—"}</td>
                  <td className="px-3 py-2 text-right font-mono text-success">{Number(r.qty_good)}</td>
                  <td className="px-3 py-2 text-right font-mono text-warning">{Number(r.qty_rework)}</td>
                  <td className="px-3 py-2 text-right font-mono text-destructive">{Number(r.qty_scrap)}</td>
                  <td className="px-3 py-2">{r.operator_name ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function QtyInput({
  label,
  value,
  onChange,
  tone,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  tone: "success" | "warning" | "destructive";
}) {
  const toneClass =
    tone === "success"
      ? "border-success/40 text-success"
      : tone === "warning"
        ? "border-warning/40 text-warning"
        : "border-destructive/40 text-destructive";
  return (
    <label className="block text-xs">
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
      <input
        type="number"
        min={0}
        value={value}
        onChange={(e) => onChange(Math.max(0, Number(e.target.value || 0)))}
        className={`mt-1 h-11 w-full rounded-lg border bg-background/60 px-2 font-mono text-base ${toneClass}`}
      />
    </label>
  );
}
