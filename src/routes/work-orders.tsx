import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMes } from "@/lib/mes-store";
import type { WorkOrder, WOStatus } from "@/lib/mes-data";
import { StatusPill } from "@/components/status-pill";
import { Plus, Filter, Pencil } from "lucide-react";
import { EntityFormDialog, type Field } from "@/components/crud/entity-form-dialog";
import { ConfirmDelete } from "@/components/crud/confirm-delete";

export const Route = createFileRoute("/work-orders")({
  head: () => ({
    meta: [
      { title: "Work Orders · Cortanex MES" },
      { name: "description", content: "Create, schedule, edit and complete shop-floor work orders synced with ERP production orders." },
    ],
  }),
  component: WorkOrdersPage,
});

const filters: (WOStatus | "all")[] = ["all", "running", "scheduled", "hold", "paused", "completed"];

function woFields(lines: { id: string; name: string }[]): Field[] {
  return [
    { name: "productionOrderId", label: "ERP Production Order", type: "text", placeholder: "PO-99820", required: true },
    { name: "lineId", label: "Line", type: "select", options: lines.map((l) => ({ value: l.id, label: `${l.id} · ${l.name}` })), required: true },
    { name: "product", label: "Product", type: "text", placeholder: "Granola Bar 60g", required: true, span: 2 },
    { name: "sku", label: "SKU", type: "text", placeholder: "GRA-060", required: true },
    { name: "uom", label: "Unit", type: "select", options: [{ value: "ea", label: "each" }, { value: "kg", label: "kg" }, { value: "L", label: "L" }, { value: "btl", label: "bottle" }, { value: "ctn", label: "carton" }, { value: "jar", label: "jar" }], required: true },
    { name: "qtyTarget", label: "Target Qty", type: "number", required: true },
    { name: "qtyProduced", label: "Produced Qty", type: "number" },
    { name: "startedAt", label: "Start", type: "text", placeholder: "06:00" },
    { name: "endsAt", label: "End", type: "text", placeholder: "14:00" },
    { name: "operator", label: "Operator", type: "text" },
    { name: "shift", label: "Shift", type: "select", options: [{ value: "A", label: "A" }, { value: "B", label: "B" }, { value: "C", label: "C" }] },
    { name: "status", label: "Status", type: "select", options: filters.filter(f => f !== "all").map(s => ({ value: s, label: s })), required: true, span: 2 },
  ];
}

function WorkOrdersPage() {
  const store = useMes();
  const [f, setF] = useState<WOStatus | "all">("all");
  const list = f === "all" ? store.workOrders : store.workOrders.filter((w) => w.status === f);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Work Orders</h1>
          <p className="text-sm text-muted-foreground">{store.workOrders.length} orders · synced with ERP production orders</p>
        </div>
        <div className="flex gap-2">
          <button className="flex items-center gap-1.5 rounded-lg border border-border/60 bg-card/60 px-3 py-1.5 text-xs">
            <Filter className="h-3.5 w-3.5" /> Shift A
          </button>
          <EntityFormDialog<Omit<WorkOrder, "id" | "progress" | "qtyProduced"> & { qtyProduced?: number }>
            title="New Work Order"
            description="Create a new shop-floor work order linked to an ERP production order."
            fields={woFields(store.lines)}
            initial={{ status: "scheduled", shift: "A", uom: "ea" } as any}
            onSubmit={(v) => store.createWorkOrder(v as any)}
            trigger={
              <button className="flex items-center gap-1.5 rounded-lg bg-gradient-to-br from-primary to-info px-3 py-1.5 text-xs font-medium text-primary-foreground shadow-[var(--shadow-glow)]">
                <Plus className="h-3.5 w-3.5" /> New WO
              </button>
            }
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {filters.map((s) => (
          <button
            key={s}
            onClick={() => setF(s)}
            className={`rounded-full border px-3 py-1 text-xs capitalize transition ${
              f === s ? "border-primary/60 bg-primary/10 text-primary" : "border-border/60 bg-card/60 text-muted-foreground hover:text-foreground"
            }`}
          >
            {s} {s !== "all" && <span className="ml-1 font-mono opacity-60">{store.workOrders.filter(w => w.status === s).length}</span>}
          </button>
        ))}
      </div>

      <div className="glass-panel overflow-hidden rounded-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-card/60 text-[11px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Work Order</th>
                <th className="px-4 py-3 text-left font-medium">Product</th>
                <th className="px-4 py-3 text-left font-medium">Line</th>
                <th className="px-4 py-3 text-left font-medium">Shift</th>
                <th className="px-4 py-3 text-left font-medium">Window</th>
                <th className="px-4 py-3 text-left font-medium">Operator</th>
                <th className="px-4 py-3 text-left font-medium">Progress</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {list.map((w) => (
                <tr key={w.id} className="border-t border-border/40 hover:bg-card/40">
                  <td className="px-4 py-3">
                    <div className="font-mono text-xs">{w.id}</div>
                    <div className="text-[10px] text-muted-foreground">{w.productionOrderId}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium">{w.product}</div>
                    <div className="text-[10px] text-muted-foreground">{w.sku}</div>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">{w.lineId}</td>
                  <td className="px-4 py-3 text-xs">{w.shift}</td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{w.startedAt} → {w.endsAt}</td>
                  <td className="px-4 py-3 text-xs">{w.operator}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-28 overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full bg-gradient-to-r from-primary to-info" style={{ width: `${w.progress}%` }} />
                      </div>
                      <span className="font-mono text-[11px]">{w.progress}%</span>
                    </div>
                    <div className="mt-1 font-mono text-[10px] text-muted-foreground">{w.qtyProduced.toLocaleString()} / {w.qtyTarget.toLocaleString()} {w.uom}</div>
                  </td>
                  <td className="px-4 py-3"><StatusPill status={w.status} /></td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1.5">
                      <EntityFormDialog<WorkOrder>
                        title="Edit Work Order"
                        fields={woFields(store.lines)}
                        initial={w}
                        onSubmit={(v) => store.updateWorkOrder(w.id, v)}
                        trigger={
                          <button className="grid h-8 w-8 place-items-center rounded-lg border border-border/60 bg-card/60 text-muted-foreground hover:text-primary hover:border-primary/40">
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                        }
                      />
                      <ConfirmDelete
                        label={`Delete ${w.id}`}
                        description="The work order and its progress will be removed."
                        onConfirm={() => store.deleteWorkOrder(w.id)}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
