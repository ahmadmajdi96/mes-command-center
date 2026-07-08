import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMes } from "@/lib/mes-store";
import type { AuditEntity, AuditEntry } from "@/lib/mes-data";
import {
  Activity, Search, Factory, Cpu, User as UserIcon, ClipboardList,
  ShieldAlert, AlertOctagon, GitBranch, ListChecks, UsersRound,
} from "lucide-react";

export const Route = createFileRoute("/traceability")({
  head: () => ({
    meta: [
      { title: "Traceability · Cortanex MES" },
      { name: "description", content: "Full chronological trace of every action across production lines and stations — who, what, when." },
    ],
  }),
  component: TraceabilityPage,
});

const entityFilters: { value: AuditEntity | "all"; label: string }[] = [
  { value: "all", label: "All activity" },
  { value: "line", label: "Lines" },
  { value: "station", label: "Stations" },
  { value: "assignment", label: "Assignments" },
  { value: "user", label: "Users" },
  { value: "work_order", label: "Work orders" },
  { value: "step", label: "Steps" },
  { value: "step_template", label: "Step templates" },
  { value: "downtime", label: "Downtime" },
  { value: "hold", label: "Quality holds" },
  { value: "genealogy", label: "Genealogy" },
];

const entityIcon: Record<AuditEntity, React.ReactNode> = {
  line: <Factory className="h-3.5 w-3.5" />,
  station: <Cpu className="h-3.5 w-3.5" />,
  user: <UserIcon className="h-3.5 w-3.5" />,
  team: <UsersRound className="h-3.5 w-3.5" />,
  assignment: <UsersRound className="h-3.5 w-3.5" />,
  work_order: <ClipboardList className="h-3.5 w-3.5" />,
  step: <ListChecks className="h-3.5 w-3.5" />,
  step_template: <ListChecks className="h-3.5 w-3.5" />,
  downtime: <AlertOctagon className="h-3.5 w-3.5" />,
  hold: <ShieldAlert className="h-3.5 w-3.5" />,
  genealogy: <GitBranch className="h-3.5 w-3.5" />,
};

const actionTone: Record<string, string> = {
  create: "border-success/40 bg-success/10 text-success",
  update: "border-info/40 bg-info/10 text-info",
  delete: "border-destructive/40 bg-destructive/10 text-destructive",
  activate: "border-primary/40 bg-primary/10 text-primary",
  deactivate: "border-warning/40 bg-warning/10 text-warning",
};

function fmt(iso: string) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return { date: iso, time: "" };
  return {
    date: d.toLocaleDateString([], { year: "numeric", month: "short", day: "2-digit" }),
    time: d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
  };
}

function entityLinkFor(e: AuditEntry): { to: string; params?: any } | null {
  switch (e.entity) {
    case "line": return { to: "/lines/$lineId", params: { lineId: e.entityId } };
    case "station": return { to: "/stations/$stationId", params: { stationId: e.entityId } };
    case "user": return { to: "/users/$userId", params: { userId: e.entityId } };
    case "work_order": return { to: "/work-orders/$woId", params: { woId: e.entityId } };
    case "assignment": return { to: "/assignments" };
    case "downtime": return { to: "/downtime" };
    case "hold": return { to: "/quality" };
    case "genealogy": return { to: "/genealogy" };
    case "step_template": return { to: "/step-templates" };
    default: return null;
  }
}

function TraceabilityPage() {
  const store = useMes();
  const [q, setQ] = useState("");
  const [entity, setEntity] = useState<AuditEntity | "all">("all");
  const [lineId, setLineId] = useState<string | "all">("all");

  const stationToLine = useMemo(() => {
    const m = new Map<string, string>();
    for (const s of store.stations) m.set(s.id, s.lineId);
    return m;
  }, [store.stations]);

  const woToLine = useMemo(() => {
    const m = new Map<string, string>();
    for (const w of store.workOrders) m.set(w.id, w.lineId);
    return m;
  }, [store.workOrders]);

  const filtered = useMemo(() => {
    return store.audit.filter((e) => {
      if (entity !== "all" && e.entity !== entity) return false;
      if (lineId !== "all") {
        let related: string | undefined;
        if (e.entity === "line") related = e.entityId;
        else if (e.entity === "station") related = stationToLine.get(e.entityId);
        else if (e.entity === "work_order") related = woToLine.get(e.entityId);
        else if (e.entity === "downtime") {
          const dt = store.downtime.find((d) => d.id === e.entityId);
          related = dt?.lineId ?? (dt?.stationId ? stationToLine.get(dt.stationId) : undefined);
        }
        if (related !== lineId) return false;
      }
      if (!q) return true;
      const s = q.toLowerCase();
      return e.summary.toLowerCase().includes(s)
        || e.actorName.toLowerCase().includes(s)
        || e.entityId.toLowerCase().includes(s)
        || e.id.toLowerCase().includes(s);
    });
  }, [store.audit, store.downtime, entity, lineId, q, stationToLine, woToLine]);

  // Group by day
  const groups = useMemo(() => {
    const map = new Map<string, AuditEntry[]>();
    for (const e of filtered) {
      const key = fmt(e.at).date;
      const arr = map.get(key) ?? [];
      arr.push(e);
      map.set(key, arr);
    }
    return [...map.entries()];
  }, [filtered]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight">Traceability</h1>
        <p className="text-sm text-muted-foreground">
          Full chronological record of every action across all production lines and stations —
          exact date &amp; time, entity involved, and the operator or engineer responsible.
        </p>
      </div>

      {/* Filters */}
      <div className="glass-panel rounded-2xl p-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search action, actor, entity ID…"
              className="w-full rounded-lg border border-border/60 bg-background/40 py-1.5 pl-8 pr-3 text-xs outline-none focus:border-primary/60"
            />
          </div>
          <select
            value={lineId}
            onChange={(e) => setLineId(e.target.value as any)}
            className="rounded-lg border border-border/60 bg-background/40 px-2 py-1.5 text-xs"
          >
            <option value="all">All lines</option>
            {store.lines.map((l) => (
              <option key={l.id} value={l.id}>{l.id} · {l.name}</option>
            ))}
          </select>
          <span className="ml-auto font-mono text-[10px] text-muted-foreground">
            {filtered.length} of {store.audit.length} events
          </span>
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {entityFilters.map((f) => (
            <button
              key={f.value}
              onClick={() => setEntity(f.value)}
              className={`rounded-full border px-3 py-1 text-xs capitalize transition ${
                entity === f.value
                  ? "border-primary/60 bg-primary/10 text-primary"
                  : "border-border/60 bg-card/60 text-muted-foreground hover:text-foreground"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Timeline */}
      {filtered.length === 0 ? (
        <div className="glass-panel rounded-2xl p-10 text-center text-sm text-muted-foreground">
          <Activity className="mx-auto mb-2 h-5 w-5" />
          No traceable events match the current filter yet. Perform any action across the system —
          creating a work order, assigning an operator, logging downtime — and it will appear here instantly.
        </div>
      ) : (
        <div className="space-y-6">
          {groups.map(([day, items]) => (
            <div key={day}>
              <div className="mb-2 flex items-center gap-2">
                <div className="h-px flex-1 bg-border/40" />
                <span className="rounded-full border border-border/60 bg-card/60 px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  {day} · {items.length} events
                </span>
                <div className="h-px flex-1 bg-border/40" />
              </div>
              <ol className="relative space-y-2 pl-4">
                <div className="absolute left-1 top-1 bottom-1 w-px bg-border/50" />
                {items.map((e) => {
                  const t = fmt(e.at);
                  const link = entityLinkFor(e);
                  return (
                    <li key={e.id} className="relative">
                      <span className="absolute -left-3 top-3 grid h-2 w-2 place-items-center rounded-full bg-primary shadow-[0_0_0_3px_hsl(var(--background))]" />
                      <div className="glass-panel rounded-xl p-3">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] uppercase tracking-wider ${actionTone[e.action] ?? ""}`}>
                              {e.action}
                            </span>
                            <span className="inline-flex items-center gap-1 rounded border border-border/60 bg-card/60 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                              {entityIcon[e.entity]} {e.entity.replace("_", " ")}
                            </span>
                            {link ? (
                              <Link {...(link as any)} className="font-mono text-[11px] text-primary hover:underline">
                                {e.entityId}
                              </Link>
                            ) : (
                              <span className="font-mono text-[11px] text-muted-foreground">{e.entityId}</span>
                            )}
                          </div>
                          <div className="text-right">
                            <div className="font-mono text-xs">{t.time}</div>
                            <div className="font-mono text-[10px] text-muted-foreground">{t.date}</div>
                          </div>
                        </div>
                        <p className="mt-1.5 text-sm">{e.summary}</p>
                        <div className="mt-1.5 flex items-center gap-1.5 text-[11px]">
                          <div className="grid h-5 w-5 place-items-center rounded-full bg-gradient-to-br from-primary to-info text-[9px] font-bold text-primary-foreground">
                            {e.actorName.split(" ").map((p) => p[0]).join("").slice(0, 2)}
                          </div>
                          <Link to="/users/$userId" params={{ userId: e.actorId }} className="text-muted-foreground hover:text-foreground">
                            by <span className="font-medium text-foreground">{e.actorName}</span>
                            <span className="ml-1 font-mono text-[10px] text-muted-foreground">{e.actorId}</span>
                          </Link>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
