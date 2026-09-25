import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Play, CheckCircle2, Plus, Printer, Download, Package } from "lucide-react";
import { useRows, useWrite, applyProductionVersion, errMsg } from "@/lib/execution-db";
import { exportRows } from "@/components/list-controls";
import { useWasteReasons } from "@/lib/hmi-db";
import { useQueryClient } from "@tanstack/react-query";

const inp = "h-8 rounded-lg border border-border/60 bg-card/60 px-2 text-xs focus:border-primary/50 focus:outline-none";
const btn = "flex h-8 items-center gap-1 rounded-lg bg-primary px-2.5 text-xs font-medium text-primary-foreground disabled:opacity-50";
const ghost = "flex h-7 items-center gap-1 rounded-lg border border-border/60 px-2 text-[11px] hover:text-foreground disabled:opacity-40";
const card = "glass-panel space-y-3 rounded-2xl p-4";
const H = ({ children }: { children: React.ReactNode }) => <h3 className="text-sm font-semibold">{children}</h3>;
const sum = (xs: any[], k: string) => xs.reduce((a, x) => a + Number(x[k] ?? 0), 0);

type Po = { id: string; sku: string; product_name: string; qty: number; uom: string; lot_number: string; status: string; production_version_id?: string | null; organization_id: string };

export function OrderExecution({ po }: { po: Po }) {
  const eq = { production_order_id: po.id };
  const { data: ops = [] } = useRows("order_operations", { eq, order: "sequence", asc: true });
  const { data: comps = [] } = useRows("order_components", { eq, order: "created_at", asc: true });
  const { data: confs = [] } = useRows("production_confirmations", { eq });
  const { data: cons = [] } = useRows("material_consumptions", { eq });
  const { data: acts = [] } = useRows("activity_confirmations", { eq });
  const { data: grs = [] } = useRows("goods_receipts", { eq });
  const { data: packs = [] } = useRows("packing_units", { eq });
  const { data: packItems = [] } = useRows("packing_unit_items");
  const { data: batches = [] } = useRows("production_batches", { eq });
  const locked = ["completed", "closed", "cancelled"].includes(po.status);

  const yieldQty = sum(confs, "qty_yield");
  const scrapQty = sum(confs, "qty_scrap");

  return (
    <div className="space-y-4">
      <Scenario po={po} hasConfs={confs.length > 0} />
      <Operations po={po} ops={ops} locked={locked} />
      <Confirm po={po} ops={ops} batches={batches} locked={locked} yieldQty={yieldQty} scrapQty={scrapQty} />
      <div className="grid gap-4 lg:grid-cols-2">
        <Consumption po={po} comps={comps} cons={cons} batches={batches} ops={ops} locked={locked} />
        <Activities po={po} ops={ops} acts={acts} locked={locked} />
      </div>
      <Receipts po={po} comps={comps} grs={grs} batches={batches} />
      <Packing po={po} packs={packs} items={packItems} />
      <Report po={po} ops={ops} confs={confs} cons={cons} acts={acts} grs={grs} comps={comps} />
    </div>
  );
}

function Scenario({ po, hasConfs }: { po: Po; hasConfs: boolean }) {
  const { data: versions = [] } = useRows("production_versions", { eq: { sku: po.sku } });
  const [v, setV] = useState(po.production_version_id ?? "");
  const qc = useQueryClient();
  const today = new Date().toISOString().slice(0, 10);
  const canChange = ["scheduled", "planned", "released"].includes(po.status) && !hasConfs;
  return (
    <div className={card}>
      <H>Execution scenario</H>
      <p className="text-xs text-muted-foreground">Pick which production version (BOM + routing) runs this order. Its operations and components are copied onto the order and can be adjusted for this order only — master data stays unchanged.</p>
      <div className="flex flex-wrap items-center gap-2">
        <select className={inp} value={v} onChange={(e) => setV(e.target.value)} disabled={!canChange}>
          <option value="">Choose production version…</option>
          {versions.map((x: any) => {
            const valid = (!x.valid_from || x.valid_from <= today) && (!x.valid_to || x.valid_to >= today);
            return <option key={x.id} value={x.id} disabled={!valid}>{x.version} · {x.description ?? "standard"} {x.is_default ? "(default)" : ""}{valid ? "" : " — not valid today"}</option>;
          })}
        </select>
        <button className={btn} disabled={!v || !canChange} onClick={async () => {
          if (po.production_version_id && !confirm("Replace this order's operations and components with the selected version?")) return;
          try { await applyProductionVersion(po.id, v); toast.success("Scenario applied to this order"); qc.invalidateQueries(); }
          catch (e) { toast.error(errMsg(e)); }
        }}>Apply to order</button>
        {po.production_version_id && <span className="text-xs text-muted-foreground">Current: <span className="font-mono">{po.production_version_id}</span></span>}
        {versions.length === 0 && <span className="text-xs text-warning">No production versions for {po.sku} yet — add them in Master Data.</span>}
        {!canChange && <span className="text-xs text-muted-foreground">Locked once the order has started or has confirmations.</span>}
      </div>
    </div>
  );
}

function Operations({ po, ops, locked }: { po: Po; ops: any[]; locked: boolean }) {
  const w = useWrite("order_operations");
  const [n, setN] = useState({ name: "", work_instructions: "" });
  const [editing, setEditing] = useState<string | null>(null);
  const [text, setText] = useState("");
  const stamp = async () => (await import("@/integrations/supabase/client")).supabase.auth.getUser().then((r) => r.data.user?.email ?? "operator");
  const setStatus = async (o: any, status: string) => {
    const who = await stamp();
    const patch: Record<string, unknown> = { status };
    if (status === "running") { patch.started_at = new Date().toISOString(); patch.started_by = who; }
    if (status === "completed") { patch.completed_at = new Date().toISOString(); patch.completed_by = who; }
    w.update.mutate({ id: o.id, patch }, { onError: (e) => toast.error(errMsg(e)), onSuccess: () => toast.success(`${o.name}: ${status}`) });
  };
  return (
    <div className={card}>
      <H>Operations (order-specific routing)</H>
      {ops.length === 0 && <p className="text-xs text-muted-foreground">No operations yet — apply an execution scenario or add operations below.</p>}
      <div className="space-y-2">
        {ops.map((o, i) => {
          const prevOpen = ops.slice(0, i).some((p) => p.status !== "completed" && p.status !== "skipped");
          return (
            <div key={o.id} className="rounded-xl border border-border/50 bg-card/40 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm"><span className="font-mono text-xs text-muted-foreground">{o.sequence}</span> <b>{o.name}</b> <span className="text-xs text-muted-foreground">{o.work_center_id ?? ""}</span></div>
                <div className="flex items-center gap-1.5 text-[11px]">
                  <span className="rounded-full border border-border/60 px-2 py-0.5 uppercase">{o.status}</span>
                  <span className="text-muted-foreground">yield {o.qty_yield} · scrap {o.qty_scrap}</span>
                  <button className={ghost} disabled={locked || o.status !== "pending"} title={prevOpen ? "Previous operations are still open" : ""} onClick={() => setStatus(o, "running")}><Play className="h-3 w-3" />Start</button>
                  <button className={ghost} disabled={locked || o.status !== "running"} onClick={() => setStatus(o, "completed")}><CheckCircle2 className="h-3 w-3" />Complete</button>
                </div>
              </div>
              {o.started_at && <div className="mt-1 text-[11px] text-muted-foreground">Started {new Date(o.started_at).toLocaleString()} by {o.started_by ?? "—"}{o.completed_at ? ` · completed ${new Date(o.completed_at).toLocaleString()} by ${o.completed_by ?? "—"}` : ""}</div>}
              {editing === o.id ? (
                <div className="mt-2 flex gap-2">
                  <textarea className={`${inp} h-16 flex-1 py-1`} value={text} onChange={(e) => setText(e.target.value)} />
                  <button className={btn} onClick={() => w.update.mutate({ id: o.id, patch: { work_instructions: text } }, { onSuccess: () => setEditing(null), onError: (e) => toast.error(errMsg(e)) })}>Save</button>
                </div>
              ) : (
                <div className="mt-2 whitespace-pre-wrap text-xs">
                  <span className="text-muted-foreground">Work instructions: </span>{o.work_instructions || "—"}
                  {!locked && <button className="ml-2 text-primary underline" onClick={() => { setEditing(o.id); setText(o.work_instructions ?? ""); }}>edit for this order</button>}
                </div>
              )}
            </div>
          );
        })}
      </div>
      {!locked && (
        <div className="flex flex-wrap gap-2">
          <input className={inp} placeholder="Extra operation for this order" value={n.name} onChange={(e) => setN({ ...n, name: e.target.value })} />
          <input className={`${inp} flex-1`} placeholder="Work instructions" value={n.work_instructions} onChange={(e) => setN({ ...n, work_instructions: e.target.value })} />
          <button className={btn} disabled={!n.name} onClick={() => w.insert.mutate({ production_order_id: po.id, organization_id: po.organization_id, sequence: ((ops.at(-1)?.sequence ?? 0) + 10), name: n.name, work_instructions: n.work_instructions || null }, { onSuccess: () => setN({ name: "", work_instructions: "" }), onError: (e) => toast.error(errMsg(e)) })}><Plus className="h-3.5 w-3.5" />Add</button>
        </div>
      )}
    </div>
  );
}

function Confirm({ po, ops, batches, locked, yieldQty, scrapQty }: { po: Po; ops: any[]; batches: any[]; locked: boolean; yieldQty: number; scrapQty: number }) {
  const w = useWrite("production_confirmations");
  const { data: reasons = [] } = useWasteReasons();
  const [f, setF] = useState({ operation_id: "", batch_id: "", qty_yield: 0, qty_scrap: 0, scrap_reason: "", final: false, post_goods_receipt: true, notes: "" });
  const pct = po.qty ? Math.round((yieldQty / Number(po.qty)) * 100) : 0;
  return (
    <div className={card}>
      <H>Production confirmation</H>
      <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
        <Stat label="Planned" v={`${po.qty} ${po.uom}`} />
        <Stat label="Confirmed yield" v={`${yieldQty} ${po.uom} (${pct}%)`} />
        <Stat label="Scrap" v={`${scrapQty} ${po.uom}`} />
        <Stat label="Remaining" v={`${Math.max(0, Number(po.qty) - yieldQty)} ${po.uom}`} />
      </div>
      {!locked && (
        <div className="flex flex-wrap items-center gap-2">
          <select className={inp} value={f.operation_id} onChange={(e) => setF({ ...f, operation_id: e.target.value })}>
            <option value="">Operation (optional)…</option>{ops.map((o) => <option key={o.id} value={o.id}>{o.sequence} · {o.name}</option>)}
          </select>
          <select className={inp} value={f.batch_id} onChange={(e) => setF({ ...f, batch_id: e.target.value })}>
            <option value="">Batch (optional)…</option>{batches.map((b: any) => <option key={b.id} value={b.id}>{b.number}</option>)}
          </select>
          <label className="text-xs">Yield <input className={`${inp} w-20`} type="number" min={0} value={f.qty_yield} onChange={(e) => setF({ ...f, qty_yield: Number(e.target.value) })} /></label>
          <label className="text-xs">Scrap <input className={`${inp} w-20`} type="number" min={0} value={f.qty_scrap} onChange={(e) => setF({ ...f, qty_scrap: Number(e.target.value) })} /></label>
          {f.qty_scrap > 0 && (
            <select className={inp} value={f.scrap_reason} onChange={(e) => setF({ ...f, scrap_reason: e.target.value })}>
              <option value="">Scrap reason…</option>{reasons.map((r: any) => <option key={r.id} value={`${r.code} · ${r.label}`}>{r.code} · {r.label}</option>)}
            </select>
          )}
          <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={f.final} onChange={(e) => setF({ ...f, final: e.target.checked })} />Final (completes operation)</label>
          <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={f.post_goods_receipt} onChange={(e) => setF({ ...f, post_goods_receipt: e.target.checked })} />Post goods receipt</label>
          <input className={`${inp} flex-1`} placeholder="Notes" value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
          <button className={btn} onClick={() => {
            if (f.qty_yield + f.qty_scrap <= 0) return toast.error("Enter a yield or scrap quantity");
            if (f.qty_scrap > 0 && !f.scrap_reason) return toast.error("Scrap needs a reason");
            if (yieldQty + f.qty_yield > Number(po.qty) * 1.1 && !confirm("This exceeds the planned quantity by more than 10%. Confirm anyway?")) return;
            w.record.mutate({
              production_order_id: po.id, organization_id: po.organization_id, operation_id: f.operation_id || null, batch_id: f.batch_id || null,
              qty_yield: f.qty_yield, qty_scrap: f.qty_scrap, scrap_reason: f.scrap_reason || null, final: f.final, post_goods_receipt: f.post_goods_receipt, notes: f.notes || null,
            }, {
              onSuccess: () => { toast.success("Confirmed · backflush and co/by-products recorded automatically"); setF({ ...f, qty_yield: 0, qty_scrap: 0, scrap_reason: "", notes: "" }); },
              onError: (e) => toast.error(errMsg(e)),
            });
          }}>Confirm</button>
        </div>
      )}
    </div>
  );
}
const Stat = ({ label, v }: { label: string; v: string }) => (
  <div className="rounded-xl border border-border/50 bg-card/40 p-2"><div className="text-[10px] uppercase text-muted-foreground">{label}</div><div className="font-mono text-sm">{v}</div></div>
);

function Consumption({ po, comps, cons, batches, ops, locked }: any) {
  const w = useWrite("material_consumptions");
  const [f, setF] = useState({ sku: "", qty: 0, input_lot: "", batch_id: "", operation_id: "" });
  const materials = comps.filter((c: any) => c.item_type === "component");
  return (
    <div className={card}>
      <H>Material consumption</H>
      <table className="w-full text-xs">
        <thead className="text-[10px] uppercase text-muted-foreground"><tr><th className="text-left">Component</th><th className="text-right">Planned</th><th className="text-right">Consumed</th><th className="text-right">Δ</th></tr></thead>
        <tbody>
          {materials.map((c: any) => {
            const used = sum(cons.filter((x: any) => x.component_sku === c.component_sku), "qty");
            return <tr key={c.id} className="border-t border-border/40"><td>{c.component_sku} · {c.component_name}{c.backflush ? <span className="ml-1 text-[10px] text-info">backflush</span> : null}</td><td className="text-right font-mono">{c.planned_qty} {c.uom}</td><td className="text-right font-mono">{used}</td><td className={`text-right font-mono ${used > c.planned_qty ? "text-warning" : ""}`}>{(used - c.planned_qty).toFixed(2)}</td></tr>;
          })}
          {materials.length === 0 && <tr><td colSpan={4} className="py-2 text-muted-foreground">No components on this order.</td></tr>}
        </tbody>
      </table>
      {!locked && (
        <div className="flex flex-wrap gap-2">
          <select className={inp} value={f.sku} onChange={(e) => setF({ ...f, sku: e.target.value })}>
            <option value="">Component…</option>{materials.map((c: any) => <option key={c.id} value={c.component_sku}>{c.component_sku}</option>)}
          </select>
          <input className={`${inp} w-20`} type="number" value={f.qty} onChange={(e) => setF({ ...f, qty: Number(e.target.value) })} />
          <input className={inp} placeholder="Input lot" value={f.input_lot} onChange={(e) => setF({ ...f, input_lot: e.target.value })} />
          <select className={inp} value={f.batch_id} onChange={(e) => setF({ ...f, batch_id: e.target.value })}><option value="">Batch…</option>{batches.map((b: any) => <option key={b.id} value={b.id}>{b.number}</option>)}</select>
          <select className={inp} value={f.operation_id} onChange={(e) => setF({ ...f, operation_id: e.target.value })}><option value="">Operation…</option>{ops.map((o: any) => <option key={o.id} value={o.id}>{o.name}</option>)}</select>
          <button className={btn} disabled={!f.sku || f.qty === 0} onClick={() => {
            const c = materials.find((x: any) => x.component_sku === f.sku);
            w.record.mutate({ production_order_id: po.id, organization_id: po.organization_id, component_sku: c.component_sku, component_name: c.component_name, uom: c.uom, qty: f.qty, input_lot: f.input_lot || null, batch_id: f.batch_id || null, operation_id: f.operation_id || null }, { onSuccess: () => { toast.success("Consumption recorded"); setF({ ...f, qty: 0, input_lot: "" }); }, onError: (e) => toast.error(errMsg(e)) });
          }}>Record</button>
        </div>
      )}
      <p className="text-[10px] text-muted-foreground">Negative quantity records a return / correction. Backflush components are consumed automatically on confirmation.</p>
    </div>
  );
}

function Activities({ po, ops, acts, locked }: any) {
  const w = useWrite("activity_confirmations");
  const [f, setF] = useState({ operation_id: "", activity_type: "labor", minutes: 0, people: 1 });
  const by = (t: string) => sum(acts.filter((a: any) => a.activity_type === t), "minutes");
  return (
    <div className={card}>
      <H>Activity confirmation</H>
      <div className="grid grid-cols-3 gap-2"><Stat label="Labor min" v={String(by("labor"))} /><Stat label="Machine min" v={String(by("machine"))} /><Stat label="Setup min" v={String(by("setup"))} /></div>
      {!locked && (
        <div className="flex flex-wrap gap-2">
          <select className={inp} value={f.operation_id} onChange={(e) => setF({ ...f, operation_id: e.target.value })}><option value="">Operation…</option>{ops.map((o: any) => <option key={o.id} value={o.id}>{o.name}</option>)}</select>
          <select className={inp} value={f.activity_type} onChange={(e) => setF({ ...f, activity_type: e.target.value })}><option>labor</option><option>machine</option><option>setup</option></select>
          <label className="text-xs">Minutes <input className={`${inp} w-20`} type="number" min={1} value={f.minutes} onChange={(e) => setF({ ...f, minutes: Number(e.target.value) })} /></label>
          <label className="text-xs">People <input className={`${inp} w-14`} type="number" min={1} value={f.people} onChange={(e) => setF({ ...f, people: Number(e.target.value) })} /></label>
          <button className={btn} disabled={f.minutes <= 0} onClick={() => w.record.mutate({ production_order_id: po.id, organization_id: po.organization_id, operation_id: f.operation_id || null, activity_type: f.activity_type, minutes: f.minutes, people: f.people }, { onSuccess: () => { toast.success("Activity recorded"); setF({ ...f, minutes: 0 }); }, onError: (e) => toast.error(errMsg(e)) })}>Record</button>
        </div>
      )}
      <ul className="max-h-32 space-y-1 overflow-auto text-[11px] text-muted-foreground">
        {acts.map((a: any) => <li key={a.id}>{new Date(a.created_at).toLocaleString()} · {a.activity_type} {a.minutes} min × {a.people} · {a.actor_name}</li>)}
      </ul>
    </div>
  );
}

function Receipts({ po, comps, grs, batches }: any) {
  const w = useWrite("goods_receipts");
  const outputs = [{ key: "finished", sku: po.sku, name: po.product_name, uom: po.uom }, ...comps.filter((c: any) => c.item_type !== "component").map((c: any) => ({ key: c.item_type, sku: c.component_sku, name: c.component_name, uom: c.uom }))];
  const [f, setF] = useState({ idx: 0, qty: 0, storage_location: "", batch_id: "" });
  return (
    <div className={card}>
      <H>Goods receipt — finished goods, co-products, by-products</H>
      <div className="flex flex-wrap gap-2">
        <select className={inp} value={f.idx} onChange={(e) => setF({ ...f, idx: Number(e.target.value) })}>
          {outputs.map((o, i) => <option key={i} value={i}>{o.key.replace("_", "-")} · {o.sku}</option>)}
        </select>
        <input className={`${inp} w-20`} type="number" value={f.qty} onChange={(e) => setF({ ...f, qty: Number(e.target.value) })} />
        <input className={inp} placeholder="Storage location" value={f.storage_location} onChange={(e) => setF({ ...f, storage_location: e.target.value })} />
        <select className={inp} value={f.batch_id} onChange={(e) => setF({ ...f, batch_id: e.target.value })}><option value="">Batch…</option>{batches.map((b: any) => <option key={b.id} value={b.id}>{b.number}</option>)}</select>
        <button className={btn} disabled={f.qty === 0} onClick={() => {
          const o = outputs[f.idx];
          w.record.mutate({ production_order_id: po.id, organization_id: po.organization_id, receipt_type: o.key, sku: o.sku, name: o.name, uom: o.uom, qty: f.qty, lot_number: po.lot_number, storage_location: f.storage_location || null, batch_id: f.batch_id || null }, { onSuccess: () => { toast.success("Goods receipt posted"); setF({ ...f, qty: 0 }); }, onError: (e) => toast.error(errMsg(e)) });
        }}>Post receipt</button>
      </div>
      <table className="w-full text-xs">
        <thead className="text-[10px] uppercase text-muted-foreground"><tr><th className="text-left">When</th><th className="text-left">Type</th><th className="text-left">Item</th><th className="text-right">Qty</th><th className="text-left">Lot / location</th><th className="text-left">By</th></tr></thead>
        <tbody>{grs.map((g: any) => <tr key={g.id} className="border-t border-border/40"><td>{new Date(g.created_at).toLocaleString()}</td><td>{g.receipt_type.replace("_", "-")}{g.auto ? " (auto)" : ""}</td><td>{g.sku}</td><td className="text-right font-mono">{g.qty} {g.uom}</td><td>{g.lot_number ?? "—"} {g.storage_location ? `· ${g.storage_location}` : ""}</td><td>{g.actor_name}</td></tr>)}</tbody>
      </table>
    </div>
  );
}

function Packing({ po, packs, items }: any) {
  const wp = useWrite("packing_units");
  const wi = useWrite("packing_unit_items");
  const [type, setType] = useState("carton");
  const [cap, setCap] = useState(12);
  const [add, setAdd] = useState<Record<string, { ref: string; qty: number; partial: boolean }>>({});
  return (
    <div className={card}>
      <H>Packing units</H>
      <div className="flex flex-wrap gap-2">
        <select className={inp} value={type} onChange={(e) => setType(e.target.value)}>{["carton", "box", "tray", "pallet"].map((t) => <option key={t}>{t}</option>)}</select>
        <label className="text-xs">Capacity <input className={`${inp} w-20`} type="number" value={cap} onChange={(e) => setCap(Number(e.target.value))} /></label>
        <button className={btn} onClick={() => wp.insert.mutate({ id: `PU-${po.id}-${String(packs.length + 1).padStart(3, "0")}`, production_order_id: po.id, organization_id: po.organization_id, pack_type: type, capacity: cap }, { onError: (e) => toast.error(errMsg(e)) })}><Package className="h-3.5 w-3.5" />New packing unit</button>
      </div>
      <div className="grid gap-2 md:grid-cols-2">
        {packs.map((p: any) => {
          const mine = items.filter((i: any) => i.packing_unit_id === p.id);
          const filled = sum(mine, "qty");
          const a = add[p.id] ?? { ref: "", qty: 1, partial: false };
          const set = (x: any) => setAdd({ ...add, [p.id]: { ...a, ...x } });
          return (
            <div key={p.id} className="rounded-xl border border-border/50 bg-card/40 p-3 text-xs">
              <div className="flex items-center justify-between"><span className="font-mono text-primary">{p.id}</span><span>{p.pack_type} · {filled}/{p.capacity ?? "∞"} · {p.status}</span></div>
              <ul className="my-1 space-y-0.5 text-muted-foreground">{mine.map((i: any) => <li key={i.id}>{i.unit_uid ?? i.batch_id} × {i.qty}{i.partial ? " (partial)" : ""}</li>)}</ul>
              {p.status === "open" && (
                <div className="flex flex-wrap gap-1">
                  <input className={`${inp} flex-1`} placeholder="Item ID (SFC) or batch" value={a.ref} onChange={(e) => set({ ref: e.target.value })} />
                  <input className={`${inp} w-16`} type="number" min={0} step="any" value={a.qty} onChange={(e) => set({ qty: Number(e.target.value) })} />
                  <label className="flex items-center gap-1"><input type="checkbox" checked={a.partial} onChange={(e) => set({ partial: e.target.checked })} />partial</label>
                  <button className={ghost} disabled={!a.ref || a.qty <= 0} onClick={() => {
                    if (p.capacity && filled + a.qty > Number(p.capacity)) return toast.error("Exceeds packing unit capacity");
                    const isBatch = /^B|BATCH/i.test(a.ref) && !a.ref.includes("UID");
                    wi.insert.mutate({ packing_unit_id: p.id, organization_id: p.organization_id, unit_uid: isBatch ? null : a.ref, batch_id: isBatch ? a.ref : null, qty: a.qty, partial: a.partial }, { onSuccess: () => set({ ref: "" }), onError: (e) => toast.error(/duplicate|unique/i.test(errMsg(e)) ? "That item is already fully packed" : errMsg(e)) });
                  }}>Add</button>
                  <button className={ghost} onClick={() => wp.update.mutate({ id: p.id, patch: { status: "closed" } })}>Close</button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Report({ po, ops, confs, cons, acts, grs, comps }: any) {
  const rows = useMemo(() => {
    const yieldQty = sum(confs, "qty_yield"), scrap = sum(confs, "qty_scrap");
    const out: Record<string, unknown>[] = [
      { section: "Quantity", item: "Planned", value: po.qty, uom: po.uom },
      { section: "Quantity", item: "Yield confirmed", value: yieldQty, uom: po.uom },
      { section: "Quantity", item: "Scrap", value: scrap, uom: po.uom },
      { section: "Quantity", item: "Yield %", value: po.qty ? +((yieldQty / po.qty) * 100).toFixed(1) : 0, uom: "%" },
    ];
    const reasons: Record<string, number> = {};
    confs.forEach((c: any) => { if (c.qty_scrap > 0) reasons[c.scrap_reason ?? "unspecified"] = (reasons[c.scrap_reason ?? "unspecified"] ?? 0) + Number(c.qty_scrap); });
    Object.entries(reasons).forEach(([k, v]) => out.push({ section: "Scrap by reason", item: k, value: v, uom: po.uom }));
    comps.filter((c: any) => c.item_type === "component").forEach((c: any) => out.push({ section: "Material", item: c.component_sku, planned: c.planned_qty, value: sum(cons.filter((x: any) => x.component_sku === c.component_sku), "qty"), uom: c.uom }));
    ["labor", "machine", "setup"].forEach((t) => out.push({ section: "Activity", item: t, value: sum(acts.filter((a: any) => a.activity_type === t), "minutes"), uom: "min" }));
    ["finished", "co_product", "by_product"].forEach((t) => out.push({ section: "Goods receipt", item: t, value: sum(grs.filter((g: any) => g.receipt_type === t), "qty") }));
    ops.forEach((o: any) => {
      const dur = o.started_at && o.completed_at ? Math.round((new Date(o.completed_at).getTime() - new Date(o.started_at).getTime()) / 60000) : null;
      out.push({ section: "Operation", item: `${o.sequence} ${o.name}`, value: o.status, planned: Math.round(Number(o.setup_min) + Number(o.run_min_per_unit) * po.qty), actual_min: dur, uom: "min" });
    });
    return out;
  }, [po, ops, confs, cons, acts, grs, comps]);
  return (
    <div className={card} id="post-production-report">
      <div className="flex items-center justify-between">
        <H>Post-production report</H>
        <div className="flex gap-1">
          <button className={ghost} onClick={() => exportRows(rows, `report-${po.id}`, "csv")}><Download className="h-3 w-3" />CSV</button>
          <button className={ghost} onClick={() => exportRows(rows, `report-${po.id}`, "xls")}><Download className="h-3 w-3" />Excel</button>
          <button className={ghost} onClick={() => window.print()}><Printer className="h-3 w-3" />Print</button>
        </div>
      </div>
      {!["completed", "closed"].includes(po.status) && <p className="text-[11px] text-warning">Order not completed yet — figures are provisional.</p>}
      <table className="w-full text-xs">
        <thead className="text-[10px] uppercase text-muted-foreground"><tr><th className="text-left">Section</th><th className="text-left">Item</th><th className="text-right">Planned</th><th className="text-right">Actual</th><th className="text-left pl-2">Unit</th></tr></thead>
        <tbody>{rows.map((r, i) => <tr key={i} className="border-t border-border/40"><td>{String(r.section)}</td><td>{String(r.item)}</td><td className="text-right font-mono">{r.planned != null ? String(r.planned) : ""}</td><td className="text-right font-mono">{String(r.actual_min ?? r.value ?? "")}{r.actual_min != null ? ` (${r.value})` : ""}</td><td className="pl-2">{String(r.uom ?? "")}</td></tr>)}</tbody>
      </table>
    </div>
  );
}
