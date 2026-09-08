import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Search, Plus, Package, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useProducts, useCreateProduct, useUpdateProduct, useDeleteProduct, useProductsRealtime, productTypes, type Product } from "@/lib/products-db";
import { EntityFormDialog, type Field } from "@/components/crud/entity-form-dialog";

export const Route = createFileRoute("/_authenticated/products/")({
  head: () => ({
    meta: [
      { title: "Products · Cortanex MES" },
      { name: "description", content: "Master product catalog with SKU, UOM, cost, lead time and specifications — shared across MES, OMS and QC." },
    ],
  }),
  component: ProductsPage,
});

const fields: Field[] = [
  { name: "sku", label: "SKU", type: "text", required: true, placeholder: "GRA-060" },
  { name: "name", label: "Name", type: "text", required: true, span: 2 },
  { name: "type", label: "Type", type: "select", options: productTypes.map((t) => ({ value: t, label: t })), required: true },
  { name: "uom", label: "UOM", type: "select", options: [
    { value: "ea", label: "each" }, { value: "kg", label: "kg" }, { value: "g", label: "g" },
    { value: "L", label: "L" }, { value: "ml", label: "ml" }, { value: "btl", label: "bottle" },
    { value: "ctn", label: "carton" }, { value: "jar", label: "jar" },
  ], required: true },
  { name: "standard_cost", label: "Std Cost", type: "number" },
  { name: "sale_price", label: "Sale Price", type: "number" },
  { name: "lead_time", label: "Lead time (days)", type: "number" },
  { name: "batching_limit", label: "Batching limit", type: "number" },
  { name: "description", label: "Description", type: "textarea", span: 2 },
];

function ProductsPage() {
  useProductsRealtime();
  const { data: products = [], isLoading } = useProducts();
  const create = useCreateProduct();
  const update = useUpdateProduct();
  const del = useDeleteProduct();

  const [q, setQ] = useState("");
  const [type, setType] = useState<string>("all");

  const filtered = useMemo(() => products.filter((p) => {
    if (type !== "all" && p.type !== type) return false;
    if (!q) return true;
    const s = q.toLowerCase();
    return p.sku.toLowerCase().includes(s) || p.name.toLowerCase().includes(s);
  }), [products, type, q]);

  const counts = useMemo(() => {
    const c = { finished: 0, semi: 0, raw: 0 } as Record<string, number>;
    for (const p of products) c[p.type] = (c[p.type] ?? 0) + 1;
    return c;
  }, [products]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Products</h1>
          <p className="text-sm text-muted-foreground">
            {isLoading ? "Loading…" : `${filtered.length} of ${products.length} products · shared master catalog`}
          </p>
        </div>
        <EntityFormDialog<Partial<Product>>
          title="New Product"
          fields={fields}
          initial={{ type: "finished", uom: "ea", standard_cost: 0, sale_price: 0, lead_time: 0 }}
          onSubmit={async (v) => {
            await create.mutateAsync(v as never);
            toast.success("Product created");
          }}
          trigger={
            <button className="flex items-center gap-1.5 rounded-lg bg-gradient-to-br from-primary to-info px-3 py-1.5 text-xs font-medium text-primary-foreground shadow-[var(--shadow-glow)]">
              <Plus className="h-3.5 w-3.5" /> New product
            </button>
          }
        />
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <Kpi label="Total" value={products.length} />
        <Kpi label="Finished" value={counts.finished ?? 0} />
        <Kpi label="Semi" value={counts.semi ?? 0} />
        <Kpi label="Raw / ingredients" value={counts.raw ?? 0} />
      </div>

      <div className="glass-panel flex flex-wrap items-center gap-3 rounded-2xl p-3">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search SKU or name…"
            className="h-9 w-full rounded-lg border border-border/60 bg-card/60 pl-8 pr-3 text-sm focus:border-primary/50 focus:outline-none"
          />
        </div>
        <div className="flex items-center gap-1">
          {["all", ...productTypes].map((t) => (
            <button key={t} onClick={() => setType(t)}
              className={`rounded-lg px-2.5 py-1 text-[11px] capitalize ${type === t ? "bg-primary/15 text-primary border border-primary/30" : "border border-transparent text-muted-foreground hover:text-foreground"}`}>
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="glass-panel overflow-hidden rounded-2xl">
        <table className="w-full text-sm">
          <thead className="bg-card/60 text-[11px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-left">SKU</th>
              <th className="px-4 py-3 text-left">Name</th>
              <th className="px-4 py-3 text-left">Type</th>
              <th className="px-4 py-3 text-left">UOM</th>
              <th className="px-4 py-3 text-right">Std cost</th>
              <th className="px-4 py-3 text-right">Sale price</th>
              <th className="px-4 py-3 text-right">Lead</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => (
              <tr key={p.id} className="border-t border-border/40 hover:bg-card/40">
                <td className="px-4 py-3">
                  <Link to="/products/$productId" params={{ productId: p.id }} className="flex items-center gap-2">
                    <Package className="h-3.5 w-3.5 text-primary" />
                    <span className="font-mono text-xs text-primary hover:underline">{p.sku}</span>
                  </Link>
                </td>
                <td className="px-4 py-3">{p.name}</td>
                <td className="px-4 py-3">
                  <span className="rounded-full border border-border/60 bg-card/60 px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">{p.type}</span>
                </td>
                <td className="px-4 py-3 font-mono text-xs">{p.uom}</td>
                <td className="px-4 py-3 text-right font-mono">${Number(p.standard_cost).toFixed(2)}</td>
                <td className="px-4 py-3 text-right font-mono">${Number(p.sale_price).toFixed(2)}</td>
                <td className="px-4 py-3 text-right font-mono text-xs">{p.lead_time}d</td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-1.5">
                    <EntityFormDialog<Partial<Product>>
                      title="Edit Product"
                      fields={fields}
                      initial={p as never}
                      onSubmit={async (v) => { await update.mutateAsync({ id: p.id, patch: v as never }); toast.success("Saved"); }}
                      trigger={
                        <button className="grid h-8 w-8 place-items-center rounded-lg border border-border/60 bg-card/60 text-muted-foreground hover:text-primary">
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                      }
                    />
                    <button
                      onClick={() => { if (confirm(`Delete ${p.sku}?`)) del.mutate(p.id, { onSuccess: () => toast.success("Deleted") }); }}
                      className="grid h-8 w-8 place-items-center rounded-lg border border-border/60 bg-card/60 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && !isLoading && (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-sm text-muted-foreground">No products.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="glass-panel rounded-2xl p-4">
      <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">{label}</div>
      <div className="mt-2 font-mono text-3xl font-semibold">{value}</div>
    </div>
  );
}
