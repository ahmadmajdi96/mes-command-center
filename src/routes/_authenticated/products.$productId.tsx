import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { ArrowLeft, Package } from "lucide-react";
import { useProduct } from "@/lib/products-db";
import { useProductionOrders } from "@/lib/production-orders-db";

export const Route = createFileRoute("/_authenticated/products/$productId")({
  head: ({ params }) => ({
    meta: [{ title: `Product ${params.productId} · Cortanex MES` }],
  }),
  component: ProductDetail,
});

function ProductDetail() {
  const { productId } = useParams({ from: "/products/$productId" });
  const { data: p, isLoading } = useProduct(productId);
  const { data: pos = [] } = useProductionOrders();
  const linkedPos = pos.filter((o) => o.product_id === productId);

  if (isLoading) return <div className="text-sm text-muted-foreground">Loading…</div>;
  if (!p) return (
    <div className="glass-panel rounded-2xl p-8 text-center text-sm text-muted-foreground">
      Product not found. <Link to="/products" className="text-primary">Back to catalog</Link>
    </div>
  );

  return (
    <div className="space-y-6">
      <Link to="/products" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5" /> Products
      </Link>
      <div className="glass-panel rounded-2xl p-6">
        <div className="flex items-start gap-4">
          <div className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-primary to-info text-primary-foreground">
            <Package className="h-6 w-6" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-2xl font-semibold tracking-tight">{p.name}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              <span className="font-mono">{p.sku}</span>
              <span>·</span>
              <span className="uppercase tracking-wider">{p.type}</span>
              <span>·</span>
              <span>UOM {p.uom}</span>
            </div>
            {p.description && <p className="mt-3 max-w-2xl text-sm">{p.description}</p>}
          </div>
        </div>
        <div className="mt-6 grid gap-3 md:grid-cols-4">
          <Info label="Std cost" value={`$${Number(p.standard_cost).toFixed(2)}`} />
          <Info label="Sale price" value={`$${Number(p.sale_price).toFixed(2)}`} />
          <Info label="Lead time" value={`${p.lead_time} days`} />
          <Info label="Batching limit" value={String(p.batching_limit)} />
        </div>
      </div>

      <div className="glass-panel rounded-2xl p-5">
        <h2 className="text-sm font-semibold">Production Orders</h2>
        <p className="text-xs text-muted-foreground">Orders scheduled or run for this SKU</p>
        <div className="mt-3 divide-y divide-border/40">
          {linkedPos.length === 0 && <p className="py-4 text-xs text-muted-foreground">No production orders yet.</p>}
          {linkedPos.map((o) => (
            <Link key={o.id} to="/production-orders/$poId" params={{ poId: o.id }} className="flex items-center justify-between py-2.5 text-xs hover:text-primary">
              <div className="flex items-center gap-3">
                <span className="font-mono text-primary">{o.number}</span>
                <span className="font-mono text-muted-foreground">{o.lot_number}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-mono">{Number(o.qty_produced).toLocaleString()} / {Number(o.qty).toLocaleString()} {o.uom}</span>
                <span className="rounded-full border border-border/60 bg-card/60 px-2 py-0.5 uppercase tracking-wider">{o.status}</span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border/40 bg-card/40 p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 font-mono text-lg">{value}</div>
    </div>
  );
}
