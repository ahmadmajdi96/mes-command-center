import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Plus, Search, ClipboardList, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  useProductionOrders, useCreatePo, useUpdatePo, useDeletePo, usePosRealtime, poStatuses,
  generateLotNumber, generatePoNumber, type ProductionOrder,
} from "@/lib/production-orders-db";
import { useProducts } from "@/lib/products-db";
import { useMes } from "@/lib/mes-store";
import { EntityFormDialog, type Field } from "@/components/crud/entity-form-dialog";

export const Route = createFileRoute("/_authenticated/production-orders/")({
  head: () => ({
    meta: [
      { title: "Production Orders · Cortanex MES" },
      { name: "description", content: "Plan and release production orders with auto-generated lot numbers, line assignment, and unit-level traceability." },
    ],
  }),
  component: PosPage,
});

function PosPage() {
  usePosRealtime();
  const { data: pos = [], isLoading } = useProductionOrders();
  const { data: products = [] } = useProducts();
  const store = useMes();
  const lines = store.lines;

  const create = useCreatePo();
  const update = useUpdatePo();
  const del = useDeletePo();

  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string>("all");

  const filtered = useMemo(() => pos.filter((o) => {
    if (status !== "all" && o.status !== status) return false;
    if (!q) return true;
    const s = q.toLowerCase();
    return o.number.toLowerCase().includes(s)
      || o.lot_number.toLowerCase().includes(s)
      || o.sku.toLowerCase().includes(s)
      || o.product_name.toLowerCase().includes(s);
  }), [pos, status, q]);

  const fields: Field[] = [
    { name: "product_id", label: "Product", type: "select", options: products.map((p) => ({ value: p.id, label: `${p.sku} · ${p.name}` })), required: true, span: 2 },
    { name: "qty", label: "Quantity", type: "number", required: true },
    { name: "uom", label: "UOM", type: "text", required: true },
    { name: "line_id", label: "Line", type: "select", options: [{ value: "", label: "— unassigned —" }, ...lines.map((l) => ({ value: l.id, label: `${l.id} · ${l.name}` }))] },
    { name: "shift", label: "Shift", type: "select", options: ["A", "B", "C"].map((s) => ({ value: s, label: s })) },
    { name: "planned_start", label: "Planned start", type: "text", placeholder: "YYYY-MM-DDTHH:mm" },
    { name: "planned_end", label: "Planned end", type: "text", placeholder: "YYYY-MM-DDTHH:mm" },
    { name: "operator", label: "Operator", type: "text" },
    { name: "priority", label: "Priority", type: "select", options: ["low", "normal", "high", "urgent"].map((s) => ({ value: s, label: s })) },
    { name: "status", label: "Status", type: "select", options: poStatuses.map((s) => ({ value: s, label: s })), required: true, span: 2 },
    { name: "notes", label: "Notes", type: "textarea", span: 2 },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Production Orders</h1>
          <p className="text-sm text-muted-foreground">
            {isLoading ? "Loading…" : `${filtered.length} of ${pos.length} · lot numbers auto-generated on create`}
          </p>
        </div>
        <div className="flex gap-2">
          <Link to="/planner" className="flex items-center gap-1.5 rounded-lg border border-border/60 bg-card/60 px-3 py-1.5 text-xs">
            Open planner →
          </Link>
          <EntityFormDialog<Partial<ProductionOrder> & { product_id?: string }>
            title="New Production Order"
            description="Lot number and PO number are generated automatically from date and SKU."
            fields={fields}
            initial={{ status: "scheduled", uom: "ea", shift: "A", priority: "normal" }}
            onSubmit={async (v) => {
              const p = products.find((x) => x.id === v.product_id);
              if (!p) { toast.error("Select a product"); return; }
              const previewLot = generateLotNumber(p.sku, pos);
              const previewNum = generatePoNumber(pos);
              await create.mutateAsync({
                sku: p.sku,
                product_name: p.name,
                product_id: p.id,
                uom: v.uom ?? p.uom,
                qty: Number(v.qty ?? 0),
                line_id: v.line_id || null,
                planned_start: v.planned_start ? new Date(v.planned_start).toISOString() : null,
                planned_end: v.planned_end ? new Date(v.planned_end).toISOString() : null,
                status: v.status ?? "scheduled",
                priority: v.priority ?? "normal",
                shift: v.shift ?? "A",
                operator: v.operator ?? null,
                notes: v.notes ?? null,
              } as never);
              toast.success(`PO ${previewNum} created · lot ${previewLot}`);
            }}
            trigger={
              <button className="flex items-center gap-1.5 rounded-lg bg-gradient-to-br from-primary to-info px-3 py-1.5 text-xs font-medium text-primary-foreground shadow-[var(--shadow-glow)]">
                <Plus className="h-3.5 w-3.5" /> New order
              </button>
            }
          />
        </div>
      </div>

      <div className="glass-panel flex flex-wrap items-center gap-3 rounded-2xl p-3">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search PO#, lot, SKU…"
            className="h-9 w-full rounded-lg border border-border/60 bg-card/60 pl-8 pr-3 text-sm focus:border-primary/50 focus:outline-none" />
        </div>
        <div className="flex flex-wrap gap-1">
          {(["all", ...poStatuses] as const).map((s) => (
            <button key={s} onClick={() => setStatus(s)}
              className={`rounded-full border px-2.5 py-1 text-[11px] capitalize ${status === s ? "border-primary/60 bg-primary/10 text-primary" : "border-border/60 bg-card/60 text-muted-foreground hover:text-foreground"}`}>
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="glass-panel overflow-x-auto rounded-2xl">
        <table className="w-full text-sm">
          <thead className="bg-card/60 text-[11px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-left">PO / Lot</th>
              <th className="px-4 py-3 text-left">Product</th>
              <th className="px-4 py-3 text-left">Qty</th>
              <th className="px-4 py-3 text-left">Line</th>
              <th className="px-4 py-3 text-left">Window</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((o) => (
              <tr key={o.id} className="border-t border-border/40 hover:bg-card/40">
                <td className="px-4 py-3">
                  <Link to="/production-orders/$poId" params={{ poId: o.id }} className="flex items-center gap-2">
                    <ClipboardList className="h-3.5 w-3.5 text-primary" />
                    <div className="min-w-0">
                      <div className="font-mono text-xs text-primary">{o.number}</div>
                      <div className="font-mono text-[10px] text-muted-foreground">{o.lot_number}</div>
                    </div>
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <div className="font-medium">{o.product_name}</div>
                  <div className="text-[10px] text-muted-foreground">{o.sku}</div>
                </td>
                <td className="px-4 py-3 font-mono text-xs">{Number(o.qty_produced).toLocaleString()} / {Number(o.qty).toLocaleString()} {o.uom}</td>
                <td className="px-4 py-3 font-mono text-xs">{o.line_id ?? "—"}</td>
                <td className="px-4 py-3 font-mono text-[11px] text-muted-foreground">
                  {o.planned_start ? new Date(o.planned_start).toLocaleString() : "—"}
                  <br />
                  {o.planned_end ? new Date(o.planned_end).toLocaleString() : ""}
                </td>
                <td className="px-4 py-3">
                  <span className="rounded-full border border-border/60 bg-card/60 px-2 py-0.5 text-[10px] uppercase tracking-wider">{o.status}</span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-1.5">
                    <EntityFormDialog<Partial<ProductionOrder>>
                      title="Edit Production Order"
                      fields={fields}
                      initial={{
                        ...o,
                        planned_start: o.planned_start ? o.planned_start.slice(0, 16) : "",
                        planned_end: o.planned_end ? o.planned_end.slice(0, 16) : "",
                      } as never}
                      onSubmit={async (v) => {
                        await update.mutateAsync({
                          id: o.id,
                          patch: {
                            ...v,
                            planned_start: v.planned_start ? new Date(v.planned_start as string).toISOString() : null,
                            planned_end: v.planned_end ? new Date(v.planned_end as string).toISOString() : null,
                          } as never,
                        });
                        toast.success("Saved");
                      }}
                      trigger={
                        <button className="grid h-8 w-8 place-items-center rounded-lg border border-border/60 bg-card/60 text-muted-foreground hover:text-primary">
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                      }
                    />
                    <button
                      onClick={() => { if (confirm(`Delete ${o.number}? This will delete its units too.`)) del.mutate(o.id, { onSuccess: () => toast.success("Deleted") }); }}
                      className="grid h-8 w-8 place-items-center rounded-lg border border-border/60 bg-card/60 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && !isLoading && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-muted-foreground">No production orders yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
