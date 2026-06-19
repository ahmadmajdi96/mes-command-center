import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMes } from "@/lib/mes-store";
import type { AuditEntity, AuditEntry } from "@/lib/mes-data";
import { History, Search, Filter, ChevronDown } from "lucide-react";

export const Route = createFileRoute("/audit")({
  head: () => ({
    meta: [
      { title: "Audit Log · Cortanex MES" },
      { name: "description", content: "Who changed what, when — before/after diffs across all entities." },
    ],
  }),
  component: AuditPage,
});

const entities: (AuditEntity | "all")[] = [
  "all", "line", "station", "user", "team", "assignment",
  "work_order", "downtime", "hold", "genealogy", "step", "step_template",
];

const actionColor: Record<string, string> = {
  create: "border-success/40 bg-success/10 text-success",
  update: "border-info/40 bg-info/10 text-info",
  delete: "border-destructive/40 bg-destructive/10 text-destructive",
  activate: "border-primary/40 bg-primary/10 text-primary",
  deactivate: "border-warning/40 bg-warning/10 text-warning",
};

function fmtTime(iso: string) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString([], { dateStyle: "short", timeStyle: "medium" });
}

function fmtValue(v: any): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  try { return JSON.stringify(v); } catch { return String(v); }
}

function AuditPage() {
  const store = useMes();
  const [q, setQ] = useState("");
  const [entity, setEntity] = useState<typeof entities[number]>("all");
  const [openId, setOpenId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return store.audit.filter((e) => {
      if (entity !== "all" && e.entity !== entity) return false;
      if (!q) return true;
      const s = q.toLowerCase();
      return e.summary.toLowerCase().includes(s)
        || e.actorName.toLowerCase().includes(s)
        || e.entityId.toLowerCase().includes(s)
        || e.id.toLowerCase().includes(s);
    });
  }, [store.audit, q, entity]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Audit Log</h1>
          <p className="text-sm text-muted-foreground">
            {store.audit.length} entries · capped to 500 most recent · acting as <span className="text-foreground">{store.currentActor.name}</span>
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="glass-panel flex flex-wrap items-center gap-3 rounded-2xl p-3">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by actor, entity ID, summary…"
            className="h-9 w-full rounded-lg border border-border/60 bg-card/60 pl-8 pr-3 text-sm focus:border-primary/50 focus:outline-none"
          />
        </div>
        <div className="flex items-center gap-1.5">
          <Filter className="h-3.5 w-3.5 text-muted-foreground" />
          <select
            value={entity}
            onChange={(e) => setEntity(e.target.value as any)}
            className="h-9 rounded-md border border-border/60 bg-card/60 px-2 text-xs"
          >
            {entities.map((e) => (
              <option key={e} value={e}>{e === "all" ? "All entities" : e.replace("_", " ")}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Timeline */}
      <div className="glass-panel overflow-hidden rounded-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-card/60 text-[10px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left">When</th>
                <th className="px-4 py-3 text-left">Actor</th>
                <th className="px-4 py-3 text-left">Action</th>
                <th className="px-4 py-3 text-left">Entity</th>
                <th className="px-4 py-3 text-left">Summary</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-12 text-center text-sm text-muted-foreground">
                  <History className="mx-auto mb-2 h-5 w-5" /> No audit entries match.
                </td></tr>
              )}
              {filtered.map((e) => {
                const isOpen = openId === e.id;
                return (
                  <Row key={e.id} entry={e} open={isOpen} onToggle={() => setOpenId(isOpen ? null : e.id)} />
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Row({ entry: e, open, onToggle }: { entry: AuditEntry; open: boolean; onToggle: () => void }) {
  const keys = Array.from(new Set([
    ...Object.keys(e.before ?? {}),
    ...Object.keys(e.after ?? {}),
  ]));

  return (
    <>
      <tr className="cursor-pointer border-t border-border/40 hover:bg-card/40" onClick={onToggle}>
        <td className="whitespace-nowrap px-4 py-3 font-mono text-[11px] text-muted-foreground">{fmtTime(e.at)}</td>
        <td className="px-4 py-3 text-xs">
          <div className="font-medium">{e.actorName}</div>
          <div className="font-mono text-[10px] text-muted-foreground">{e.actorId}</div>
        </td>
        <td className="px-4 py-3">
          <span className={`inline-flex rounded-md border px-2 py-0.5 text-[10px] uppercase tracking-wider ${actionColor[e.action] ?? "border-border/60 text-muted-foreground"}`}>
            {e.action}
          </span>
        </td>
        <td className="px-4 py-3">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">{e.entity.replace("_", " ")}</div>
          <div className="font-mono text-[11px]">{e.entityId}</div>
        </td>
        <td className="px-4 py-3 text-xs">{e.summary}</td>
        <td className="px-4 py-3 text-right">
          <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
        </td>
      </tr>
      {open && (
        <tr className="border-t border-border/40 bg-background/40">
          <td colSpan={6} className="px-4 py-4">
            {keys.length === 0 ? (
              <div className="text-xs text-muted-foreground">No field-level diff captured for this event.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="px-2 py-1 text-left">Field</th>
                      <th className="px-2 py-1 text-left text-destructive">Before</th>
                      <th className="px-2 py-1 text-left text-success">After</th>
                    </tr>
                  </thead>
                  <tbody>
                    {keys.map((k) => (
                      <tr key={k} className="border-t border-border/30 align-top">
                        <td className="px-2 py-1 font-mono">{k}</td>
                        <td className="px-2 py-1">
                          <pre className="max-w-md whitespace-pre-wrap break-all rounded border border-destructive/20 bg-destructive/5 px-2 py-1 font-mono text-[11px] text-destructive/90">{fmtValue(e.before?.[k])}</pre>
                        </td>
                        <td className="px-2 py-1">
                          <pre className="max-w-md whitespace-pre-wrap break-all rounded border border-success/20 bg-success/5 px-2 py-1 font-mono text-[11px] text-success/90">{fmtValue(e.after?.[k])}</pre>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  );
}
