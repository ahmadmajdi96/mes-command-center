import { createFileRoute } from "@tanstack/react-router";
import { downtime, downtimeReasons } from "@/lib/mes-data";
import { StatusPill } from "@/components/status-pill";
import { AlertOctagon, Wrench, Clock } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export const Route = createFileRoute("/downtime")({
  head: () => ({
    meta: [
      { title: "Andon & Downtime · Cortanex MES" },
      { name: "description", content: "Live stoppage events with reason codes, auto-dispatch to CMMS for equipment failures." },
    ],
  }),
  component: DowntimePage,
});

function DowntimePage() {
  const open = downtime.filter((d) => d.status === "open");
  const totalMin = downtime.reduce((s, d) => s + d.durationMin, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight">Andon & Downtime</h1>
        <p className="text-sm text-muted-foreground">Real-time stoppage capture · equipment failures auto-create CMMS work orders</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <Kpi label="Open events" value={open.length} icon={AlertOctagon} accent="destructive" />
        <Kpi label="Today total" value={`${totalMin}m`} icon={Clock} />
        <Kpi label="MTTR" value="14m" icon={Wrench} accent="info" />
        <Kpi label="MTBF" value="3h 22m" icon={Clock} accent="success" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="glass-panel rounded-2xl p-5 lg:col-span-2">
          <h3 className="mb-3 text-sm font-semibold">Pareto by reason</h3>
          <div className="h-64">
            <ResponsiveContainer>
              <BarChart data={downtimeReasons}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.3 0.02 245 / 0.4)" />
                <XAxis dataKey="name" stroke="oklch(0.68 0.02 245)" fontSize={10} />
                <YAxis stroke="oklch(0.68 0.02 245)" fontSize={10} />
                <Tooltip contentStyle={{ background: "oklch(0.16 0.02 240 / 0.95)", border: "1px solid oklch(0.3 0.02 245)", borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                  {downtimeReasons.map((d, i) => <Cell key={i} fill={d.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass-panel rounded-2xl p-5">
          <h3 className="mb-3 text-sm font-semibold">Live Andon Board</h3>
          <div className="space-y-2">
            {open.map((d) => (
              <div key={d.id} className="rounded-xl border border-destructive/40 bg-destructive/5 p-3">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs">{d.lineId}</span>
                  <span className="font-mono text-xs text-destructive">{d.durationMin}m</span>
                </div>
                <p className="mt-1 truncate text-sm font-medium">{d.reasonCode}</p>
                <p className="truncate text-[11px] text-muted-foreground">{d.lineName} · since {d.startedAt}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="glass-panel overflow-hidden rounded-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-card/60 text-[11px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Event</th>
                <th className="px-4 py-3 text-left font-medium">Line</th>
                <th className="px-4 py-3 text-left font-medium">Reason</th>
                <th className="px-4 py-3 text-left font-medium">Category</th>
                <th className="px-4 py-3 text-left font-medium">Started</th>
                <th className="px-4 py-3 text-right font-medium">Duration</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {downtime.map((d) => (
                <tr key={d.id} className="border-t border-border/40 hover:bg-card/40">
                  <td className="px-4 py-3 font-mono text-xs">{d.id}</td>
                  <td className="px-4 py-3">
                    <div className="font-mono text-xs">{d.lineId}</div>
                    <div className="text-[10px] text-muted-foreground">{d.lineName}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium">{d.reasonCode}</div>
                    {d.notes && <div className="text-[10px] text-muted-foreground">{d.notes}</div>}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{d.category.replace("_", " ")}</td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{d.startedAt}</td>
                  <td className="px-4 py-3 text-right font-mono text-xs">{d.durationMin}m</td>
                  <td className="px-4 py-3"><StatusPill status={d.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Kpi({ label, value, icon: Icon, accent = "primary" }: { label: string; value: string | number; icon: React.ComponentType<{ className?: string }>; accent?: "primary" | "destructive" | "info" | "success" }) {
  const m = { primary: "text-primary", destructive: "text-destructive", info: "text-info", success: "text-success" } as const;
  return (
    <div className="glass-panel rounded-2xl p-4">
      <div className="flex items-center justify-between">
        <span className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">{label}</span>
        <Icon className={`h-4 w-4 ${m[accent]}`} />
      </div>
      <div className={`mt-2 font-mono text-3xl font-semibold ${m[accent]}`}>{value}</div>
    </div>
  );
}
