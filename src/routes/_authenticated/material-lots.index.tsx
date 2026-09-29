import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrowLeft, Package, Plus } from "lucide-react";
import { toast } from "sonner";
import { useRows, useWrite, errMsg } from "@/lib/execution-db";
import { useListControls } from "@/components/list-controls";
import { useMyOrg, LOT_KINDS } from "@/lib/wip-db";
import { useCanAny } from "@/lib/access";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/material-lots/")({
  head: () => ({ meta: [
    { title: "Material Lots · Cortanex MES" },
    { name: "description", content: "Receive and track raw, semi-finished and finished lots with remaining quantity and expiry." },
    { property: "og:title", content: "Material Lots · Cortanex MES" },
    { property: "og:description", content: "Lot-level stock and genealogy." },
  ] }),
  component: LotsPage,
});

const inp = "h-8 w-full rounded-lg border border-border/60 bg-card/60 px-2 text-xs";
const btn = "inline-flex items-center gap-1 rounded-lg border border-primary/40 bg-primary/10 px-2.5 py-1.5 text-xs text-primary hover:bg-primary/20 disabled:opacity-50";

function LotsPage() {
  const { data: org } = useMyOrg();
  const { data: lots = [] } = useRows<any>("material_lots");
  const { data: products = [] } = useRows<any>("products", { order: "name", asc: true });
  const { data: comps = [] } = useRows<any>("order_components");
  const w = useWrite("material_lots");
  const materials = useMemo(() => {
    const m = new Map<string, { sku: string; name: string; uom: string }>();
    for (const p of products) m.set(p.sku, { sku: p.sku, name: p.name, uom: p.uom ?? "kg" });
    for (const c of comps) if (!m.has(c.component_sku)) m.set(c.component_sku, { sku: c.component_sku, name: c.component_name ?? c.component_sku, uom: c.uom ?? "kg" });
    return Array.from(m.values()).sort((a, b) => a.sku.localeCompare(b.sku));
  }, [products, comps]);
  const can = useCanAny("material.handle", "execution.record");
  const [kind, setKind] = useState(""); const [status, setStatus] = useState("");
  const [f, setF] = useState({ sku: "", lot: "", qty: 0, uom: "kg", supplier: "", expiry: "" });

  const rows = useMemo(() => lots.filter((l) => (!kind || l.kind === kind) && (!status || l.status === status))
    .map((l) => ({ ...l, kind_label: LOT_KINDS[l.kind], used_pct: Number(l.qty_received) ? Math.round((1 - Number(l.qty_remaining) / Number(l.qty_received)) * 100) : 0,
      expired: l.expiry_date && new Date(l.expiry_date) < new Date(new Date().toDateString()) })), [lots, kind, status]);
  const lc = useListControls(rows, { searchKeys: ["sku", "name", "lot_number", "supplier", "kind_label", "status", "source_order_id"], dateKey: "created_at", exportName: "material-lots" });
  const prod = materials.find((p) => p.sku === f.sku);

  return (
    <div className="space-y-6">
      <Link to="/inventory" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"><ArrowLeft className="h-3.5 w-3.5" /> Inventory</Link>
      <div>
        <h1 className="flex items-center gap-2 font-display text-2xl font-semibold tracking-tight"><Package className="h-5 w-5 text-primary" />Material lots</h1>
        <p className="text-sm text-muted-foreground">Every received or produced lot, what is left, and where it was used. Finished and by-product output becomes a lot automatically.</p>
      </div>

      {can && (
        <div className="glass-panel rounded-2xl p-5">
          <h2 className="text-sm font-semibold">Receive a lot</h2>
          <div className="mt-3 grid gap-2 sm:grid-cols-3 lg:grid-cols-7 lg:items-end">
            <label className="text-[11px] text-muted-foreground lg:col-span-2">Material *<select className={inp} aria-label="Material" value={f.sku} onChange={(e) => setF({ ...f, sku: e.target.value, uom: materials.find((p) => p.sku === e.target.value)?.uom ?? f.uom })}><option value="">Choose…</option>{materials.map((p) => <option key={p.sku} value={p.sku}>{p.sku} · {p.name}</option>)}</select><span>From Master Data and order materials</span></label>
            <label className="text-[11px] text-muted-foreground">Lot number *<input className={inp} aria-label="Lot number" value={f.lot} onChange={(e) => setF({ ...f, lot: e.target.value })} /><span>Supplier or your own</span></label>
            <label className="text-[11px] text-muted-foreground">Quantity *<input className={inp} aria-label="Lot quantity" type="number" min={0} value={f.qty} onChange={(e) => setF({ ...f, qty: Number(e.target.value) })} /><span>In {f.uom}</span></label>
            <label className="text-[11px] text-muted-foreground">Supplier<input className={inp} value={f.supplier} onChange={(e) => setF({ ...f, supplier: e.target.value })} /><span>Optional</span></label>
            <label className="text-[11px] text-muted-foreground">Expiry<input className={inp} type="date" value={f.expiry} onChange={(e) => setF({ ...f, expiry: e.target.value })} /><span>Blocks use after</span></label>
            <button className={btn} disabled={!f.sku || !f.lot.trim() || f.qty <= 0 || !org || w.insert.isPending} onClick={async () => {
              const { data: u } = await supabase.auth.getUser();
              w.insert.mutate({ organization_id: org, sku: f.sku, name: prod?.name ?? f.sku, lot_number: f.lot.trim(), kind: "raw", qty_received: f.qty, qty_remaining: f.qty, uom: f.uom, supplier: f.supplier || null, expiry_date: f.expiry || null, actor_user_id: u.user?.id, actor_name: u.user?.email },
                { onSuccess: () => { toast.success("Lot received"); setF({ sku: "", lot: "", qty: 0, uom: "kg", supplier: "", expiry: "" }); }, onError: (e) => toast.error(errMsg(e)) });
            }}><Plus className="h-3 w-3" />Receive</button>
          </div>
        </div>
      )}

      <div className="glass-panel rounded-2xl p-5">
        <div className="flex flex-wrap gap-2">
          <select className="h-8 rounded-lg border border-border/60 bg-card/60 px-2 text-xs" aria-label="Kind filter" value={kind} onChange={(e) => setKind(e.target.value)}><option value="">All kinds</option>{Object.entries(LOT_KINDS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
          <select className="h-8 rounded-lg border border-border/60 bg-card/60 px-2 text-xs" aria-label="Status filter" value={status} onChange={(e) => setStatus(e.target.value)}><option value="">All statuses</option>{["available", "quarantine", "blocked", "consumed", "expired"].map((s) => <option key={s}>{s}</option>)}</select>
        </div>
        <div className="mt-3">{lc.toolbar}</div>
        <div className="mt-3 overflow-x-auto"><table className="w-full text-xs">
          <thead className="text-[10px] uppercase text-muted-foreground"><tr><th className="py-2 text-left">Lot</th><th className="text-left">Material</th><th className="text-left">Kind</th><th className="text-right">Received</th><th className="text-right">Remaining</th><th className="text-left">Expiry</th><th className="text-left">Source</th><th className="text-left">Status</th></tr></thead>
          <tbody>{lc.visible.map((l) => (
            <tr key={l.id} className="border-t border-border/40 hover:bg-card/40">
              <td className="py-2"><Link to="/material-lots/$lotId" params={{ lotId: l.id }} className="font-mono text-primary">{l.lot_number}</Link></td>
              <td>{l.sku} <span className="text-muted-foreground">· {l.name}</span></td>
              <td>{l.kind_label}</td>
              <td className="text-right font-mono">{Number(l.qty_received).toLocaleString()} {l.uom}</td>
              <td className="text-right font-mono">{Number(l.qty_remaining).toLocaleString()} <span className="text-muted-foreground">({100 - l.used_pct}%)</span></td>
              <td className={l.expired ? "text-destructive" : ""}>{l.expiry_date ?? "—"}</td>
              <td>{l.source_order_id ? <Link to="/production-orders/$poId" params={{ poId: l.source_order_id }} className="font-mono text-primary">{l.source_order_id}</Link> : l.supplier ?? "—"}</td>
              <td><span className="rounded-full border border-border/60 px-2 py-0.5 text-[10px] uppercase">{l.status}</span></td>
            </tr>))}
            {lc.visible.length === 0 && <tr><td colSpan={8} className="py-6 text-center text-muted-foreground">No lots match.</td></tr>}
          </tbody></table></div>
        <div className="mt-3">{lc.pager}</div>
      </div>
    </div>
  );
}
