import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { workOrders, type WOStatus } from "@/lib/mes-data";
import { StatusPill } from "@/components/status-pill";
import { Plus, Filter } from "lucide-react";

export const Route = createFileRoute("/work-orders")({
  head: () => ({
    meta: [
      { title: "Work Orders · Cortanex MES" },
      { name: "description", content: "Scheduled, running and completed shop-floor work orders across all production lines." },
    ],
  }),
  component: WorkOrdersPage,
});

const filters: (WOStatus | "all")[] = ["all", "running", "scheduled", "hold", "paused", "completed"];

function WorkOrdersPage() {
  const [f, setF] = useState<WOStatus | "all">("all");
  const list = f === "all" ? workOrders : workOrders.filter((w) => w.status === f);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Work Orders</h1>
          <p className="text-sm text-muted-foreground">{workOrders.length} orders · synced with ERP production orders</p>
        </div>
        <div className="flex gap-2">
          <button className="flex items-center gap-1.5 rounded-lg border border-border/60 bg-card/60 px-3 py-1.5 text-xs">
            <Filter className="h-3.5 w-3.5" /> Shift A
          </button>
          <button className="flex items-center gap-1.5 rounded-lg bg-gradient-to-br from-primary to-info px-3 py-1.5 text-xs font-medium text-primary-foreground shadow-[var(--shadow-glow)]">
            <Plus className="h-3.5 w-3.5" /> New WO
          </button>
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
            {s}
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
