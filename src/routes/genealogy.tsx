import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { genealogy } from "@/lib/mes-data";
import { GitBranch, Package, ArrowRight, Search } from "lucide-react";

export const Route = createFileRoute("/genealogy")({
  head: () => ({
    meta: [
      { title: "Genealogy · Cortanex MES" },
      { name: "description", content: "Forward and backward lot traceability — every input lot consumed into every output lot." },
    ],
  }),
  component: Genealogy,
});

function Genealogy() {
  const [q, setQ] = useState("");
  const grouped = genealogy.reduce<Record<string, typeof genealogy>>((acc, g) => {
    (acc[g.outputLotId] ??= []).push(g);
    return acc;
  }, {});
  const filtered = Object.entries(grouped).filter(([k, items]) =>
    !q || k.toLowerCase().includes(q.toLowerCase()) || items.some(i => i.inputLotId.toLowerCase().includes(q.toLowerCase()) || i.material.toLowerCase().includes(q.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Genealogy</h1>
          <p className="text-sm text-muted-foreground">Lot consumption records streamed to the Traceability system</p>
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search lot, material…"
            className="h-9 w-72 rounded-lg border border-border/60 bg-card/60 pl-8 pr-3 text-sm focus:border-primary/50 focus:outline-none"
          />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Kpi label="Output lots today" value={Object.keys(grouped).length} />
        <Kpi label="Input lots consumed" value={genealogy.length} />
        <Kpi label="Linked work orders" value={new Set(genealogy.map(g => g.workOrderId)).size} />
      </div>

      <div className="space-y-4">
        {filtered.map(([outLot, items]) => (
          <div key={outLot} className="glass-panel rounded-2xl p-5">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <GitBranch className="h-3.5 w-3.5" />
                  <span>Output lot</span>
                </div>
                <h3 className="mt-1 truncate font-mono text-base font-semibold text-primary">{outLot}</h3>
                <p className="text-xs text-muted-foreground">WO {items[0].workOrderId} · {items.length} input lots</p>
              </div>
              <button className="rounded-lg border border-border/60 bg-card/60 px-3 py-1.5 text-xs">Forward trace →</button>
            </div>

            <div className="mt-4 space-y-2">
              {items.map((g) => (
                <div key={g.id} className="grid grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-3 rounded-xl border border-border/40 bg-card/30 p-3 text-xs">
                  <Package className="h-4 w-4 text-accent" />
                  <div className="min-w-0">
                    <div className="truncate font-medium">{g.material}</div>
                    <div className="font-mono text-[10px] text-muted-foreground">{g.inputLotId} · {g.supplier}</div>
                  </div>
                  <span className="font-mono">{g.qtyConsumed} {g.uom}</span>
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="glass-panel rounded-2xl p-4">
      <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">{label}</div>
      <div className="mt-2 font-mono text-3xl font-semibold">{value}</div>
    </div>
  );
}
