import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { Database, Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { seedMesFromFixtures } from "@/lib/mes/seed.functions";

export const Route = createFileRoute("/settings")({
  head: () => ({ meta: [{ title: "Settings · Cortanex MES" }, { name: "description", content: "Plant configuration, reason codes, retention policies and notification preferences." }] }),
  component: Settings,
});

function Settings() {
  const sections = [
    { title: "Plants & Lines", desc: "Configure plants, lines and shift calendars", n: 6 },
    { title: "Reason Codes", desc: "Downtime reason taxonomy per plant", n: 18 },
    { title: "Recipe Versions", desc: "Effective-dated recipe/SOP revisions", n: 412 },
    { title: "Sensor Thresholds", desc: "Alert thresholds and Andon triggers", n: 64 },
    { title: "Retention Policies", desc: "90-day full resolution, then downsampled", n: 4 },
    { title: "Notifications", desc: "Email / SMS / WhatsApp / push channels", n: 9 },
  ];
  const seed = useServerFn(seedMesFromFixtures);
  const qc = useQueryClient();
  const [seeding, setSeeding] = useState(false);
  const [result, setResult] = useState<Record<string, number> | null>(null);

  const runSeed = async () => {
    setSeeding(true);
    try {
      const r = await seed();
      setResult(r.results);
      toast.success("Cloud database seeded from deterministic MES fixtures");
      qc.invalidateQueries({ queryKey: ["mes"] });
    } catch (e: unknown) {
      toast.error(`Seed failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setSeeding(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">Plant-level configuration and platform integrations</p>
      </div>

      {/* Cloud database seed */}
      <div className="glass-panel rounded-2xl p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-lg bg-gradient-to-br from-primary/20 to-info/10 text-primary">
              <Database className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold">Lovable Cloud database</h3>
              <p className="mt-1 max-w-xl text-xs text-muted-foreground">
                Seed lines, stations, work orders, downtime, quality holds, genealogy and the
                3-month audit history into the real database. Idempotent — safe to run twice.
                Dashboard KPIs will start reading live values as soon as this finishes.
              </p>
            </div>
          </div>
          <button
            onClick={runSeed}
            disabled={seeding}
            className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-br from-primary to-info px-3 py-1.5 text-xs font-medium text-primary-foreground shadow-[var(--shadow-glow)] disabled:opacity-50"
          >
            {seeding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Database className="h-3.5 w-3.5" />}
            {seeding ? "Seeding…" : "Seed database"}
          </button>
        </div>
        {result && (
          <div className="mt-4 grid gap-2 sm:grid-cols-4">
            {Object.entries(result).map(([k, v]) => (
              <div key={k} className="rounded-lg border border-success/30 bg-success/5 p-2.5 text-xs">
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-3 w-3 text-success" />
                  <span className="text-muted-foreground">{k}</span>
                </div>
                <div className="mt-1 font-mono text-lg font-semibold text-success">{v.toLocaleString()}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {sections.map((s) => (
          <div key={s.title} className="glass-panel rounded-2xl p-5">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-sm font-semibold">{s.title}</h3>
                <p className="mt-1 text-xs text-muted-foreground">{s.desc}</p>
              </div>
              <span className="rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 font-mono text-[11px] text-primary">{s.n}</span>
            </div>
            <button className="mt-4 w-full rounded-lg border border-border/60 bg-card/60 py-2 text-xs hover:border-primary/40 hover:text-primary">Configure →</button>
          </div>
        ))}
      </div>

      <div className="glass-panel rounded-2xl p-5">
        <h3 className="text-sm font-semibold">Compliance</h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-3 text-xs">
          {[
            ["Step latency", "238 ms", "< 300 ms target"],
            ["Availability", "99.97%", "99.95% target"],
            ["E-batch records", "Immutable", "Append-only after close"],
          ].map(([k, v, h]) => (
            <div key={k} className="rounded-xl border border-success/30 bg-success/5 p-3">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{k}</div>
              <div className="mt-1 font-mono text-lg font-semibold text-success">{v}</div>
              <div className="text-[10px] text-muted-foreground">{h}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
