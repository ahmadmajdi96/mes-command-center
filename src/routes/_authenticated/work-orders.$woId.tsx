import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { StatusPill } from "@/components/status-pill";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { useRows } from "@/lib/execution-db";

export const Route = createFileRoute("/_authenticated/work-orders/$woId")({
  head: ({ params }) => ({ meta: [{ title: `Work Order ${params.woId} · Cortanex MES` }] }),
  component: WorkOrder,
});

type Operation = Database["public"]["Tables"]["order_operations"]["Row"];

function WorkOrder() {
  const { woId } = Route.useParams();
  const order = useQuery({
    queryKey: ["work-order-detail", woId],
    queryFn: async () => {
      const find = (id: string) =>
        supabase.from("production_orders").select("*").eq("id", id).maybeSingle();
      const canonical = await find(woId);
      if (canonical.error) throw canonical.error;
      if (canonical.data) return canonical.data;

      const legacy = await supabase
        .from("work_orders")
        .select("production_order_id")
        .eq("id", woId)
        .maybeSingle();
      if (legacy.error) throw legacy.error;
      if (!legacy.data?.production_order_id) return null;
      const result = await find(legacy.data.production_order_id);
      if (result.error) throw result.error;
      return result.data;
    },
  });
  const po = order.data;
  const operations = useRows<Operation>("order_operations", {
    eq: { production_order_id: po?.id },
    enabled: !!po,
    order: "sequence",
    asc: true,
  });
  return (
    <div className="min-w-0 space-y-5">
      <Link to="/work-orders" className="text-sm text-primary underline">
        All work orders
      </Link>
      {order.isPending && <p role="status">Loading work order…</p>}
      {order.isError && (
        <p role="alert">
          The work order could not be loaded.{" "}
          <button className="underline" onClick={() => order.refetch()}>
            Retry
          </button>
        </p>
      )}
      {order.isSuccess && !po && <h1 className="text-xl font-semibold">Work order unavailable</h1>}
      {po && (
        <>
          <header className="glass-panel rounded-xl p-4">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="font-display text-2xl font-semibold">{po.number}</h1>
              <StatusPill status={po.status} />
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {po.product_name} · {po.sku} · Lot {po.lot_number}
            </p>
            <p className="mt-1 text-sm">
              {po.qty_produced.toLocaleString()} / {po.qty.toLocaleString()} {po.uom} produced ·{" "}
              {po.line_id ?? "Unassigned line"}
            </p>
            <Link
              to="/record/$kind/$id"
              params={{ kind: "trace", id: po.id }}
              className="mt-3 inline-block text-sm text-primary underline"
            >
              Open order trace
            </Link>
          </header>
          <section className="space-y-2">
            <h2 className="text-lg font-semibold">Operations</h2>
            {operations.isPending && <p role="status">Loading operations…</p>}
            {operations.isError && <p role="alert">Operations could not be loaded.</p>}
            {operations.isSuccess && !operations.data.length && (
              <p className="text-muted-foreground">No operations assigned.</p>
            )}
            <ol className="space-y-2">
              {operations.data?.map((operation) => (
                <li
                  key={operation.id}
                  className="glass-panel flex flex-wrap items-center justify-between gap-3 rounded-lg p-3"
                >
                  <div>
                    <p className="font-medium">
                      {operation.sequence}. {operation.name}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {operation.station_id ?? "No station assigned"}
                    </p>
                  </div>
                  <StatusPill status={operation.status ?? "pending"} />
                </li>
              ))}
            </ol>
          </section>
        </>
      )}
    </div>
  );
}
