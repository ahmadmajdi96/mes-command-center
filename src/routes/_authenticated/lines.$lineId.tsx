import { createFileRoute, Link } from "@tanstack/react-router";
import { RecordLookupState } from "@/components/qp-ui";
import { StatusPill } from "@/components/status-pill";
import type { Database } from "@/integrations/supabase/types";
import { useRows } from "@/lib/execution-db";

export const Route = createFileRoute("/_authenticated/lines/$lineId")({
  head: ({ params }) => ({ meta: [{ title: `Line ${params.lineId} · Cortanex MES` }] }),
  component: LineDetail,
});

type Tables = Database["public"]["Tables"];

function LineDetail() {
  const { lineId } = Route.useParams();
  const lookup = useRows<Tables["lines"]["Row"]>("lines", { eq: { id: lineId }, order: "id" });
  const line = lookup.data?.[0];
  const stations = useRows<Tables["stations"]["Row"]>("stations", {
    eq: { line_id: lineId },
    order: "sequence",
    asc: true,
    enabled: !!line,
  });
  const orders = useRows<Tables["production_orders"]["Row"]>("production_orders", {
    eq: { line_id: lineId },
    enabled: !!line,
  });
  if (!line) {
    return (
      <RecordLookupState
        label="Production line"
        back="/lines"
        pending={lookup.isPending}
        failed={lookup.isError}
        retry={() => lookup.refetch()}
      />
    );
  }
  return (
    <div className="min-w-0 space-y-5">
      <Link to="/lines" className="text-sm text-primary underline">
        Production lines
      </Link>
      <header className="glass-panel rounded-xl p-4">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-display text-2xl font-semibold">{line.name}</h1>
          <StatusPill status={line.status} />
        </div>
        <p className="text-sm text-muted-foreground">
          {line.id} · {line.plant} · {line.tracking_mode} tracking
        </p>
      </header>
      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Stations</h2>
        {stations.isPending && <p role="status">Loading stations…</p>}
        {stations.isError && <p role="alert">Stations could not be loaded.</p>}
        {stations.isSuccess && !stations.data.length && (
          <p className="text-sm text-muted-foreground">No stations configured for this line.</p>
        )}
        <ol className="grid gap-3 md:grid-cols-2">
          {stations.data?.map((station) => (
            <li key={station.id} className="glass-panel min-w-0 space-y-2 rounded-xl p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-medium">
                  {station.sequence}. {station.name}
                </h3>
                <StatusPill status={station.status} />
              </div>
              <div className="text-xs text-muted-foreground">
                {station.id} · {station.type}
              </div>
              <div className="flex flex-wrap gap-4 text-sm text-primary">
                <Link to="/operator/$stationId" params={{ stationId: station.id }}>
                  Operator app
                </Link>
                <Link to="/hmi/$stationId" params={{ stationId: station.id }}>
                  Station HMI
                </Link>
              </div>
            </li>
          ))}
        </ol>
      </section>
      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Assigned work orders</h2>
        {orders.isPending && <p role="status">Loading work orders…</p>}
        {orders.isError && <p role="alert">Work orders could not be loaded.</p>}
        {orders.isSuccess && !orders.data.length && (
          <p className="text-sm text-muted-foreground">No work orders assigned to this line.</p>
        )}
        <ul className="space-y-2">
          {orders.data?.map((order) => (
            <li
              key={order.id}
              className="glass-panel flex flex-wrap items-center justify-between gap-2 rounded-lg p-3 text-sm"
            >
              <Link
                to="/work-orders/$woId"
                params={{ woId: order.id }}
                className="text-primary underline"
              >
                {order.number} · {order.product_name}
              </Link>
              <StatusPill status={order.status} />
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
