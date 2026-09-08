import { createFileRoute } from "@tanstack/react-router";
import { Boxes, Factory, Users, Package } from "lucide-react";

export const Route = createFileRoute("/_authenticated/master-data")({
  head: () => ({ meta: [{ title: "Master Data · Cortanex MES" }, { name: "description", content: "Canonical items, plants, lines and suppliers consumed from the suite-wide Master Data service." }] }),
  component: MasterData,
});

const tiles = [
  { icon: Package, name: "Materials & SKUs", count: 1284, hint: "Items, BOMs, allergens" },
  { icon: Factory, name: "Plants & Lines", count: 24, hint: "6 plants · 24 lines" },
  { icon: Users, name: "Suppliers", count: 156, hint: "Approved · audited" },
  { icon: Boxes, name: "Recipes & SOPs", count: 412, hint: "Versioned · effective-dated" },
];

function MasterData() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight">Master Data</h1>
        <p className="text-sm text-muted-foreground">Read-only mirror of the suite-wide Master Data Service</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map((t) => (
          <div key={t.name} className="glass-panel rounded-2xl p-5">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-primary/20 to-info/10 text-primary">
              <t.icon className="h-5 w-5" />
            </div>
            <div className="mt-4 font-mono text-3xl font-semibold">{t.count}</div>
            <div className="text-sm font-medium">{t.name}</div>
            <div className="text-xs text-muted-foreground">{t.hint}</div>
          </div>
        ))}
      </div>
      <div className="glass-panel rounded-2xl p-5">
        <h3 className="text-sm font-semibold">Integration Points</h3>
        <ul className="mt-3 space-y-2 text-sm">
          {[
            ["ERP", "Bi-directional", "Production orders/BOM in; completions and consumption out"],
            ["QMS", "Bi-directional", "CCP specs in; hold/release decisions out"],
            ["CMMS", "Outbound", "Equipment_failure downtime auto-creates work orders"],
            ["Traceability", "Outbound", "Genealogy stream for forward/backward trace"],
            ["PLC / SCADA", "Inbound", "OPC-UA / MQTT telemetry via edge gateway"],
          ].map(([sys, dir, desc]) => (
            <li key={sys} className="grid grid-cols-[120px_120px_1fr] items-center gap-3 rounded-xl border border-border/40 bg-card/30 p-3 text-xs">
              <span className="font-semibold">{sys}</span>
              <span className="rounded-full border border-border/60 bg-card/60 px-2 py-0.5 text-center text-[10px] uppercase tracking-wider text-muted-foreground">{dir}</span>
              <span className="text-muted-foreground">{desc}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
