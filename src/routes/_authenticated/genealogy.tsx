import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMes } from "@/lib/mes-store";
import type { GenealogyRecord } from "@/lib/mes-data";
import { GitBranch, Package, ArrowRight, Search, Plus, Pencil } from "lucide-react";
import { EntityFormDialog, type Field } from "@/components/crud/entity-form-dialog";
import { ConfirmDelete } from "@/components/crud/confirm-delete";

export const Route = createFileRoute("/_authenticated/genealogy")({
  head: () => ({
    meta: [
      { title: "Genealogy · Cortanex MES" },
      { name: "description", content: "Record, edit and trace input lot consumption against output lots — streamed to the Traceability system." },
    ],
  }),
  component: Genealogy,
});

function genFields(workOrders: { id: string }[]): Field[] {
  return [
    { name: "workOrderId", label: "Work Order", type: "select", options: workOrders.map(w => ({ value: w.id, label: w.id })), required: true },
    { name: "recordedAt", label: "Recorded at", type: "text", placeholder: "08:14", required: true },
    { name: "outputLotId", label: "Output Lot", type: "text", placeholder: "LOT-XXX-00001", required: true, span: 2 },
    { name: "inputLotId", label: "Input Lot", type: "text", placeholder: "LOT-RAW-00001", required: true },
    { name: "material", label: "Material", type: "text", required: true },
    { name: "supplier", label: "Supplier", type: "text", required: true, span: 2 },
    { name: "qtyConsumed", label: "Qty Consumed", type: "number", required: true },
    { name: "uom", label: "Unit", type: "select", options: [{ value: "kg", label: "kg" }, { value: "g", label: "g" }, { value: "L", label: "L" }, { value: "ea", label: "each" }], required: true },
  ];
}

function Genealogy() {
  const store = useMes();
  const [q, setQ] = useState("");
  const grouped = store.genealogy.reduce<Record<string, GenealogyRecord[]>>((acc, g) => {
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
        <div className="flex gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search lot, material…"
              className="h-9 w-60 rounded-lg border border-border/60 bg-card/60 pl-8 pr-3 text-sm focus:border-primary/50 focus:outline-none"
            />
          </div>
          <EntityFormDialog<Omit<GenealogyRecord, "id">>
            title="Record Lot Consumption"
            fields={genFields(store.workOrders)}
            initial={{ uom: "kg", recordedAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) } as any}
            onSubmit={(v) => store.createGenealogy(v)}
            trigger={
              <button className="flex items-center gap-1.5 rounded-lg bg-gradient-to-br from-primary to-info px-3 py-1.5 text-xs font-medium text-primary-foreground shadow-[var(--shadow-glow)]">
                <Plus className="h-3.5 w-3.5" /> Record
              </button>
            }
          />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Kpi label="Output lots" value={Object.keys(grouped).length} />
        <Kpi label="Input lots consumed" value={store.genealogy.length} />
        <Kpi label="Linked work orders" value={new Set(store.genealogy.map(g => g.workOrderId)).size} />
      </div>

      <div className="space-y-4">
        {filtered.length === 0 && (
          <div className="glass-panel rounded-2xl p-8 text-center text-sm text-muted-foreground">No records match your search.</div>
        )}
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
                <div key={g.id} className="grid grid-cols-[auto_minmax(0,1fr)_auto_auto_auto] items-center gap-3 rounded-xl border border-border/40 bg-card/30 p-3 text-xs">
                  <Package className="h-4 w-4 text-accent" />
                  <div className="min-w-0">
                    <div className="truncate font-medium">{g.material}</div>
                    <div className="font-mono text-[10px] text-muted-foreground">{g.inputLotId} · {g.supplier}</div>
                  </div>
                  <span className="font-mono">{g.qtyConsumed} {g.uom}</span>
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                  <div className="flex gap-1">
                    <EntityFormDialog<GenealogyRecord>
                      title="Edit Genealogy Record"
                      fields={genFields(store.workOrders)}
                      initial={g}
                      onSubmit={(v) => store.updateGenealogy(g.id, v)}
                      trigger={
                        <button className="grid h-7 w-7 place-items-center rounded-md border border-border/60 bg-card/60 text-muted-foreground hover:text-primary">
                          <Pencil className="h-3 w-3" />
                        </button>
                      }
                    />
                    <ConfirmDelete label={`Delete ${g.id}`} onConfirm={() => store.deleteGenealogy(g.id)} />
                  </div>
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
