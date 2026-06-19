import { createFileRoute } from "@tanstack/react-router";
import { sensorSeries } from "@/lib/mes-data";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Activity, Thermometer, Gauge as GaugeIcon, Wind, Weight } from "lucide-react";

export const Route = createFileRoute("/telemetry")({
  head: () => ({
    meta: [
      { title: "Telemetry · Cortanex MES" },
      { name: "description", content: "Live OPC-UA / MQTT sensor data — temperature, pressure, speed and weight streamed from the edge." },
    ],
  }),
  component: Telemetry,
});

const ts = { background: "oklch(0.16 0.02 240 / 0.95)", border: "1px solid oklch(0.3 0.02 245)", borderRadius: 8, fontSize: 12 };

function Telemetry() {
  const charts = [
    { title: "Mixer Temperature", asset: "ASSET-MX01", metric: "temperature", unit: "°C", data: sensorSeries.temperature, target: 65, color: "oklch(0.78 0.16 195)", icon: Thermometer },
    { title: "Vessel Pressure", asset: "ASSET-VS01", metric: "pressure", unit: "bar", data: sensorSeries.pressure, target: 2.4, color: "oklch(0.82 0.17 80)", icon: GaugeIcon },
    { title: "Line Speed", asset: "ASSET-LN01", metric: "speed", unit: "ppm", data: sensorSeries.speed, target: 140, color: "oklch(0.72 0.18 155)", icon: Wind },
    { title: "Pack Weight", asset: "ASSET-PK01", metric: "weight", unit: "g", data: sensorSeries.weight, target: 60, color: "oklch(0.72 0.14 280)", icon: Weight },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Telemetry</h1>
          <p className="text-sm text-muted-foreground">OPC-UA / MQTT · 12 assets · 90-day full resolution retention</p>
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-success/40 bg-success/10 px-3 py-1.5 text-xs text-success">
          <span className="status-dot animate-pulse-glow text-success" />
          Streaming · 142 readings/s
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {charts.map((c) => {
          const Icon = c.icon;
          const last = c.data.at(-1)?.v ?? 0;
          return (
            <div key={c.title} className="glass-panel rounded-2xl p-5">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-xl bg-card/60" style={{ color: c.color }}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold">{c.title}</h3>
                    <p className="font-mono text-[10px] text-muted-foreground">{c.asset} · target {c.target}{c.unit}</p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-mono text-2xl font-semibold" style={{ color: c.color }}>
                    {last}<span className="ml-0.5 text-xs text-muted-foreground">{c.unit}</span>
                  </div>
                  <div className="text-[10px] text-muted-foreground">live</div>
                </div>
              </div>
              <div className="mt-4 h-48">
                <ResponsiveContainer>
                  <AreaChart data={c.data}>
                    <defs>
                      <linearGradient id={`tg-${c.metric}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={c.color} stopOpacity={0.6} />
                        <stop offset="100%" stopColor={c.color} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.3 0.02 245 / 0.4)" />
                    <XAxis dataKey="t" stroke="oklch(0.68 0.02 245)" fontSize={10} />
                    <YAxis stroke="oklch(0.68 0.02 245)" fontSize={10} />
                    <Tooltip contentStyle={ts} />
                    <Area type="monotone" dataKey="v" stroke={c.color} fill={`url(#tg-${c.metric})`} strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          );
        })}
      </div>

      <div className="glass-panel rounded-2xl p-5">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Edge Gateway Status</h3>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {[
            { name: "Plant 01 · Gateway-A", uptime: "99.99%", buffered: "0 msg", latency: "12 ms" },
            { name: "Plant 02 · Gateway-B", uptime: "99.86%", buffered: "248 msg", latency: "34 ms" },
            { name: "Plant 03 · Gateway-C", uptime: "100.0%", buffered: "0 msg", latency: "9 ms" },
          ].map((g) => (
            <div key={g.name} className="rounded-xl border border-border/60 bg-card/40 p-3 text-xs">
              <div className="font-medium">{g.name}</div>
              <div className="mt-2 grid grid-cols-3 gap-2 font-mono">
                <div><div className="text-[10px] text-muted-foreground">Uptime</div><div className="text-success">{g.uptime}</div></div>
                <div><div className="text-[10px] text-muted-foreground">Buffer</div><div>{g.buffered}</div></div>
                <div><div className="text-[10px] text-muted-foreground">Latency</div><div>{g.latency}</div></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
