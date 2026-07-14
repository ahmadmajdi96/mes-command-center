import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, ClipboardList, Plus, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { useProductionOrder, useUpdatePo } from "@/lib/production-orders-db";
import { useUnits, useGenerateUnits, useUnitsRealtime } from "@/lib/units-db";
import { DataMatrix } from "@/components/datamatrix";

export const Route = createFileRoute("/production-orders/$poId")({
  head: ({ params }) => ({ meta: [{ title: `PO ${params.poId} · Cortanex MES` }] }),
  component: PoDetail,
});

function PoDetail() {
  const { poId } = useParams({ from: "/production-orders/$poId" });
  useUnitsRealtime();
  const { data: po, isLoading } = useProductionOrder(poId);
  const { data: units = [] } = useUnits({ po: poId });
  const update = useUpdatePo();
  const gen = useGenerateUnits();

  const [count, setCount] = useState(10);

  if (isLoading) return <div className="text-sm text-muted-foreground">Loading…</div>;
  if (!po) return (
    <div className="glass-panel rounded-2xl p-8 text-center text-sm text-muted-foreground">
      Order not found. <Link to="/production-orders" className="text-primary">Back</Link>
    </div>
  );

  const remaining = Math.max(0, Number(po.qty) - units.length);

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
            <div className="mt-1 font-mono text-xs text-muted-foreground">Lot {po.lot_number}</div>
            <p className="mt-3 text-sm">{po.product_name} <span className="text-muted-foreground">· {po.sku}</span></p>

            <div className="mt-5 grid gap-3 sm:grid-cols-4">
              <Info label="Qty target" value={`${Number(po.qty).toLocaleString()} ${po.uom}`} />
              <Info label="Produced" value={`${Number(po.qty_produced).toLocaleString()} ${po.uom}`} />
              <Info label="Line" value={po.line_id ?? "—"} />
              <Info label="Shift" value={po.shift} />
            </div>

            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <Info label="Planned start" value={po.planned_start ? new Date(po.planned_start).toLocaleString() : "—"} />
              <Info label="Planned end" value={po.planned_end ? new Date(po.planned_end).toLocaleString() : "—"} />
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              {po.status === "scheduled" && (
                <button
                  onClick={() => update.mutate({ id: po.id, patch: { status: "released" } }, { onSuccess: () => toast.success("Released") })}
                  className="rounded-lg border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs text-primary hover:bg-primary/20"
                >
                  Release
                </button>
              )}
              {po.status === "released" && (
                <button
                  onClick={() => update.mutate({ id: po.id, patch: { status: "running" } }, { onSuccess: () => toast.success("Started") })}
                  className="rounded-lg border border-success/40 bg-success/10 px-3 py-1.5 text-xs text-success hover:bg-success/20"
                >
                  Start
                </button>
              )}
              {po.status === "running" && (
                <button
                  onClick={() => update.mutate({ id: po.id, patch: { status: "completed" } }, { onSuccess: () => toast.success("Completed") })}
                  className="rounded-lg border border-border/60 bg-card/60 px-3 py-1.5 text-xs"
                >
                  Mark completed
                </button>
              )}
            </div>
          </div>

          <div className="grid place-items-center rounded-2xl border border-border/40 bg-card/40 p-4">
            <DataMatrix text={po.lot_number} scale={5} className="rounded bg-white" />
            <div className="mt-2 text-center text-[10px] uppercase tracking-wider text-muted-foreground">Lot barcode</div>
          </div>
        </div>
      </div>

      <div className="glass-panel rounded-2xl p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold">Unit identifiers</h2>
            <p className="text-xs text-muted-foreground">
              {units.length.toLocaleString()} generated · {remaining.toLocaleString()} remaining to reach target
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
                gen.mutate({ po, count: toGen }, {
                  onSuccess: (rows) => toast.success(`${rows.length} unit IDs generated`),
                  onError: (e) => toast.error(String(e)),
                });
              }}
              disabled={gen.isPending}
              className="flex items-center gap-1.5 rounded-lg bg-gradient-to-br from-primary to-info px-3 py-1.5 text-xs font-medium text-primary-foreground shadow-[var(--shadow-glow)]"
            >
              <Plus className="h-3.5 w-3.5" /> Generate UIDs
            </button>
          </div>
        </div>

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
                <tr><td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">No units generated yet — click <b>Generate UIDs</b>.</td></tr>
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
