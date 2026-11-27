import { createFileRoute, Link } from "@tanstack/react-router";
import { useListControls } from "@/components/list-controls";
import { StatusPill } from "@/components/status-pill";
import type { Database } from "@/integrations/supabase/types";
import { useRows } from "@/lib/execution-db";

export const Route = createFileRoute("/_authenticated/lines/")({
  head: () => ({ meta: [{ title: "Production Lines · Cortanex MES" }] }),
  component: ProductionLines,
});

function ProductionLines() {
  const lines = useRows<Database["public"]["Tables"]["lines"]["Row"]>("lines", {
    order: "name",
    asc: true,
  });
  const list = useListControls(lines.data ?? [], {
    exportName: "production-lines",
    searchKeys: ["id", "name", "plant", "status"],
  });
  return (
    <div className="min-w-0 space-y-5">
      <header>
        <h1 className="font-display text-2xl font-semibold">Production Lines</h1>
        <p className="text-sm text-muted-foreground">
          Configured lines and their recorded status. Open a line to find its assigned stations and
          work orders.
        </p>
      </header>
      {lines.isPending && <p role="status">Loading production lines…</p>}
      {lines.isError && (
        <p role="alert">
          Production lines could not be loaded.{" "}
          <button className="text-primary underline" onClick={() => lines.refetch()}>
            Retry
          </button>
        </p>
      )}
      {lines.isSuccess && (
        <>
          {list.toolbar}
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {list.visible.map((line) => (
              <Link
                to="/lines/$lineId"
                params={{ lineId: line.id }}
                key={line.id}
                className="glass-panel min-w-0 space-y-2 rounded-xl p-4 hover:border-primary"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="min-w-0 break-words text-lg font-semibold">{line.name}</h2>
                  <StatusPill status={line.status} />
                </div>
                <div className="break-words text-sm text-muted-foreground">
                  {line.id} · {line.plant}
                </div>
                <div className="text-sm">Tracking mode: {line.tracking_mode}</div>
              </Link>
            ))}
          </div>
          {!list.visible.length && (
            <p className="text-sm text-muted-foreground">No production lines match.</p>
          )}
          {list.pager}
        </>
      )}
    </div>
  );
}
