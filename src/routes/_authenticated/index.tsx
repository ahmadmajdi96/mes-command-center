import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { StatusPill } from "@/components/status-pill";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { useRows } from "@/lib/execution-db";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({ meta: [{ title: "Control Center · Cortanex MES" }] }),
  component: Dashboard,
});

type Tables = Database["public"]["Tables"];

function Dashboard() {
  const lines = useRows<Tables["lines"]["Row"]>("lines", { order: "name", asc: true });
  const counts = useQuery({
    queryKey: ["dashboard", "summary-counts"],
    queryFn: async () => {
      const [orders, configured, downtime, holds] = await Promise.all([
        supabase
          .from("production_orders")
          .select("id", { count: "exact", head: true })
          .eq("status", "running"),
        supabase.from("lines").select("id", { count: "exact", head: true }),
        supabase
          .from("downtime_events")
          .select("id", { count: "exact", head: true })
          .eq("status", "open"),
        supabase
          .from("quality_holds")
          .select("id", { count: "exact", head: true })
          .eq("status", "open"),
      ]);
      return { orders, configured, downtime, holds };
    },
  });
  const readings = useQuery({
    queryKey: ["dashboard", "recent-machine-readings"],
    refetchInterval: 15_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("machine_readings")
        .select("id,machine_id,tag,value,text_value,unit,source,created_at")
        .in("source", ["manual", "edge"])
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="min-w-0 space-y-6">
      <header>
        <h1 className="font-display text-2xl font-semibold">Control Center</h1>
        <p className="text-sm text-muted-foreground">
          Production orders, line status and recorded machine readings in your access scope.
        </p>
      </header>

      <section id="production-monitoring" className="scroll-mt-20 space-y-3">
        <h2 className="text-lg font-semibold">Production monitoring</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Summary
            title="Running orders"
            count={counts.data?.orders.count ?? undefined}
            failed={counts.isError || !!counts.data?.orders.error}
          >
            <Link to="/work-orders">Work orders</Link>
          </Summary>
          <Summary
            title="Configured lines"
            count={counts.data?.configured.count ?? undefined}
            failed={counts.isError || !!counts.data?.configured.error}
          >
            <Link to="/lines">Production lines</Link>
          </Summary>
          <Summary
            title="Open downtime events"
            count={counts.data?.downtime.count ?? undefined}
            failed={counts.isError || !!counts.data?.downtime.error}
          >
            <Link to="/downtime">Downtime</Link>
          </Summary>
          <Summary
            title="Open quality holds"
            count={counts.data?.holds.count ?? undefined}
            failed={counts.isError || !!counts.data?.holds.error}
          >
            <Link to="/quality">Quality holds</Link>
          </Summary>
        </div>
        <div className="glass-panel rounded-xl p-4">
          <h3 className="font-semibold">Line status</h3>
          {lines.isPending && (
            <p role="status" className="text-sm">
              Loading lines…
            </p>
          )}
          {lines.isError && (
            <p role="alert" className="text-sm">
              Line status is unavailable.
            </p>
          )}
          {lines.isSuccess && !lines.data.length && (
            <p className="text-sm text-muted-foreground">No lines are available in your scope.</p>
          )}
          <ul className="divide-y divide-border/40">
            {lines.data?.map((line) => (
              <li
                key={line.id}
                className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm"
              >
                <Link
                  to="/lines/$lineId"
                  params={{ lineId: line.id }}
                  className="text-primary underline"
                >
                  {line.name} <span className="text-xs text-muted-foreground">{line.id}</span>
                </Link>
                <StatusPill status={line.status} />
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section id="telemetry" className="glass-panel scroll-mt-20 space-y-3 rounded-xl p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold">Recorded machine readings</h2>
            <p className="text-sm text-muted-foreground">
              Latest stored observations. Gateway connectivity is unknown.
            </p>
          </div>
          <button
            className="rounded-md border px-3 py-1 text-sm"
            onClick={() => readings.refetch()}
          >
            Refresh readings
          </button>
        </div>
        {readings.isPending && (
          <p role="status" className="text-sm">
            Loading readings…
          </p>
        )}
        {readings.isError && (
          <p role="alert" className="text-sm">
            Readings could not be loaded.
          </p>
        )}
        {readings.isSuccess && !readings.data.length && (
          <p className="text-sm text-muted-foreground">
            No manual or edge readings are recorded in your scope.
          </p>
        )}
        {!!readings.data?.length && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr>
                  {["Machine", "Tag", "Value", "Source", "Recorded at"].map((name) => (
                    <th key={name} scope="col" className="p-2">
                      {name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {readings.data.map((row) => (
                  <tr key={row.id} className="border-t">
                    <td className="p-2">{row.machine_id}</td>
                    <td className="p-2">{row.tag}</td>
                    <td className="p-2">
                      {row.value == null
                        ? (row.text_value ?? "—")
                        : `${row.value}${row.unit ? ` ${row.unit}` : ""}`}
                    </td>
                    <td className="p-2">{row.source === "edge" ? "Edge" : "Manual"}</td>
                    <td className="p-2 whitespace-nowrap">
                      <time dateTime={row.created_at}>
                        {new Date(row.created_at).toLocaleString()}
                      </time>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Link to="/machines" className="inline-block text-sm text-primary underline">
          Machine registry
        </Link>
      </section>
    </div>
  );
}

function Summary({
  title,
  count,
  failed,
  children,
}: {
  title: string;
  count?: number;
  failed: boolean;
  children: React.ReactNode;
}) {
  return (
    <article className="glass-panel rounded-xl p-4">
      <h3 className="text-sm text-muted-foreground">{title}</h3>
      <p className="my-1 font-mono text-2xl">{failed ? "Unavailable" : (count ?? "—")}</p>
      <span className="text-sm text-primary underline">{children}</span>
    </article>
  );
}
