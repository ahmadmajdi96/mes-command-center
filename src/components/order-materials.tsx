import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Package, ScanLine, Layers, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useRows, useWrite, errMsg } from "@/lib/execution-db";
import { useCanAny } from "@/lib/access";
import { REWORK_STATUS } from "@/lib/wip-db";
import { ReworkActions } from "@/routes/_authenticated/rework";

const inp = "h-8 w-full rounded-lg border border-border/60 bg-card/60 px-2 text-xs";
const btn = "inline-flex items-center gap-1 rounded-lg border border-primary/40 bg-primary/10 px-2.5 py-1.5 text-xs text-primary hover:bg-primary/20 disabled:opacity-50";

async function actor() {
  const { data } = await supabase.auth.getUser();
  return { actor_user_id: data.user?.id ?? null, actor_name: (data.user?.user_metadata?.full_name as string) || data.user?.email || "Unknown" };
}

/** Planned vs actual material per lot, semi-finished output and rework tasks for one order. */
export function OrderMaterials({ po }: { po: any }) {
  const { data: comps = [] } = useRows<any>("order_components", { eq: { production_order_id: po.id }, order: "created_at", asc: true });
  const { data: cons = [] } = useRows<any>("material_consumptions", { eq: { production_order_id: po.id } });
  const { data: lots = [] } = useRows<any>("material_lots", { order: "created_at", asc: true });
  const { data: ops = [] } = useRows<any>("order_operations", { eq: { production_order_id: po.id }, order: "sequence", asc: true });
  const { data: batches = [] } = useRows<any>("production_batches", { eq: { production_order_id: po.id }, order: "sequence", asc: true });
  const { data: tasks = [] } = useRows<any>("rework_tasks", { eq: { production_order_id: po.id } });
  const consW = useWrite("material_consumptions");
  const lotW = useWrite("material_lots");
  const rwW = useWrite("rework_tasks");
  const canRecord = useCanAny("execution.record", "material.handle");
  const canRework = useCanAny("execution.rework", "execution.override");
  const live = ["released", "running"].includes(po.status);

  const components = comps.filter((c) => c.item_type === "component");
  const table = useMemo(() => components.map((c) => {
    const used = cons.filter((m) => m.component_sku === c.component_sku);
    const actual = used.reduce((s, m) => s + Number(m.qty), 0);
    return { ...c, actual, variance: actual - Number(c.planned_qty), lots: Array.from(new Set(used.map((m) => m.input_lot).filter(Boolean))), scanned: used.some((m) => !m.backflush) };
  }), [components, cons]);

  const [f, setF] = useState({ sku: "", lot: "", qty: 0, op: "" });
  const lotOptions = lots.filter((l) => l.sku === f.sku && l.status === "available" && Number(l.qty_remaining) > 0);
  const [sf, setSf] = useState({ op: "", sku: "", qty: 0 });
  const [rw, setRw] = useState({ qty: 0, reason: "", batch: "", op: "", instructions: "" });
  const rejectedTotal = ops.reduce((s, o) => s + Number(o.qty_rejected ?? 0), 0);
  const inRework = tasks.filter((t) => !["scrapped"].includes(t.status)).reduce((s, t) => s + Number(t.qty), 0);

  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <div className="glass-panel rounded-2xl p-5">
        <h2 className="flex items-center gap-2 text-sm font-semibold"><Package className="h-4 w-4 text-primary" />Materials: planned vs actual</h2>
        <p className="text-xs text-muted-foreground">Scan the actual lot used. Scanned materials are not backflushed again at the end.</p>
        <table className="mt-3 w-full text-xs"><thead className="text-[10px] uppercase text-muted-foreground"><tr><th className="py-2 text-left">Material</th><th className="text-right">Planned</th><th className="text-right">Actual</th><th className="text-right">Variance</th><th className="text-left">Lots</th></tr></thead>
          <tbody>{table.map((c) => (
            <tr key={c.id} className="border-t border-border/40"><td className="py-2">{c.component_sku}<div className="text-muted-foreground">{c.component_name}</div></td>
              <td className="text-right font-mono">{Number(c.planned_qty)} {c.uom}</td><td className="text-right font-mono">{c.actual}</td>
              <td className={`text-right font-mono ${c.actual && Math.abs(c.variance) > Number(c.planned_qty) * 0.05 ? "text-warning" : ""}`}>{c.actual ? (c.variance > 0 ? "+" : "") + Math.round(c.variance * 100) / 100 : "—"}</td>
              <td className="font-mono text-[10px]">{c.lots.map((l: string) => { const lot = lots.find((x) => x.lot_number === l && x.sku === c.component_sku); return lot ? <Link key={l} to="/material-lots/$lotId" params={{ lotId: lot.id }} className="mr-1 text-primary">{l}</Link> : <span key={l} className="mr-1">{l}</span>; })}{c.scanned ? "" : c.lots.length ? " (backflush)" : ""}</td></tr>
          ))}{table.length === 0 && <tr><td colSpan={5} className="py-4 text-center text-muted-foreground">No components on this order.</td></tr>}</tbody></table>
        {canRecord && live && (
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <label className="text-[11px] text-muted-foreground">Material<select className={inp} aria-label="Consume material" value={f.sku} onChange={(e) => setF({ ...f, sku: e.target.value, lot: "" })}><option value="">Choose…</option>{components.map((c) => <option key={c.id} value={c.component_sku}>{c.component_sku} · {c.component_name}</option>)}</select></label>
            <label className="text-[11px] text-muted-foreground">Lot (scan or pick)<input className={inp} aria-label="Consume lot" list="lot-opts" value={f.lot} onChange={(e) => setF({ ...f, lot: e.target.value })} placeholder="Lot number" /><datalist id="lot-opts">{lotOptions.map((l) => <option key={l.id} value={l.lot_number}>{Number(l.qty_remaining)} {l.uom} left</option>)}</datalist><span>{lotOptions.length} available lot(s)</span></label>
            <label className="text-[11px] text-muted-foreground">Quantity used<input className={inp} aria-label="Consume quantity" type="number" min={0} value={f.qty} onChange={(e) => setF({ ...f, qty: Number(e.target.value) })} /></label>
            <label className="text-[11px] text-muted-foreground">Step<select className={inp} value={f.op} onChange={(e) => setF({ ...f, op: e.target.value })}><option value="">Order level</option>{ops.map((o) => <option key={o.id} value={o.id}>{o.sequence} {o.name}</option>)}</select></label>
            <button className={`${btn} sm:col-span-2 justify-center`} disabled={!f.sku || !f.lot || f.qty <= 0 || consW.insert.isPending} onClick={async () => {
              const c = components.find((x) => x.component_sku === f.sku);
              consW.insert.mutate({ organization_id: po.organization_id, production_order_id: po.id, operation_id: f.op || null, component_sku: f.sku, component_name: c?.component_name, qty: f.qty, uom: c?.uom, input_lot: f.lot.trim(), backflush: false, notes: "Scanned lot", ...(await actor()) },
                { onSuccess: () => { toast.success("Consumption recorded"); setF({ sku: "", lot: "", qty: 0, op: "" }); }, onError: (e) => toast.error(errMsg(e)) });
            }}><ScanLine className="h-3 w-3" />Record actual use</button>
          </div>
        )}

        <h3 className="mt-6 flex items-center gap-2 text-sm font-semibold"><Layers className="h-4 w-4 text-primary" />Semi-finished output</h3>
        <p className="text-xs text-muted-foreground">Intermediate goods made at a step, stored as a lot that later steps or other orders can consume.</p>
        <ul className="mt-2 space-y-1 text-xs">{lots.filter((l) => l.kind === "semi_finished" && l.source_order_id === po.id).map((l) => (
          <li key={l.id} className="flex justify-between rounded-lg border border-border/40 px-3 py-1.5"><Link to="/material-lots/$lotId" params={{ lotId: l.id }} className="font-mono text-primary">{l.lot_number}</Link><span>{l.sku} · {Number(l.qty_remaining)}/{Number(l.qty_received)} {l.uom}</span></li>
        ))}</ul>
        {canRecord && live && (
          <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_1fr_100px_auto] sm:items-end">
            <select className={inp} aria-label="Semi step" value={sf.op} onChange={(e) => setSf({ ...sf, op: e.target.value })}><option value="">Step…</option>{ops.map((o) => <option key={o.id} value={o.id}>{o.sequence} {o.name}</option>)}</select>
            <input className={inp} aria-label="Semi SKU" placeholder="Intermediate SKU e.g. WHEAT-TEMPERED" value={sf.sku} onChange={(e) => setSf({ ...sf, sku: e.target.value })} />
            <input className={inp} aria-label="Semi qty" type="number" min={0} value={sf.qty} onChange={(e) => setSf({ ...sf, qty: Number(e.target.value) })} />
            <button className={btn} disabled={!sf.op || !sf.sku.trim() || sf.qty <= 0} onClick={async () => {
              const op = ops.find((o) => o.id === sf.op);
              const n = lots.filter((l) => l.source_order_id === po.id && l.kind === "semi_finished").length + 1;
              lotW.insert.mutate({ organization_id: po.organization_id, sku: sf.sku.trim().toUpperCase(), name: `${op?.name} output`, lot_number: `${po.lot_number}-SF${String(n).padStart(2, "0")}`, kind: "semi_finished", qty_received: sf.qty, qty_remaining: sf.qty, uom: po.uom, source_order_id: po.id, source_operation_id: sf.op, ...(await actor()) },
                { onSuccess: () => { toast.success("Semi-finished lot created"); setSf({ op: "", sku: "", qty: 0 }); }, onError: (e) => toast.error(errMsg(e)) });
            }}>Add lot</button>
          </div>
        )}
      </div>

      <div className="glass-panel rounded-2xl p-5">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-semibold"><RotateCcw className="h-4 w-4 text-primary" />Rework tasks</h2>
          <Link to="/rework" className="text-xs text-primary">All rework</Link>
        </div>
        <p className="text-xs text-muted-foreground">{rejectedTotal} {po.uom} rejected on this order · {inRework} {po.uom} in rework tasks. Finished rework goes to the QA portal for re-inspection.</p>
        <table className="mt-3 w-full text-xs"><thead className="text-[10px] uppercase text-muted-foreground"><tr><th className="py-2 text-left">Qty</th><th className="text-left">Reason</th><th className="text-left">Status</th><th className="text-right">Actions</th></tr></thead>
          <tbody>{tasks.map((t) => <tr key={t.id} className="border-t border-border/40 align-top"><td className="py-2 font-mono">{Number(t.qty)} {t.uom}<div className="text-[10px] text-muted-foreground">#{t.attempts}</div></td><td>{t.reason}{t.inspection_notes && <div className="text-muted-foreground">{t.inspection_notes}</div>}</td><td className="uppercase text-[10px]">{REWORK_STATUS[t.status]}</td><td><ReworkActions t={t} /></td></tr>)}
            {tasks.length === 0 && <tr><td colSpan={4} className="py-4 text-center text-muted-foreground">No rework tasks.</td></tr>}</tbody></table>
        {canRework && !["closed", "cancelled"].includes(po.status) && (
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <label className="text-[11px] text-muted-foreground">Quantity *<input className={inp} aria-label="Rework quantity" type="number" min={0} value={rw.qty} onChange={(e) => setRw({ ...rw, qty: Number(e.target.value) })} /><span>Usually from rejected output</span></label>
            <label className="text-[11px] text-muted-foreground">From step<select className={inp} value={rw.op} onChange={(e) => setRw({ ...rw, op: e.target.value })}><option value="">—</option>{ops.map((o) => <option key={o.id} value={o.id}>{o.sequence} {o.name} ({Number(o.qty_rejected ?? 0)} rejected)</option>)}</select></label>
            <label className="text-[11px] text-muted-foreground">Batch<select className={inp} value={rw.batch} onChange={(e) => setRw({ ...rw, batch: e.target.value })}><option value="">—</option>{batches.map((b) => <option key={b.id} value={b.id}>{b.number}</option>)}</select></label>
            <label className="text-[11px] text-muted-foreground">Reason *<input className={inp} aria-label="Rework reason" value={rw.reason} onChange={(e) => setRw({ ...rw, reason: e.target.value })} /></label>
            <label className="text-[11px] text-muted-foreground sm:col-span-2">Instructions<input className={inp} value={rw.instructions} onChange={(e) => setRw({ ...rw, instructions: e.target.value })} placeholder="What to do" /></label>
            <button className={`${btn} sm:col-span-2 justify-center`} disabled={rw.qty <= 0 || !rw.reason.trim()} onClick={async () => {
              const a = await actor();
              rwW.insert.mutate({ organization_id: po.organization_id, production_order_id: po.id, operation_id: rw.op || null, batch_id: rw.batch || null, qty: rw.qty, uom: po.uom, reason: rw.reason.trim(), instructions: rw.instructions || null, created_by_name: a.actor_name, created_by_user_id: a.actor_user_id },
                { onSuccess: () => { toast.success("Rework task created"); setRw({ qty: 0, reason: "", batch: "", op: "", instructions: "" }); }, onError: (e) => toast.error(errMsg(e)) });
            }}><RotateCcw className="h-3 w-3" />Create rework task</button>
          </div>
        )}
      </div>
    </div>
  );
}
