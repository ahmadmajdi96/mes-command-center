import { createFileRoute } from "@tanstack/react-router";
import { useRows } from "@/lib/execution-db";
import { useListControls } from "@/components/list-controls";

export const Route = createFileRoute("/_authenticated/inventory")({
  head: () => ({
    meta: [
      { title: "Inventory & Goods Receipts · Cortanex MES" },
      { name: "description", content: "Stock on hand from goods receipts and material consumption, with full receipt history." },
      { property: "og:title", content: "Inventory · Cortanex MES" },
      { property: "og:description", content: "Finished goods, co-products and by-products received from production." },
    ],
  }),
  component: Inventory,
});

function Inventory() {
  const { data: stock = [] } = useRows("stock_on_hand", { order: "sku", asc: true });
  const { data: grs = [] } = useRows("goods_receipts");
  const s = useListControls(stock, { exportName: "stock-on-hand" });
  const g = useListControls(grs, { exportName: "goods-receipts", dateKey: "created_at" as never });
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight">Inventory</h1>
        <p className="text-sm text-muted-foreground">Stock on hand = goods receipts − material consumption.</p>
      </div>
      {s.toolbar}
      <div className="glass-panel overflow-x-auto rounded-2xl">
        <table className="w-full text-sm">
          <thead className="bg-card/60 text-[11px] uppercase text-muted-foreground"><tr><th className="px-4 py-2 text-left">SKU</th><th className="px-4 py-2 text-left">Name</th><th className="px-4 py-2 text-right">On hand</th></tr></thead>
          <tbody>{s.visible.map((r: any) => <tr key={r.sku} className="border-t border-border/40"><td className="px-4 py-2 font-mono text-xs">{r.sku}</td><td className="px-4 py-2">{r.name}</td><td className={`px-4 py-2 text-right font-mono ${Number(r.qty) < 0 ? "text-destructive" : ""}`}>{Number(r.qty).toLocaleString()} {r.uom}</td></tr>)}
          {s.visible.length === 0 && <tr><td colSpan={3} className="px-4 py-6 text-center text-xs text-muted-foreground">No stock movements yet.</td></tr>}</tbody>
        </table>
      </div>
      {s.pager}
      <h2 className="text-lg font-semibold">Goods receipts</h2>
      {g.toolbar}
      <div className="glass-panel overflow-x-auto rounded-2xl">
        <table className="w-full text-sm">
          <thead className="bg-card/60 text-[11px] uppercase text-muted-foreground"><tr>{["When", "Order", "Type", "Item", "Qty", "Lot", "Location", "By"].map((h) => <th key={h} className="px-3 py-2 text-left">{h}</th>)}</tr></thead>
          <tbody>{g.visible.map((r: any) => <tr key={r.id} className="border-t border-border/40 text-xs"><td className="px-3 py-2">{new Date(r.created_at).toLocaleString()}</td><td className="px-3 py-2 font-mono">{r.production_order_id}</td><td className="px-3 py-2">{r.receipt_type}{r.auto ? " (auto)" : ""}</td><td className="px-3 py-2">{r.sku}</td><td className="px-3 py-2 font-mono">{r.qty} {r.uom}</td><td className="px-3 py-2">{r.lot_number ?? "—"}</td><td className="px-3 py-2">{r.storage_location ?? "—"}</td><td className="px-3 py-2">{r.actor_name}</td></tr>)}</tbody>
        </table>
      </div>
      {g.pager}
    </div>
  );
}
