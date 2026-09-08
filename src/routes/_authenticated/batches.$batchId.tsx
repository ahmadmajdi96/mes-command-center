import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, Layers, Plus, ExternalLink, Printer, ClipboardList } from "lucide-react";
import { toast } from "sonner";
import { useBatch, useUpdateBatch, useBatchesRealtime, batchStatuses } from "@/lib/batches-db";
import { useUnits, useGenerateUnits, useUnitsRealtime } from "@/lib/units-db";
import { useProductionOrder } from "@/lib/production-orders-db";
import { DataMatrix } from "@/components/datamatrix";
import { useMes } from "@/lib/mes-store";

export const Route = createFileRoute("/_authenticated/batches/$batchId")({
  head: ({ params }) => ({ meta: [{ title: `Batch ${params.batchId} · Cortanex MES` }] }),
  component: BatchDetail,
});

function BatchDetail() {
  const { batchId } = useParams({ from: "/_authenticated/batches/$batchId" });
  useBatchesRealtime();
  useUnitsRealtime();
  const { data: batch, isLoading } = useBatch(batchId);
  const { data: po } = useProductionOrder(batch?.production_order_id);
  const { data: units = [] } = useUnits({ batch: batchId, limit: 5000 });
  const update = useUpdateBatch();
  const gen = useGenerateUnits();
  const store = useMes();

  const [count, setCount] = useState(10);
  const [showLabels, setShowLabels] = useState(false);

  if (isLoading) return <div className="text-sm text-muted-foreground">Loading…</div>;
  if (!batch) return (
    <div className="glass-panel rounded-2xl p-8 text-center text-sm text-muted-foreground">
      Batch not found. <Link to="/production-orders" className="text-primary">Back</Link>
    </div>
  );

  const remaining = Math.max(0, Number(batch.qty) - units.length);
  const pct = Number(batch.qty) > 0 ? Math.round((Number(batch.qty_produced) / Number(batch.qty)) * 100) : 0;

  return (
    <div className="space-y-6 print:space-y-3">
      <div className="print:hidden">
        <Link to="/production-orders/$poId" params={{ poId: batch.production_order_id }} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> Order {po?.number ?? batch.production_order_id}
        </Link>
      </div>

      <div className="glass-panel rounded-2xl p-6 print:border print:bg-white print:text-black">
        <div className="grid gap-6 md:grid-cols-[1fr_auto]">
          <div>
            <div className="flex items-center gap-3">
              <Layers className="h-5 w-5 text-primary print:text-black" />
              <h1 className="font-display text-2xl font-semibold tracking-tight">{batch.number}</h1>
              <span className="rounded-full border border-border/60 bg-card/60 px-2 py-0.5 text-[10px] uppercase tracking-wider print:hidden">{batch.status}</span>
            </div>
            <div className="mt-1 font-mono text-xs text-muted-foreground">Lot {batch.lot_number}</div>
            <p className="mt-3 text-sm">{batch.product_name} <span className="text-muted-foreground">· {batch.sku}</span></p>

            <div className="mt-5 grid gap-3 sm:grid-cols-4">
              <Info label="Batch qty" value={`${Number(batch.qty).toLocaleString()} ${batch.uom}`} />
              <Info label="UIDs generated" value={`${units.length.toLocaleString()} / ${Number(batch.qty).toLocaleString()}`} />
              <Info label="Produced" value={`${Number(batch.qty_produced).toLocaleString()} (${pct}%)`} />
              <Info label="Line" value={batch.line_id ?? "—"} />
            </div>

            <div className="mt-3 grid gap-3 sm:grid-cols-2 print:hidden">
              <label className="rounded-xl border border-border/40 bg-card/40 p-3 text-xs">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Line</div>
                <select
                  value={batch.line_id ?? ""}
                  onChange={(e) => update.mutate({ id: batch.id, patch: { line_id: e.target.value || null } })}
                  className="mt-1 h-8 w-full rounded-lg border border-border/60 bg-card/60 px-2 text-sm"
                >
                  <option value="">— unassigned —</option>
                  {store.lines.map((l) => <option key={l.id} value={l.id}>{l.id} · {l.name}</option>)}
                </select>
              </label>
              <label className="rounded-xl border border-border/40 bg-card/40 p-3 text-xs">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Status</div>
                <select
                  value={batch.status}
                  onChange={(e) => update.mutate({ id: batch.id, patch: { status: e.target.value } })}
                  className="mt-1 h-8 w-full rounded-lg border border-border/60 bg-card/60 px-2 text-sm"
                >
                  {batchStatuses.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </label>
            </div>
          </div>

          <div className="grid place-items-center rounded-2xl border border-border/40 bg-card/40 p-4 print:bg-white">
            <DataMatrix text={batch.lot_number} scale={5} className="rounded bg-white" />
            <div className="mt-2 text-center text-[10px] uppercase tracking-wider text-muted-foreground print:text-black">Batch lot</div>
          </div>
        </div>
      </div>

      <div className="glass-panel rounded-2xl p-5 print:hidden">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold">Unit identifiers</h2>
            <p className="text-xs text-muted-foreground">
              {units.length.toLocaleString()} generated · {remaining.toLocaleString()} remaining
            </p>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="number" min={1} value={count}
              onChange={(e) => setCount(Math.max(1, parseInt(e.target.value || "1", 10)))}
              className="h-8 w-20 rounded-lg border border-border/60 bg-card/60 px-2 text-xs"
            />
            <button
              onClick={() => {
                const toGen = Math.min(count, remaining || count);
                gen.mutate({ batch, count: toGen }, {
                  onSuccess: (rows) => toast.success(`${rows.length} unit IDs generated`),
                  onError: (e) => toast.error(String(e)),
                });
              }}
              disabled={gen.isPending || remaining <= 0}
              className="flex items-center gap-1.5 rounded-lg bg-gradient-to-br from-primary to-info px-3 py-1.5 text-xs font-medium text-primary-foreground shadow-[var(--shadow-glow)] disabled:opacity-50"
            >
              <Plus className="h-3.5 w-3.5" /> Generate UIDs
            </button>
            <button
              onClick={() => setShowLabels((v) => !v)}
              className="flex items-center gap-1.5 rounded-lg border border-border/60 bg-card/60 px-3 py-1.5 text-xs"
            >
              <Printer className="h-3.5 w-3.5" /> {showLabels ? "Table view" : "Label sheet"}
            </button>
            {showLabels && (
              <button onClick={() => window.print()} className="rounded-lg border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs text-primary">
                Print
              </button>
            )}
          </div>
        </div>

        {!showLabels && (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-card/60 text-[10px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left">UID</th>
                  <th className="px-3 py-2 text-left">Serial</th>
                  <th className="px-3 py-2 text-left">Current station</th>
                  <th className="px-3 py-2 text-left">Status</th>
                  <th className="px-3 py-2 text-right">Trace</th>
                </tr>
              </thead>
              <tbody>
                {units.map((u) => (
                  <tr key={u.uid} className="border-t border-border/40 hover:bg-card/40">
                    <td className="px-3 py-2 font-mono text-primary">{u.uid}</td>
                    <td className="px-3 py-2 font-mono">{u.serial}</td>
                    <td className="px-3 py-2 font-mono">{u.current_station_id ?? "—"}</td>
                    <td className="px-3 py-2">
                      <span className="rounded-full border border-border/60 bg-card/60 px-2 py-0.5 text-[10px] uppercase tracking-wider">{u.status}</span>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Link to="/units/$uid" params={{ uid: u.uid }} className="inline-flex items-center gap-1 text-primary">
                        Open <ExternalLink className="h-3 w-3" />
                      </Link>
                    </td>
                  </tr>
                ))}
                {units.length === 0 && (
                  <tr><td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">No units yet — generate UIDs.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Printable label sheet */}
      {showLabels && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 print:grid-cols-4 print:gap-2">
          {units.map((u) => (
            <div key={u.uid} className="rounded-xl border border-border/60 bg-card/60 p-3 text-center print:break-inside-avoid print:border print:bg-white print:text-black">
              <DataMatrix text={u.uid} scale={4} className="mx-auto rounded bg-white" />
              <div className="mt-1 font-mono text-[10px] text-primary print:text-black">{u.uid}</div>
              <div className="font-mono text-[9px] text-muted-foreground print:text-black">{u.product_name}</div>
            </div>
          ))}
        </div>
      )}

      <div className="print:hidden">
        <Link to="/tracking" className="inline-flex items-center gap-1.5 text-xs text-primary">
          <ClipboardList className="h-3.5 w-3.5" /> Track units on the shop floor →
        </Link>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border/40 bg-card/40 p-3 print:bg-white">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground print:text-black">{label}</div>
      <div className="mt-1 font-mono text-sm">{value}</div>
    </div>
  );
}
