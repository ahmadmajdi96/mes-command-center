import { createFileRoute } from "@tanstack/react-router";
import { holds } from "@/lib/mes-data";
import { StatusPill } from "@/components/status-pill";
import { ShieldCheck, ShieldAlert, ShieldX } from "lucide-react";

export const Route = createFileRoute("/quality")({
  head: () => ({
    meta: [
      { title: "Quality Holds · Cortanex MES" },
      { name: "description", content: "In-process quality holds raised on the shop floor — proxied to the QMS for formal disposition." },
    ],
  }),
  component: Quality,
});

function Quality() {
  const open = holds.filter(h => h.status === "open");
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight">Quality Holds</h1>
        <p className="text-sm text-muted-foreground">Authoritative record lives in QMS · this view shows in-process holds raised on the line</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Kpi label="Open holds" value={open.length} tone="destructive" icon={ShieldAlert} />
        <Kpi label="Released today" value={holds.filter(h => h.status === "released").length} tone="success" icon={ShieldCheck} />
        <Kpi label="Rejected today" value={holds.filter(h => h.status === "rejected").length} tone="warning" icon={ShieldX} />
      </div>

      <div className="space-y-3">
        {holds.map((h) => {
          const tone = h.status === "open" ? "border-destructive/40 bg-destructive/5" : h.status === "released" ? "border-success/30 bg-success/5" : "border-border/60 bg-card/40";
          return (
            <div key={h.id} className={`glass-panel rounded-2xl border p-5 ${tone}`}>
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="font-mono">{h.id}</span>
                    <span>·</span>
                    <span className="font-mono">{h.lotId}</span>
                    <span>·</span>
                    <span className="font-mono">{h.workOrderId}</span>
                  </div>
                  <h3 className="mt-1 text-base font-semibold">{h.reason}</h3>
                  <p className="text-xs text-muted-foreground">Raised by {h.raisedBy} at {h.raisedAt} on {h.lineId}</p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusPill status={h.severity} />
                  <StatusPill status={h.status} />
                </div>
              </div>
              {h.status === "open" && (
                <div className="mt-4 flex flex-wrap gap-2">
                  <button className="rounded-lg bg-gradient-to-br from-success to-info px-3 py-1.5 text-xs font-medium text-primary-foreground">Release lot</button>
                  <button className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-1.5 text-xs font-medium text-destructive">Reject / scrap</button>
                  <button className="rounded-lg border border-border/60 bg-card/60 px-3 py-1.5 text-xs">Open in QMS</button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Kpi({ label, value, tone, icon: Icon }: { label: string; value: number; tone: "destructive" | "success" | "warning"; icon: React.ComponentType<{ className?: string }> }) {
  const m = { destructive: "text-destructive", success: "text-success", warning: "text-warning" } as const;
  return (
    <div className="glass-panel rounded-2xl p-4">
      <div className="flex items-center justify-between">
        <span className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">{label}</span>
        <Icon className={`h-4 w-4 ${m[tone]}`} />
      </div>
      <div className={`mt-2 font-mono text-3xl font-semibold ${m[tone]}`}>{value}</div>
    </div>
  );
}
