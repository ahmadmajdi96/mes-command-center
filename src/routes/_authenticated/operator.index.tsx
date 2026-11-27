import { createFileRoute, Link } from "@tanstack/react-router";
import { Hand, Zap, Cpu, ArrowRight } from "lucide-react";
import { useRows } from "@/lib/execution-db";
import type { RuntimeLine, RuntimeStation } from "@/lib/station-runtime";

export const Route = createFileRoute("/_authenticated/operator/")({
  head: () => ({
    meta: [
      { title: "Operator Apps · Cortanex MES" },
      { name: "description", content: "Simplified operator sub-apps per station — scan, process, waste, hold." },
    ],
  }),
  component: OperatorIndex,
});

function OperatorIndex() {
  const lookup = useRows<RuntimeStation>("stations", { order: "sequence", asc: true });
  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight">Operator Apps</h1>
        <p className="text-xs text-muted-foreground">Big-button, scan-first UI for the shop floor. Uses the same recipe / waste / hold engine as the HMI.</p>
      </div>
      {lookup.isPending && <p role="status">Loading stations…</p>}
      {lookup.isError && <p role="alert">Stations could not be loaded.</p>}
      {lookup.isSuccess && !lookup.data.length && <p className="text-muted-foreground">No stations are available in your scope.</p>}
      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
        {(lookup.data ?? []).map((s) => {
          const auto = s.type === "automatic";
          const semi = (s.type as string) === "semi_auto";
          const Icon = auto ? Cpu : semi ? Zap : Hand;
          return (
            <Link key={s.id} to="/operator/$stationId" params={{ stationId: s.id }} className="group flex items-center gap-3 rounded-xl border border-border/60 bg-card/60 p-3 hover:bg-card">
              <div className="grid h-11 w-11 place-items-center rounded-lg border border-border/40 bg-background/40"><Icon className="h-5 w-5" /></div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{s.name}</div>
                <div className="truncate text-[11px] text-muted-foreground"><span className="font-mono">{s.id}</span> · {semi ? "semi-auto" : s.type}</div>
              </div>
              <ArrowRight className="h-4 w-4 opacity-40 transition group-hover:translate-x-0.5 group-hover:opacity-100" />
            </Link>
          );
        })}
      </div>
    </div>
  );
}
