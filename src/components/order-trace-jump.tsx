import { useNavigate } from "@tanstack/react-router";
import { useRows } from "@/lib/execution-db";

/** Pick an order to open its full trace (batches, items, materials, output, waste). */
export function OrderTraceJump() {
  const nav = useNavigate();
  const { data = [] } = useRows<any>("production_orders");
  return (
    <select
      aria-label="Trace an order"
      className="mt-2 h-8 rounded-lg border border-border/60 bg-card/60 px-2 text-xs"
      value=""
      onChange={(e) => e.target.value && nav({ to: "/record/$kind/$id", params: { kind: "trace", id: e.target.value } })}
    >
      <option value="">Open an order's full trace…</option>
      {data.map((o) => <option key={o.id} value={o.id}>{o.id} · {o.product_name}</option>)}
    </select>
  );
}
