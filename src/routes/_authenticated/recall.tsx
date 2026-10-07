import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Siren, Download, Printer } from "lucide-react";
import { useRows } from "@/lib/execution-db";
import { PageHead } from "@/components/qp-ui";

export const Route = createFileRoute("/_authenticated/recall")({
  head: () => ({ meta: [
    { title: "Recall report · Cortanex MES" },
    { name: "description", content: "One-click where-from and where-used trace for any material lot." },
    { property: "og:title", content: "Recall report · Cortanex MES" },
    { property: "og:description", content: "Trace a lot backward to its sources and forward to every order and lot it went into." },
  ] }),
  component: RecallPage,
});

type Lot = { id: string; lot_number: string; sku: string; name: string; kind: string; qty_received: number; qty_remaining: number; uom: string; supplier: string | null; expiry_date: string | null; status: string; source_order_id: string | null };
type Cons = { production_order_id: string; component_sku: string; input_lot: string | null; lot_id: string | null; qty: number; uom: string; created_at: string };

function RecallPage() {
  const { data: lots = [] } = useRows<Lot>("material_lots");
  const { data: cons = [] } = useRows<Cons>("material_consumptions");
  const { data: orders = [] } = useRows<any>("production_orders");
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<string>("");

  const lotOf = (c: Cons) => lots.find((l) => (c.lot_id && l.id === c.lot_id) || (!c.lot_id && l.lot_number === c.input_lot && l.sku === c.component_sku));
  const orderNo = (id: string) => orders.find((o) => o.id === id)?.number ?? id;

  const trace = useMemo(() => {
    const root = lots.find((l) => l.id === sel);
    if (!root) return null;
    const back: { depth: number; lot: Lot; via: string }[] = [];
    const fwdLots: { depth: number; lot: Lot; via: string }[] = [];
    const fwdOrders = new Map<string, number>();
    const seenB = new Set([root.id]);
    let frontier = [root];
    for (let d = 1; d <= 6 && frontier.length; d++) {
      const next: Lot[] = [];
      for (const l of frontier) if (l.source_order_id) for (const c of cons.filter((c) => c.production_order_id === l.source_order_id)) {
        const src = lotOf(c); if (src && !seenB.has(src.id)) { seenB.add(src.id); back.push({ depth: d, lot: src, via: orderNo(l.source_order_id) }); next.push(src); }
      }
      frontier = next;
    }
    const seenF = new Set([root.id]);
    frontier = [root];
    for (let d = 1; d <= 6 && frontier.length; d++) {
      const next: Lot[] = [];
      for (const l of frontier) for (const c of cons.filter((c) => lotOf(c)?.id === l.id)) {
        fwdOrders.set(c.production_order_id, (fwdOrders.get(c.production_order_id) ?? 0) + Number(c.qty));
        for (const out of lots.filter((x) => x.source_order_id === c.production_order_id)) if (!seenF.has(out.id)) { seenF.add(out.id); fwdLots.push({ depth: d, lot: out, via: orderNo(c.production_order_id) }); next.push(out); }
      }
      frontier = next;
    }
    return { root, back, fwdLots, fwdOrders: Array.from(fwdOrders.entries()) };
  }, [sel, lots, cons, orders]);

  const exportCsv = () => {
    if (!trace) return;
    const rows = [["direction", "depth", "lot", "sku", "name", "via order", "remaining", "uom", "status", "expiry"],
      ...trace.back.map((r) => ["where-from", r.depth, r.lot.lot_number, r.lot.sku, r.lot.name, r.via, r.lot.qty_remaining, r.lot.uom, r.lot.status, r.lot.expiry_date ?? ""]),
      ...trace.fwdLots.map((r) => ["where-used", r.depth, r.lot.lot_number, r.lot.sku, r.lot.name, r.via, r.lot.qty_remaining, r.lot.uom, r.lot.status, r.lot.expiry_date ?? ""])];
    const blob = new Blob([rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n")], { type: "text/csv" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `recall-${trace.root.lot_number}.csv`; a.click();
  };

  const matches = lots.filter((l) => !q || `${l.lot_number} ${l.sku} ${l.name}`.toLowerCase().includes(q.toLowerCase())).slice(0, 50);
  const inp = "h-9 w-full rounded-lg border border-border/60 bg-card/60 px-3 text-sm";
  const Table = ({ rows, empty }: { rows: { depth: number; lot: Lot; via: string }[]; empty: string }) => (
    <table className="mt-2 w-full text-xs"><thead className="text-[10px] uppercase text-muted-foreground"><tr><th className="py-1 text-left">Level</th><th className="text-left">Lot</th><th className="text-left">Material</th><th className="text-left">Via order</th><th className="text-right">Remaining</th><th className="text-left">Status</th></tr></thead>
      <tbody>{rows.map((r) => <tr key={r.lot.id} className="border-t border-border/40"><td className="py-1.5">{r.depth}</td><td><Link to="/material-lots/$lotId" params={{ lotId: r.lot.id }} className="font-mono text-primary">{r.lot.lot_number}</Link></td><td>{r.lot.sku} · {r.lot.name}</td><td>{r.via}</td><td className="text-right font-mono">{Number(r.lot.qty_remaining)} {r.lot.uom}</td><td>{r.lot.status}</td></tr>)}
        {rows.length === 0 && <tr><td colSpan={6} className="py-4 text-center text-muted-foreground">{empty}</td></tr>}</tbody></table>
  );

  return (
    <div className="space-y-6">
      <PageHead back="/material-lots" backLabel="Material lots" icon={<Siren className="h-5 w-5 text-destructive" />} title="Recall report"
        desc="Pick a lot to see where it came from and every order and lot it went into. Export or print for a recall." />
      <div className="glass-panel grid gap-3 rounded-2xl p-5 md:grid-cols-2">
        <label className="text-[11px] text-muted-foreground">Find lot<input className={inp} placeholder="Lot number, SKU or name" value={q} onChange={(e) => setQ(e.target.value)} /></label>
        <label className="text-[11px] text-muted-foreground">Lot<select className={inp} aria-label="Recall lot" value={sel} onChange={(e) => setSel(e.target.value)}><option value="">Choose…</option>{matches.map((l) => <option key={l.id} value={l.id}>{l.lot_number} · {l.sku} · {l.kind}</option>)}</select></label>
      </div>
      {trace && (
        <div className="glass-panel space-y-5 rounded-2xl p-5 print:shadow-none">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-semibold">Lot {trace.root.lot_number}</h2>
              <p className="text-xs text-muted-foreground">{trace.root.sku} · {trace.root.name} · {Number(trace.root.qty_remaining)}/{Number(trace.root.qty_received)} {trace.root.uom} left · {trace.root.supplier ?? "in-house"} · expires {trace.root.expiry_date ?? "—"}</p>
            </div>
            <div className="flex gap-2 print:hidden">
              <button onClick={exportCsv} className="inline-flex items-center gap-1 rounded-lg border border-border/60 px-3 py-1.5 text-xs"><Download className="h-3.5 w-3.5" />CSV</button>
              <button onClick={() => window.print()} className="inline-flex items-center gap-1 rounded-lg border border-border/60 px-3 py-1.5 text-xs"><Printer className="h-3.5 w-3.5" />Print</button>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3 text-center">
            <div className="rounded-xl border border-border/50 p-3"><div className="text-2xl font-semibold">{trace.back.length}</div><div className="text-[11px] text-muted-foreground">source lots</div></div>
            <div className="rounded-xl border border-border/50 p-3"><div className="text-2xl font-semibold">{trace.fwdOrders.length}</div><div className="text-[11px] text-muted-foreground">orders affected</div></div>
            <div className="rounded-xl border border-border/50 p-3"><div className="text-2xl font-semibold">{trace.fwdLots.length}</div><div className="text-[11px] text-muted-foreground">downstream lots</div></div>
          </div>
          <section><h3 className="text-sm font-semibold">Where it came from</h3><Table rows={trace.back} empty="Received from a supplier — no earlier lots." /></section>
          <section><h3 className="text-sm font-semibold">Orders that used it</h3>
            <ul className="mt-2 space-y-1 text-xs">{trace.fwdOrders.map(([id, qty]) => <li key={id} className="flex justify-between rounded-lg border border-border/40 px-3 py-1.5"><Link to="/production-orders/$poId" params={{ poId: id }} className="text-primary">{orderNo(id)}</Link><span className="font-mono">{qty} used (incl. downstream)</span></li>)}
              {trace.fwdOrders.length === 0 && <li className="text-muted-foreground">Not used in any order yet.</li>}</ul></section>
          <section><h3 className="text-sm font-semibold">Where it went</h3><Table rows={trace.fwdLots} empty="No lots made from it yet." /></section>
        </div>
      )}
    </div>
  );
}
