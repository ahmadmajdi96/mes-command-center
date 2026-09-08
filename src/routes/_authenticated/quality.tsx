import { createFileRoute } from "@tanstack/react-router";
import { useMes } from "@/lib/mes-store";
import type { QualityHold } from "@/lib/mes-data";
import { StatusPill } from "@/components/status-pill";
import { ShieldCheck, ShieldAlert, ShieldX, Plus, Pencil } from "lucide-react";
import { EntityFormDialog, type Field } from "@/components/crud/entity-form-dialog";
import { ConfirmDelete } from "@/components/crud/confirm-delete";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/quality")({
  head: () => ({
    meta: [
      { title: "Quality Holds · Cortanex MES" },
      { name: "description", content: "Raise, edit, release or reject in-process quality holds — proxied to QMS for formal disposition." },
    ],
  }),
  component: Quality,
});

function holdFields(workOrders: { id: string }[], lines: { id: string; name: string }[]): Field[] {
  return [
    { name: "lotId", label: "Lot ID", type: "text", placeholder: "LOT-XXX-00000", required: true, span: 2 },
    { name: "workOrderId", label: "Work Order", type: "select", options: workOrders.map(w => ({ value: w.id, label: w.id })), required: true },
    { name: "lineId", label: "Line", type: "select", options: lines.map(l => ({ value: l.id, label: `${l.id} · ${l.name}` })), required: true },
    { name: "reason", label: "Reason", type: "textarea", required: true, span: 2 },
    { name: "raisedBy", label: "Raised by", type: "text", required: true },
    { name: "raisedAt", label: "Time", type: "text", placeholder: "08:50", required: true },
    { name: "severity", label: "Severity", type: "select", required: true, options: [{ value: "low", label: "low" }, { value: "medium", label: "medium" }, { value: "high", label: "high" }] },
    { name: "status", label: "Status", type: "select", required: true, options: [{ value: "open", label: "open" }, { value: "released", label: "released" }, { value: "rejected", label: "rejected" }] },
  ];
}

function Quality() {
  const store = useMes();
  const holds = store.holds;
  const open = holds.filter(h => h.status === "open");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Quality Holds</h1>
          <p className="text-sm text-muted-foreground">Authoritative record lives in QMS · in-process holds raised on the line</p>
        </div>
        <EntityFormDialog<Omit<QualityHold, "id">>
          title="Raise Quality Hold"
          fields={holdFields(store.workOrders, store.lines)}
          initial={{ status: "open", severity: "medium", raisedAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) } as any}
          onSubmit={(v) => store.createHold(v)}
          trigger={
            <button className="flex items-center gap-1.5 rounded-lg bg-gradient-to-br from-destructive to-warning px-3 py-1.5 text-xs font-medium text-destructive-foreground shadow-[var(--shadow-glow)]">
              <Plus className="h-3.5 w-3.5" /> Raise Hold
            </button>
          }
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Kpi label="Open holds" value={open.length} tone="destructive" icon={ShieldAlert} />
        <Kpi label="Released today" value={holds.filter(h => h.status === "released").length} tone="success" icon={ShieldCheck} />
        <Kpi label="Rejected today" value={holds.filter(h => h.status === "rejected").length} tone="warning" icon={ShieldX} />
      </div>

      <div className="space-y-3">
        {holds.length === 0 && (
          <div className="glass-panel rounded-2xl p-8 text-center text-sm text-muted-foreground">
            No quality holds. The line is clear.
          </div>
        )}
        {holds.map((h) => {
          const tone = h.status === "open" ? "border-destructive/40 bg-destructive/5" : h.status === "released" ? "border-success/30 bg-success/5" : "border-border/60 bg-card/40";
          return (
            <div key={h.id} className={`glass-panel rounded-2xl border p-5 ${tone}`}>
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
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
              <div className="mt-4 flex flex-wrap gap-2">
                {h.status === "open" && (
                  <>
                    <button
                      onClick={() => { store.updateHold(h.id, { status: "released" }); toast.success(`${h.lotId} released`); }}
                      className="rounded-lg bg-gradient-to-br from-success to-info px-3 py-1.5 text-xs font-medium text-primary-foreground"
                    >Release lot</button>
                    <button
                      onClick={() => { store.updateHold(h.id, { status: "rejected" }); toast.success(`${h.lotId} rejected`); }}
                      className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-1.5 text-xs font-medium text-destructive"
                    >Reject / scrap</button>
                  </>
                )}
                <EntityFormDialog<QualityHold>
                  title="Edit Quality Hold"
                  fields={holdFields(store.workOrders, store.lines)}
                  initial={h}
                  onSubmit={(v) => store.updateHold(h.id, v)}
                  trigger={
                    <button className="flex items-center gap-1.5 rounded-lg border border-border/60 bg-card/60 px-3 py-1.5 text-xs">
                      <Pencil className="h-3 w-3" /> Edit
                    </button>
                  }
                />
                <ConfirmDelete
                  label={`Delete ${h.id}`}
                  onConfirm={() => store.deleteHold(h.id)}
                  trigger={
                    <button className="rounded-lg border border-border/60 bg-card/60 px-3 py-1.5 text-xs text-muted-foreground hover:text-destructive">
                      Delete
                    </button>
                  }
                />
              </div>
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
