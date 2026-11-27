import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Plus } from "lucide-react";
import { useState } from "react";
import { EntityFormDialog, type Field } from "@/components/crud/entity-form-dialog";
import { useListControls } from "@/components/list-controls";
import { StatusPill } from "@/components/status-pill";
import type { Database } from "@/integrations/supabase/types";
import { useCan } from "@/lib/access";
import { useRows } from "@/lib/execution-db";
import { useCreatePo, useProductionOrders } from "@/lib/production-orders-db";

export const Route = createFileRoute("/_authenticated/work-orders/")({
  head: () => ({ meta: [{ title: "Work Orders · Cortanex MES" }] }),
  component: WorkOrders,
});

type Line = Database["public"]["Tables"]["lines"]["Row"];
type Product = Database["public"]["Tables"]["products"]["Row"];
type NewOrder = {
  number: string;
  lot_number: string;
  line_id: string;
  product_id: string;
  qty: number;
};

function WorkOrders() {
  const orders = useProductionOrders();
  const canWrite = useCan("orders.write");
  const lines = useRows<Line>("lines", { enabled: canWrite, order: "name", asc: true });
  const products = useRows<Product>("products", { enabled: canWrite, order: "name", asc: true });
  const create = useCreatePo();
  const [status, setStatus] = useState("all");
  const rows = orders.data ?? [];
  const statuses = [...new Set(rows.map((row) => row.status))].sort();
  const list = useListControls(
    rows.filter((row) => status === "all" || row.status === status),
    {
      exportName: "work-orders",
      searchKeys: ["id", "number", "sku", "product_name", "lot_number", "line_id"],
      dateKey: "planned_start",
    },
  );
  const fields: Field[] = [
    { name: "number", label: "Work order number", type: "text", required: true },
    { name: "lot_number", label: "Lot number", type: "text", required: true },
    {
      name: "line_id",
      label: "Line",
      type: "select",
      required: true,
      options: (lines.data ?? []).map((line) => ({ value: line.id, label: line.name })),
    },
    {
      name: "product_id",
      label: "Product",
      type: "select",
      required: true,
      options: (products.data ?? []).map((product) => ({
        value: product.id,
        label: `${product.sku} · ${product.name}`,
      })),
    },
    { name: "qty", label: "Target quantity", type: "number", required: true, min: 0.000001 },
  ];

  async function save(values: NewOrder) {
    const line = lines.data?.find((row) => row.id === values.line_id);
    const product = products.data?.find((row) => row.id === values.product_id);
    if (!line || !product || line.organization_id !== product.organization_id) {
      throw new Error("Choose a line and product from the same organization.");
    }
    const number = values.number.trim();
    const lot = values.lot_number.trim();
    if (!number || !lot) throw new Error("Enter a work order number and lot number.");
    await create.mutateAsync({
      id: number,
      number,
      lot_number: lot,
      line_id: line.id,
      product_id: product.id,
      product_name: product.name,
      sku: product.sku,
      qty: values.qty,
      uom: product.uom,
      organization_id: line.organization_id,
      tracking_mode: line.tracking_mode,
      status: "scheduled",
    });
  }

  return (
    <div className="min-w-0 space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold">Work Orders</h1>
          <p className="text-sm text-muted-foreground">
            Production orders available within your access scope.
          </p>
        </div>
        {canWrite && !!lines.data?.length && !!products.data?.length && (
          <EntityFormDialog<NewOrder>
            title="New Work Order"
            description="Create a scheduled MES order. Release follows the order's readiness and approval rules."
            fields={fields}
            onSubmit={save}
            trigger={
              <button className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-3 text-sm text-primary-foreground">
                <Plus size={16} />
                New work order
              </button>
            }
          />
        )}
      </header>
      {orders.isPending && <p role="status">Loading work orders…</p>}
      {orders.isError && (
        <p role="alert">
          Work orders could not be loaded.{" "}
          <button className="text-primary underline" onClick={() => orders.refetch()}>
            Retry
          </button>
        </p>
      )}
      {canWrite && (lines.isError || products.isError) && (
        <p role="alert">Order setup data could not be loaded.</p>
      )}
      {canWrite &&
        lines.isSuccess &&
        products.isSuccess &&
        (!lines.data.length || !products.data.length) && (
          <p className="text-sm text-muted-foreground">
            Order creation requires an available line and product.
          </p>
        )}
      {orders.isSuccess && (
        <>
          <label className="inline-flex items-center gap-2 text-sm">
            Status
            <select
              className="rounded-lg border bg-card px-2 py-1"
              value={status}
              onChange={(event) => setStatus(event.target.value)}
            >
              <option value="all">All statuses</option>
              {statuses.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          {list.toolbar}
          <div className="overflow-x-auto rounded-xl border border-border/60">
            <table className="w-full text-sm">
              <thead className="bg-card text-left text-xs text-muted-foreground">
                <tr>
                  {[
                    "Order",
                    "Product",
                    "Line",
                    "Lot",
                    "Produced / target",
                    "Status",
                    "Details",
                  ].map((label) => (
                    <th key={label} scope="col" className="p-3">
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {list.visible.map((order) => (
                  <tr key={order.id} className="border-t border-border/50">
                    <td className="p-3 font-mono">{order.number}</td>
                    <td className="p-3">
                      {order.product_name}
                      <small className="block text-muted-foreground">{order.sku}</small>
                    </td>
                    <td className="p-3">{order.line_id ?? "Unassigned"}</td>
                    <td className="p-3 font-mono">{order.lot_number}</td>
                    <td className="p-3 whitespace-nowrap">
                      {order.qty_produced.toLocaleString()} / {order.qty.toLocaleString()}{" "}
                      {order.uom}
                    </td>
                    <td className="p-3">
                      <StatusPill status={order.status} />
                    </td>
                    <td className="p-3">
                      <Link
                        to="/work-orders/$woId"
                        params={{ woId: order.id }}
                        aria-label={`Open work order ${order.number}`}
                        className="inline-flex items-center gap-1 text-primary"
                      >
                        Open <ArrowRight size={14} aria-hidden="true" />
                      </Link>
                    </td>
                  </tr>
                ))}
                {!list.visible.length && (
                  <tr>
                    <td colSpan={7} className="p-6 text-center text-muted-foreground">
                      No work orders match.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {list.pager}
        </>
      )}
    </div>
  );
}
