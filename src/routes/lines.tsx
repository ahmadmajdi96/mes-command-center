import { createFileRoute } from "@tanstack/react-router";
import { lines } from "@/lib/mes-data";
import { StatusPill } from "@/components/status-pill";
import { ResponsiveContainer, RadialBar, RadialBarChart, PolarAngleAxis } from "recharts";
import { Factory } from "lucide-react";

export const Route = createFileRoute("/lines")({
  head: () => ({
    meta: [
      { title: "Production Lines · Cortanex MES" },
      { name: "description", content: "Live status of every production line — OEE breakdown, current work order and output." },
    ],
  }),
  component: LinesPage,
});

function LinesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight">Production Lines</h1>
        <p className="text-sm text-muted-foreground">All plants · {lines.length} lines monitored</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {lines.map((l) => (
          <div key={l.id} className="glass-panel rounded-2xl p-5">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Factory className="h-3.5 w-3.5" />
                  <span className="font-mono">{l.id}</span>
                  <span>·</span>
                  <span className="truncate">{l.plant}</span>
                </div>
                <h3 className="mt-1 text-lg font-semibold truncate">{l.name}</h3>
                <p className="truncate text-xs text-muted-foreground">{l.product ?? "— no work order —"}</p>
              </div>
              <StatusPill status={l.status} />
            </div>

            <div className="mt-4 grid grid-cols-[auto_minmax(0,1fr)] items-center gap-4">
              <div className="relative h-24 w-24">
                <ResponsiveContainer>
                  <RadialBarChart innerRadius="65%" outerRadius="100%" data={[{ value: l.oee, fill: "oklch(0.78 0.16 195)" }]} startAngle={90} endAngle={-270}>
                    <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
                    <RadialBar dataKey="value" background={{ fill: "oklch(0.25 0.02 245)" }} cornerRadius={10} />
                  </RadialBarChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <span className="font-mono text-lg font-semibold">{l.oee}</span>
                  <span className="text-[9px] uppercase text-muted-foreground">OEE</span>
                </div>
              </div>
              <div className="space-y-1.5 text-xs">
                <Row label="Availability" value={l.availability} />
                <Row label="Performance" value={l.performance} />
                <Row label="Quality" value={l.quality} />
              </div>
            </div>

            <div className="mt-4 border-t border-border/40 pt-3 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Current WO</span>
                <span className="font-mono">{l.currentWorkOrder ?? "—"}</span>
              </div>
              <div className="mt-1 flex justify-between">
                <span className="text-muted-foreground">Output</span>
                <span className="font-mono">{l.output.toLocaleString()} / {l.target.toLocaleString()}</span>
              </div>
              <div className="mt-1 flex justify-between">
                <span className="text-muted-foreground">Uptime</span>
                <span className="font-mono">{l.uptime}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="flex justify-between">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-mono">{value}%</span>
      </div>
      <div className="mt-1 h-1 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-gradient-to-r from-primary to-info" style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}
