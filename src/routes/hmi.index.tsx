import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { Cpu, Hand, Zap, ArrowRight } from "lucide-react";
import { useMes } from "@/lib/mes-store";

export const Route = createFileRoute("/hmi/")({
  head: () => ({
    meta: [
      { title: "HMI · Station Selector · Cortanex MES" },
      { name: "description", content: "Choose a station to launch its dynamic HMI (auto / semi-auto / manual operations)." },
    ],
  }),
  component: HmiIndex,
});

function HmiIndex() {
  const store = useMes();
  const grouped = useMemo(() => {
    const byLine = new Map<string, typeof store.stations>();
    for (const s of store.stations) {
      if (!byLine.has(s.lineId)) byLine.set(s.lineId, []);
      byLine.get(s.lineId)!.push(s);
    }
    return Array.from(byLine.entries()).map(([lineId, ss]) => ({
      line: store.lines.find((l) => l.id === lineId),
      stations: ss.slice().sort((a, b) => a.sequence - b.sequence),
    }));
  }, [store.stations, store.lines]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight">HMI · Station Runtime</h1>
        <p className="text-xs text-muted-foreground">
          Launch the dynamic Human-Machine Interface for any station. Auto stations run headless with variable readings;
          semi-auto stations combine auto + manual operations; manual stations require operator input.
        </p>
      </div>

      {grouped.map(({ line, stations }) => (
        <div key={line?.id ?? "unknown"} className="glass-panel rounded-2xl p-4">
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
