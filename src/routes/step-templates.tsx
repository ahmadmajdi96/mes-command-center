import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMes } from "@/lib/mes-store";
import type { StepTemplate } from "@/lib/mes-data";
import { EntityFormDialog, type Field } from "@/components/crud/entity-form-dialog";
import { ConfirmDelete } from "@/components/crud/confirm-delete";
import {
  Plus, Pencil, Search, ListChecks, ShieldAlert, Activity, RotateCcw, Droplets, FlaskConical,
  Cpu, Hand, Tag,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/step-templates")({
  head: () => ({
    meta: [
      { title: "Step Templates · Cortanex MES" },
      { name: "description", content: "Reusable step definitions with defaults, CCP rules and sensor bindings." },
    ],
  }),
  component: StepTemplatesPage,
});

const categoryStyles: Record<StepTemplate["category"], { label: string; cls: string; icon: any }> = {
  process:        { label: "Process",        cls: "border-info/40 bg-info/10 text-info",             icon: Activity },
  ccp:            { label: "CCP",            cls: "border-destructive/40 bg-destructive/10 text-destructive", icon: ShieldAlert },
  quality_check:  { label: "Quality check",  cls: "border-primary/40 bg-primary/10 text-primary",     icon: FlaskConical },
  changeover:     { label: "Changeover",     cls: "border-warning/40 bg-warning/10 text-warning",     icon: RotateCcw },
  cleaning:       { label: "Cleaning",       cls: "border-success/40 bg-success/10 text-success",     icon: Droplets },
};

const templateFields: Field[] = [
  { name: "id", label: "Template ID", type: "text", placeholder: "TPL-08", required: true },
  { name: "name", label: "Name", type: "text", required: true, span: 2 },
  { name: "category", label: "Category", type: "select", required: true, options: [
    { value: "process", label: "Process" },
    { value: "ccp", label: "Critical Control Point" },
    { value: "quality_check", label: "Quality check" },
    { value: "changeover", label: "Changeover" },
    { value: "cleaning", label: "Cleaning / CIP" },
  ]},
  { name: "appliesTo", label: "Applies to", type: "select", required: true, options: [
    { value: "automatic", label: "Automatic stations" },
    { value: "manual", label: "Manual stations" },
    { value: "both", label: "Both" },
  ]},
  { name: "defaultTarget", label: "Default target", type: "text", required: true, placeholder: "72°C" },
  { name: "defaultTolerance", label: "Default tolerance", type: "text", placeholder: "±0.5°C" },
  { name: "isCCP", label: "Critical Control Point", type: "select", required: true, options: [
    { value: "true", label: "Yes — CCP enforced" }, { value: "false", label: "No" },
  ]},
  { name: "holdOnFailure", label: "Auto-hold on failure", type: "select", required: true, options: [
    { value: "true", label: "Yes — raise quality hold" }, { value: "false", label: "No" },
  ]},
  { name: "sensorBindings", label: "Sensor bindings (comma-separated tags)", type: "textarea", span: 2,
    placeholder: "in_temp,out_temp,hold_time" },
  { name: "instruction", label: "Operator instruction", type: "textarea", required: true, span: 2,
    placeholder: "What the operator must do at this step…" },
];

function toForm(t: Partial<StepTemplate>) {
  return { ...t, isCCP: t.isCCP ? "true" : "false", holdOnFailure: t.holdOnFailure ? "true" : "false" } as any;
}
function fromForm(v: any): Omit<StepTemplate, "id"> & { id?: string } {
  return {
    id: v.id, name: v.name, category: v.category, appliesTo: v.appliesTo,
    defaultTarget: v.defaultTarget, defaultTolerance: v.defaultTolerance || "—",
    isCCP: v.isCCP === "true" || v.isCCP === true,
    holdOnFailure: v.holdOnFailure === "true" || v.holdOnFailure === true,
    sensorBindings: v.sensorBindings ?? "",
    instruction: v.instruction ?? "",
  };
}

function StepTemplatesPage() {
  const store = useMes();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<"all" | StepTemplate["category"]>("all");

  const filtered = useMemo(() => {
    return store.stepTemplates.filter((t) => {
      if (cat !== "all" && t.category !== cat) return false;
      if (!q) return true;
      const s = q.toLowerCase();
      return t.name.toLowerCase().includes(s)
        || t.id.toLowerCase().includes(s)
        || t.sensorBindings.toLowerCase().includes(s)
        || t.instruction.toLowerCase().includes(s);
    });
  }, [store.stepTemplates, q, cat]);

  const usageOf = (tplId: string) =>
    store.stations.filter((st) => st.templateIds?.includes(tplId));

  const ccpCount = store.stepTemplates.filter((t) => t.isCCP).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Step Templates</h1>
          <p className="text-sm text-muted-foreground">
            {store.stepTemplates.length} templates · {ccpCount} CCP · reusable on automatic & manual stations
          </p>
        </div>
        <EntityFormDialog<StepTemplate>
          title="New step template"
          fields={templateFields}
          initial={toForm({ category: "process", appliesTo: "automatic", isCCP: false, holdOnFailure: false, defaultTolerance: "—" })}
          onSubmit={(v) => store.createStepTemplate(fromForm(v) as any)}
          trigger={
            <button className="flex items-center gap-1.5 rounded-lg bg-gradient-to-br from-primary to-info px-3 py-1.5 text-xs font-medium text-primary-foreground shadow-[var(--shadow-glow)]">
              <Plus className="h-3.5 w-3.5" /> New template
            </button>
          }
        />
      </div>

      {/* Filters */}
      <div className="glass-panel flex flex-wrap items-center gap-3 rounded-2xl p-3">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name, ID, tag, instruction…"
            className="h-9 w-full rounded-lg border border-border/60 bg-card/60 pl-8 pr-3 text-sm focus:border-primary/50 focus:outline-none"
          />
        </div>
        <div className="flex flex-wrap gap-1">
          {(["all", "process", "ccp", "quality_check", "changeover", "cleaning"] as const).map((c) => (
            <button
              key={c}
              onClick={() => setCat(c)}
              className={`rounded-md border px-2.5 py-1 text-xs ${
                cat === c ? "border-primary/50 bg-primary/15 text-primary" : "border-border/60 bg-card/60 text-muted-foreground hover:text-foreground"
              }`}
            >
              {c === "all" ? "All" : categoryStyles[c as StepTemplate["category"]]?.label ?? c}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {filtered.map((t) => {
          const C = categoryStyles[t.category];
          const Icon = C.icon;
          const used = usageOf(t.id);
          const tags = t.sensorBindings.split(",").map((x) => x.trim()).filter(Boolean);
          return (
            <div key={t.id} className="glass-panel rounded-2xl p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-mono text-[11px] text-muted-foreground">{t.id}</div>
                  <h3 className="truncate font-semibold">{t.name}</h3>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <span className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] uppercase tracking-wider ${C.cls}`}>
                      <Icon className="h-3 w-3" /> {C.label}
                    </span>
                    {t.isCCP && (
                      <span className="inline-flex items-center gap-1 rounded-md border border-destructive/40 bg-destructive/10 px-2 py-0.5 text-[10px] uppercase tracking-wider text-destructive">
                        <ShieldAlert className="h-3 w-3" /> CCP
                      </span>
                    )}
                    {t.holdOnFailure && (
                      <span className="inline-flex items-center gap-1 rounded-md border border-warning/40 bg-warning/10 px-2 py-0.5 text-[10px] uppercase tracking-wider text-warning">
                        auto-hold
                      </span>
                    )}
                    <span className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] uppercase tracking-wider ${
                      t.appliesTo === "automatic" ? "border-primary/40 text-primary"
                      : t.appliesTo === "manual" ? "border-accent/40 text-accent"
                      : "border-border/60 text-muted-foreground"
                    }`}>
                      {t.appliesTo === "automatic" ? <Cpu className="h-3 w-3" /> : t.appliesTo === "manual" ? <Hand className="h-3 w-3" /> : <ListChecks className="h-3 w-3" />}
                      {t.appliesTo}
                    </span>
                  </div>
                </div>
              </div>

              <p className="mt-3 line-clamp-3 text-xs text-muted-foreground">{t.instruction}</p>

              <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
                <div className="rounded-md border border-border/40 bg-background/40 p-2">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Target</div>
                  <div className="font-mono">{t.defaultTarget}</div>
                </div>
                <div className="rounded-md border border-border/40 bg-background/40 p-2">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Tolerance</div>
                  <div className="font-mono">{t.defaultTolerance}</div>
                </div>
              </div>

              {tags.length > 0 && (
                <div className="mt-3 rounded-md border border-border/40 bg-background/40 p-2">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Sensor bindings</div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {tags.map((tag) => (
                      <span key={tag} className="inline-flex items-center gap-1 rounded border border-primary/30 bg-primary/5 px-1.5 py-0.5 font-mono text-[10px] text-primary">
                        <Tag className="h-2.5 w-2.5" /> {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-3 flex items-center justify-between">
                <div className="text-[11px] text-muted-foreground">
                  Used on <span className="font-mono text-foreground">{used.length}</span> station{used.length === 1 ? "" : "s"}
                </div>
                <div className="flex gap-1.5">
                  <EntityFormDialog<StepTemplate>
                    title={`Edit ${t.id}`}
                    fields={templateFields}
                    initial={toForm(t)}
                    onSubmit={(v) => store.updateStepTemplate(t.id, fromForm(v))}
                    trigger={
                      <button className="grid h-8 w-8 place-items-center rounded-lg border border-border/60 bg-card/60 text-muted-foreground hover:border-primary/40 hover:text-primary">
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                    }
                  />
                  <ConfirmDelete label={`Delete ${t.id}`} onConfirm={() => store.deleteStepTemplate(t.id)} />
                </div>
              </div>

              {/* Quick apply to a station */}
              <ApplyTo template={t} />
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="col-span-full grid place-items-center rounded-2xl border border-dashed border-border/60 p-10 text-sm text-muted-foreground">
            No templates match those filters.
          </div>
        )}
      </div>
    </div>
  );
}

function ApplyTo({ template }: { template: StepTemplate }) {
  const store = useMes();
  const [stationId, setStationId] = useState("");

  const eligible = store.stations.filter((s) =>
    template.appliesTo === "both" ? true : s.type === template.appliesTo,
  );

  return (
    <div className="mt-3 flex items-center gap-2 rounded-md border border-border/40 bg-background/40 p-2">
      <select
        value={stationId}
        onChange={(e) => setStationId(e.target.value)}
        className="h-8 min-w-0 flex-1 rounded-md border border-border/60 bg-card/60 px-2 text-[11px]"
      >
        <option value="">Apply to station…</option>
        {eligible.map((s) => (
          <option key={s.id} value={s.id}>{s.id} · {s.name} ({s.lineId})</option>
        ))}
      </select>
      <button
        disabled={!stationId}
        onClick={() => {
          store.applyTemplateToStation(stationId, template.id);
          toast.success(`Template "${template.name}" applied to ${stationId}`);
          setStationId("");
        }}
        className="rounded-md bg-primary/15 px-2 py-1 text-[11px] font-medium text-primary disabled:opacity-50"
      >
        Apply
      </button>
    </div>
  );
}
