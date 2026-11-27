import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { Cpu, Hand, Zap, ArrowRight } from "lucide-react";
import { useRows } from "@/lib/execution-db";
import type { RuntimeLine, RuntimeStation } from "@/lib/station-runtime";

export const Route = createFileRoute("/_authenticated/hmi/")({
  head: () => ({
    meta: [
      { title: "HMI · Station Selector · Cortanex MES" },
      { name: "description", content: "Choose a station to launch its dynamic HMI (auto / semi-auto / manual operations)." },
    ],
  }),
  component: HmiIndex,
});

function HmiIndex() {
  const lookup = useRows<RuntimeStation>("stations", { order: "sequence", asc: true });
  const { data: lines } = useRows<RuntimeLine>("lines", { order: "name", asc: true });
  const grouped = useMemo(() => {
    const byLine = new Map<string, RuntimeStation[]>();
    for (const s of (lookup.data ?? [])) {
      if (!byLine.has(s.line_id)) byLine.set(s.line_id, []);
      byLine.get(s.line_id)!.push(s);
    }
    return Array.from(byLine.entries()).map(([lineId, ss]) => ({
      lineId,
      line: lines?.find((l) => l.id === lineId),
      stations: ss.slice().sort((a, b) => a.sequence - b.sequence),
    }));
  }, [lookup.data, lines]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight">HMI · Station Runtime</h1>
        <p className="text-xs text-muted-foreground">
          Open the MES station interface for a station available in your access scope.
        </p>
      </div>

      {lookup.isPending && <p role="status">Loading stations…</p>}
      {lookup.isError && <p role="alert">Stations could not be loaded.</p>}
      {lookup.isSuccess && !lookup.data.length && <p className="text-muted-foreground">No stations are available in your scope.</p>}
      {grouped.map(({ lineId, line, stations }) => (
        <div key={lineId} className="glass-panel rounded-2xl p-4">
          <div className="mb-2 flex items-center justify-between">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Line</div>
              <div className="text-sm font-semibold">{line?.name ?? "Unassigned"}</div>
            </div>
            <div className="text-[11px] text-muted-foreground">{stations.length} station(s)</div>
          </div>
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {stations.map((s) => {
              const auto = s.type === "automatic";
              const semi = (s.type as string) === "semi_auto";
              const Icon = auto ? Cpu : semi ? Zap : Hand;
              const tone = auto ? "border-primary/40 text-primary bg-primary/5"
                : semi ? "border-warning/40 text-warning bg-warning/5"
                : "border-accent/40 text-accent bg-accent/5";
              return (
                <Link
                  key={s.id}
                  to="/hmi/$stationId"
                  params={{ stationId: s.id }}
                  className={`group flex items-center gap-3 rounded-xl border p-3 transition hover:bg-card/80 ${tone}`}
                >
                  <div className="grid h-10 w-10 place-items-center rounded-lg border border-current/40 bg-background/40">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{s.name}</div>
                    <div className="truncate text-[11px] text-muted-foreground">
                      <span className="font-mono">{s.id}</span> · seq {s.sequence} · {semi ? "semi-auto" : s.type}
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 shrink-0 opacity-40 group-hover:translate-x-0.5 group-hover:opacity-100 transition" />
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
