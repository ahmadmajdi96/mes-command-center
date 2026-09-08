import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, ClipboardList, Layers, Plus, ExternalLink, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useProductionOrder, useUpdatePo } from "@/lib/production-orders-db";
import {
  useBatches, useSplitOrderIntoBatches, useDeleteBatch, useBatchesRealtime,
} from "@/lib/batches-db";
import { usePosRealtime } from "@/lib/production-orders-db";
import { DataMatrix } from "@/components/datamatrix";

export const Route = createFileRoute("/_authenticated/production-orders/$poId")({
  head: ({ params }) => ({ meta: [{ title: `PO ${params.poId} · Cortanex MES` }] }),
  component: PoDetail,
});

function PoDetail() {
  const { poId } = useParams({ from: "/_authenticated/production-orders/$poId" });
  usePosRealtime();
  useBatchesRealtime();
  const { data: po, isLoading } = useProductionOrder(poId);
  const { data: batches = [] } = useBatches(poId);
  const update = useUpdatePo();
  const split = useSplitOrderIntoBatches();
  const del = useDeleteBatch();

  const [batchCount, setBatchCount] = useState(3);

  if (isLoading) return <div className="text-sm text-muted-foreground">Loading…</div>;
  if (!po) return (
    <div className="glass-panel rounded-2xl p-8 text-center text-sm text-muted-foreground">
      Order not found. <Link to="/production-orders" className="text-primary">Back</Link>
    </div>
  );

  const totalBatchQty = batches.reduce((s, b) => s + Number(b.qty), 0);
  const totalProduced = batches.reduce((s, b) => s + Number(b.qty_produced), 0);
  const remaining = Math.max(0, Number(po.qty) - totalBatchQty);

  return (
    <div className="space-y-6">
      <Link to="/production-orders" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5" /> Production orders
      </Link>

      <div className="glass-panel rounded-2xl p-6">
        <div className="grid gap-6 md:grid-cols-[1fr_auto]">
          <div>
            <div className="flex items-center gap-3">
              <ClipboardList className="h-5 w-5 text-primary" />
              <h1 className="font-display text-2xl font-semibold tracking-tight">{po.number}</h1>
              <span className="rounded-full border border-border/60 bg-card/60 px-2 py-0.5 text-[10px] uppercase tracking-wider">{po.status}</span>
            </div>
            <div className="mt-1 font-mono text-xs text-muted-foreground">Order lot {po.lot_number}</div>
            <p className="mt-3 text-sm">{po.product_name} <span className="text-muted-foreground">· {po.sku}</span></p>

            <div className="mt-5 grid gap-3 sm:grid-cols-4">
              <Info label="Order qty" value={`${Number(po.qty).toLocaleString()} ${po.uom}`} />
              <Info label="Batched" value={`${totalBatchQty.toLocaleString()} / ${Number(po.qty).toLocaleString()}`} />
              <Info label="Produced" value={`${totalProduced.toLocaleString()} ${po.uom}`} />
              <Info label="Line (default)" value={po.line_id ?? "—"} />
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              {po.status === "scheduled" && (
                <button
                  onClick={() => update.mutate({ id: po.id, patch: { status: "released" } }, { onSuccess: () => toast.success("Released") })}
                  className="rounded-lg border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs text-primary hover:bg-primary/20"
                >Release</button>
              )}
              {po.status === "released" && (
                <button
                  onClick={() => update.mutate({ id: po.id, patch: { status: "running" } }, { onSuccess: () => toast.success("Started") })}
                  className="rounded-lg border border-success/40 bg-success/10 px-3 py-1.5 text-xs text-success hover:bg-success/20"
                >Start</button>
              )}
              {po.status === "running" && (
                <button
                  onClick={() => update.mutate({ id: po.id, patch: { status: "completed" } }, { onSuccess: () => toast.success("Completed") })}
                  className="rounded-lg border border-border/60 bg-card/60 px-3 py-1.5 text-xs"
                >Mark completed</button>
              )}
            </div>
          </div>

          <div className="grid place-items-center rounded-2xl border border-border/40 bg-card/40 p-4">
            <DataMatrix text={po.lot_number} scale={5} className="rounded bg-white" />
            <div className="mt-2 text-center text-[10px] uppercase tracking-wider text-muted-foreground">Order lot</div>
          </div>
        </div>
      </div>

      {/* Batches */}
      <div className="glass-panel rounded-2xl p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-sm font-semibold"><Layers className="h-4 w-4 text-primary" /> Batches</h2>
            <p className="text-xs text-muted-foreground">
              {batches.length.toLocaleString()} batch{batches.length === 1 ? "" : "es"} · {remaining.toLocaleString()} {po.uom} not yet batched
            </p>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="number" min={1} max={99} value={batchCount}
              onChange={(e) => setBatchCount(Math.max(1, parseInt(e.target.value || "1", 10)))}
              className="h-8 w-16 rounded-lg border border-border/60 bg-card/60 px-2 text-xs"
            />
            <button
              onClick={() => {
                if (remaining <= 0) { toast.error("Order is fully batched already"); return; }
                const perBatch = Math.floor(remaining / batchCount);
                const rem = remaining - perBatch * batchCount;
                const sizes = Array.from({ length: batchCount }, (_, i) => perBatch + (i < rem ? 1 : 0));
                split.mutate({ po, count: batchCount, sizes }, {
                  onSuccess: (rows) => toast.success(`${rows.length} batches created`),
                  onError: (e) => toast.error(String(e)),
                });
              }}
              disabled={split.isPending}
              className="flex items-center gap-1.5 rounded-lg bg-gradient-to-br from-primary to-info px-3 py-1.5 text-xs font-medium text-primary-foreground shadow-[var(--shadow-glow)]"
            >
              <Plus className="h-3.5 w-3.5" /> Split remaining into N batches
            </button>
          </div>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-card/60 text-[10px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left">Batch #</th>
                <th className="px-3 py-2 text-left">Lot</th>
                <th className="px-3 py-2 text-right">Qty</th>
                <th className="px-3 py-2 text-right">Produced</th>
                <th className="px-3 py-2 text-left">Line</th>
                <th className="px-3 py-2 text-left">Planned</th>
                <th className="px-3 py-2 text-left">Status</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {batches.map((b) => {
                const pct = Number(b.qty) > 0 ? Math.round((Number(b.qty_produced) / Number(b.qty)) * 100) : 0;
                return (
                  <tr key={b.id} className="border-t border-border/40 hover:bg-card/40">
                    <td className="px-3 py-2 font-mono text-primary">{b.number}</td>
                    <td className="px-3 py-2 font-mono">{b.lot_number}</td>
                    <td className="px-3 py-2 text-right font-mono">{Number(b.qty).toLocaleString()}</td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="h-1.5 w-16 overflow-hidden rounded-full bg-card/80">
                          <div className="h-full bg-gradient-to-r from-primary to-info" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="font-mono">{pct}%</span>
                      </div>
                    </td>
                    <td className="px-3 py-2 font-mono">{b.line_id ?? "—"}</td>
                    <td className="px-3 py-2 font-mono text-[10px]">
                      {b.planned_start ? new Date(b.planned_start).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "—"}
                    </td>
                    <td className="px-3 py-2">
                      <span className="rounded-full border border-border/60 bg-card/60 px-2 py-0.5 text-[10px] uppercase tracking-wider">{b.status}</span>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link to="/batches/$batchId" params={{ batchId: b.id }} className="inline-flex items-center gap-1 text-primary">
                          Open <ExternalLink className="h-3 w-3" />
                        </Link>
                        <button onClick={() => { if (confirm(`Delete ${b.number}?`)) del.mutate(b.id); }} className="text-muted-foreground hover:text-destructive">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {batches.length === 0 && (
                <tr><td colSpan={8} className="px-3 py-6 text-center text-muted-foreground">No batches yet — split the order to start.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border/40 bg-card/40 p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 font-mono text-sm">{value}</div>
    </div>
  );
}
