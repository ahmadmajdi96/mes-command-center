import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMes } from "@/lib/mes-store";
import type { AuditAction, AuditEntity, AuditEntry } from "@/lib/mes-data";
import {
  Activity, Search, Factory, Cpu, User as UserIcon, ClipboardList,
  ShieldAlert, AlertOctagon, GitBranch, ListChecks, UsersRound,
  Download, Printer, X, LayoutList, GitMerge, Building2,
} from "lucide-react";

import { toast } from "sonner";

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

const actionFilters: { value: AuditAction | "all"; label: string }[] = [
  { value: "all", label: "any" },
  { value: "create", label: "create" },
  { value: "update", label: "update" },
  { value: "delete", label: "delete" },
  { value: "activate", label: "activate" },
  { value: "deactivate", label: "deactivate" },
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

function csvEscape(v: unknown): string {
  const s = v == null ? "" : String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function downloadCsv(rows: AuditEntry[], stationOf: Map<string, string | undefined>) {
  const headers = [
    "id", "timestamp_iso", "date", "time", "entity", "entity_id",
    "related_line", "action", "actor_id", "actor_name", "summary",
    "before_json", "after_json",
  ];
  const lines = [headers.join(",")];
  for (const e of rows) {
    const t = fmt(e.at);
    lines.push([
      e.id, e.at, t.date, t.time, e.entity, e.entityId,
      stationOf.get(e.id) ?? "",
      e.action, e.actorId, e.actorName, e.summary,
      e.before ? JSON.stringify(e.before) : "",
      e.after ? JSON.stringify(e.after) : "",
    ].map(csvEscape).join(","));
  }
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `traceability-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function TraceabilityPage() {
  const store = useMes();
  const [q, setQ] = useState("");
  const [entity, setEntity] = useState<AuditEntity | "all">("all");
  const [plant, setPlant] = useState<string | "all">("all");
  const [lineId, setLineId] = useState<string | "all">("all");
  const [stationId, setStationId] = useState<string | "all">("all");
  const [woId, setWoId] = useState<string | "all">("all");
  const [actorId, setActorId] = useState<string | "all">("all");
  const [action, setAction] = useState<AuditAction | "all">("all");
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");
  const [mode, setMode] = useState<"chronological" | "by_wo">("chronological");
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const lineToPlant = useMemo(() => {
    const m = new Map<string, string>();
    for (const l of store.lines) m.set(l.id, l.plant);
    return m;
  }, [store.lines]);

  const plants = useMemo(() => {
    const s = new Set<string>();
    for (const l of store.lines) s.add(l.plant);
    return [...s].sort();
  }, [store.lines]);


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

  // Resolve the "related line" for each audit entry — used for filtering, CSV, and grouping.
  const relatedLineForEntry = (e: AuditEntry): string | undefined => {
    if (e.entity === "line") return e.entityId;
    if (e.entity === "station") return stationToLine.get(e.entityId);
    if (e.entity === "work_order") return woToLine.get(e.entityId);
    if (e.entity === "downtime") {
      const dt = store.downtime.find((d) => d.id === e.entityId);
      return dt?.lineId ?? (dt?.stationId ? stationToLine.get(dt.stationId) : undefined);
    }
    if (e.entity === "assignment") {
      const t = (e.after as any)?.targetId ?? (e.before as any)?.targetId;
      if (t) return stationToLine.get(t);
    }
    return undefined;
  };

  const relatedStationForEntry = (e: AuditEntry): string | undefined => {
    if (e.entity === "station") return e.entityId;
    if (e.entity === "downtime") return store.downtime.find((d) => d.id === e.entityId)?.stationId;
    if (e.entity === "assignment") {
      const t = (e.after as any)?.targetId ?? (e.before as any)?.targetId;
      const tType = (e.after as any)?.targetType ?? (e.before as any)?.targetType;
      if (tType === "station") return t;
    }
    return undefined;
  };

  const relatedWorkOrderForEntry = (e: AuditEntry): string | undefined => {
    if (e.entity === "work_order") return e.entityId;
    if (e.entity === "downtime") return store.downtime.find((d) => d.id === e.entityId)?.workOrderId;
    if (e.entity === "hold") return store.holds.find((h) => h.id === e.entityId)?.workOrderId;
    if (e.entity === "genealogy") return store.genealogy.find((g) => g.id === e.entityId)?.workOrderId;
    const afterWo = (e.after as any)?.workOrderId ?? (e.before as any)?.workOrderId;
    if (typeof afterWo === "string") return afterWo;
    return undefined;
  };

  const filtered = useMemo(() => {
    const fromMs = from ? new Date(from).getTime() : -Infinity;
    const toMs = to ? new Date(to).getTime() : Infinity;
    return store.audit.filter((e) => {
      if (entity !== "all" && e.entity !== entity) return false;
      if (action !== "all" && e.action !== action) return false;
      if (actorId !== "all" && e.actorId !== actorId) return false;

      const ts = new Date(e.at).getTime();
      if (!isNaN(ts)) {
        if (ts < fromMs || ts > toMs) return false;
      }

      const rLine = relatedLineForEntry(e);
      if (plant !== "all") {
        const p = rLine ? lineToPlant.get(rLine) : undefined;
        if (p !== plant) return false;
      }
      if (lineId !== "all") {
        if (rLine !== lineId) return false;
      }
      if (stationId !== "all") {
        if (relatedStationForEntry(e) !== stationId) return false;
      }
      if (woId !== "all") {
        if (relatedWorkOrderForEntry(e) !== woId) return false;
      }

      if (!q) return true;
      const s = q.toLowerCase();
      return e.summary.toLowerCase().includes(s)
        || e.actorName.toLowerCase().includes(s)
        || e.entityId.toLowerCase().includes(s)
        || e.id.toLowerCase().includes(s);
    });
  }, [store.audit, store.downtime, store.holds, store.genealogy, entity, action, actorId, plant, lineId, stationId, woId, q, from, to, stationToLine, woToLine, lineToPlant]);

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

  const woGroups = useMemo(() => {
    const map = new Map<string, AuditEntry[]>();
    for (const e of filtered) {
      const key = relatedWorkOrderForEntry(e) ?? "__no_wo__";
      const arr = map.get(key) ?? [];
      arr.push(e);
      map.set(key, arr);
    }
    // Sort each group oldest → newest so a WO reads as a story;
    // sort WO buckets by their latest activity, newest bucket first.
    const entries = [...map.entries()].map(([k, arr]) => {
      const sorted = [...arr].sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
      return [k, sorted] as [string, AuditEntry[]];
    });
    entries.sort((a, b) => {
      const la = new Date(a[1][a[1].length - 1].at).getTime();
      const lb = new Date(b[1][b[1].length - 1].at).getTime();
      return lb - la;
    });
    return entries;
  }, [filtered]);

  const relatedLineIndex = useMemo(() => {
    const m = new Map<string, string | undefined>();
    for (const e of filtered) m.set(e.id, relatedLineForEntry(e));
    return m;
  }, [filtered]);

  const clearAll = () => {
    setQ(""); setEntity("all"); setPlant("all"); setLineId("all"); setStationId("all");
    setWoId("all"); setActorId("all"); setAction("all"); setFrom(""); setTo("");
  };

  const stationOptions = useMemo(() => {
    return store.stations
      .filter((s) => lineId === "all" || s.lineId === lineId)
      .sort((a, b) => a.id.localeCompare(b.id));
  }, [store.stations, lineId]);

  const lineOptions = useMemo(() => {
    return store.lines.filter((l) => plant === "all" || l.plant === plant);
  }, [store.lines, plant]);

  const woOptions = useMemo(() => {
    return store.workOrders
      .filter((w) => lineId === "all" || w.lineId === lineId)
      .filter((w) => plant === "all" || lineToPlant.get(w.lineId) === plant);
  }, [store.workOrders, lineId, plant, lineToPlant]);

  const activeFilterCount =
    (q ? 1 : 0) + (entity !== "all" ? 1 : 0) + (plant !== "all" ? 1 : 0)
    + (lineId !== "all" ? 1 : 0) + (stationId !== "all" ? 1 : 0)
    + (woId !== "all" ? 1 : 0) + (actorId !== "all" ? 1 : 0)
    + (action !== "all" ? 1 : 0) + (from ? 1 : 0) + (to ? 1 : 0);


  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3 print:hidden">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Traceability</h1>
          <p className="text-sm text-muted-foreground">
            Full chronological record of every action across all production lines and stations —
            exact date &amp; time, entity involved, and the operator or engineer responsible.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => {
              if (filtered.length === 0) { toast.error("Nothing to export"); return; }
              downloadCsv(filtered, relatedLineIndex);
              toast.success(`Exported ${filtered.length} events to CSV`);
            }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20"
          >
            <Download className="h-3.5 w-3.5" /> Export CSV
          </button>
          <button
            onClick={() => { toast.info("Opening print / PDF dialog…"); setTimeout(() => window.print(), 50); }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-info/40 bg-info/10 px-3 py-1.5 text-xs font-medium text-info hover:bg-info/20"
          >
            <Printer className="h-3.5 w-3.5" /> Export PDF (print)
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="glass-panel rounded-2xl p-4 print:hidden">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <div className="relative sm:col-span-2 lg:col-span-2">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search summary, actor, ID…"
              className="w-full rounded-lg border border-border/60 bg-background/40 py-1.5 pl-8 pr-3 text-xs outline-none focus:border-primary/60"
            />
          </div>

          <FilterSelect label="Line" value={lineId} onChange={(v) => { setLineId(v); setStationId("all"); }} options={[
            { value: "all", label: "All lines" },
            ...store.lines.map((l) => ({ value: l.id, label: `${l.id} · ${l.name}` })),
          ]} />

          <FilterSelect label="Station" value={stationId} onChange={setStationId} options={[
            { value: "all", label: "All stations" },
            ...stationOptions.map((s) => ({ value: s.id, label: `${s.id} · ${s.name}` })),
          ]} />

          <FilterSelect label="Actor (operator / engineer)" value={actorId} onChange={setActorId} options={[
            { value: "all", label: "Anyone" },
            ...store.users.map((u) => ({ value: u.id, label: `${u.name} · ${u.role.replace("_", " ")}` })),
          ]} />

          <FilterSelect label="Action" value={action} onChange={(v) => setAction(v as AuditAction | "all")} options={actionFilters.map(a => ({ value: a.value, label: a.label }))} />

          <div>
            <div className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">From</div>
            <input
              type="datetime-local"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="w-full rounded-lg border border-border/60 bg-background/40 px-2 py-1.5 text-xs"
            />
          </div>
          <div>
            <div className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">To</div>
            <input
              type="datetime-local"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="w-full rounded-lg border border-border/60 bg-background/40 px-2 py-1.5 text-xs"
            />
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-1.5">
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
          <div className="ml-auto flex items-center gap-2 font-mono text-[10px] text-muted-foreground">
            {activeFilterCount > 0 && (
              <button
                onClick={clearAll}
                className="inline-flex items-center gap-1 rounded border border-border/60 bg-card/60 px-2 py-0.5 text-[10px] hover:text-foreground"
              >
                <X className="h-3 w-3" /> Clear {activeFilterCount}
              </button>
            )}
            <span>{filtered.length} of {store.audit.length} events</span>
          </div>
        </div>
      </div>

      {/* Print-only header */}
      <div className="hidden print:block">
        <h1 className="text-xl font-semibold">Cortanex MES · Traceability report</h1>
        <p className="text-xs text-muted-foreground">
          Generated {mounted ? new Date().toLocaleString() : "—"} · {filtered.length} events
          {lineId !== "all" && ` · Line ${lineId}`}
          {stationId !== "all" && ` · Station ${stationId}`}
          {actorId !== "all" && ` · Actor ${actorId}`}
        </p>
      </div>

      {/* Timeline */}
      {filtered.length === 0 ? (
        <div className="glass-panel rounded-2xl p-10 text-center text-sm text-muted-foreground">
          <Activity className="mx-auto mb-2 h-5 w-5" />
          No traceable events match the current filter yet.
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
                <div className="absolute left-1 top-1 bottom-1 w-px bg-border/50 print:hidden" />
                {items.map((e) => {
                  const t = fmt(e.at);
                  const link = entityLinkFor(e);
                  return (
                    <li key={e.id} className="relative">
                      <span className="absolute -left-3 top-3 grid h-2 w-2 place-items-center rounded-full bg-primary shadow-[0_0_0_3px_hsl(var(--background))] print:hidden" />
                      <div className="glass-panel rounded-xl p-3 print:rounded-none print:border-b print:border-t-0 print:border-l-0 print:border-r-0 print:p-2 print:shadow-none print:bg-transparent">
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
                          <div className="grid h-5 w-5 place-items-center rounded-full bg-gradient-to-br from-primary to-info text-[9px] font-bold text-primary-foreground print:hidden">
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

function FilterSelect({
  label, value, onChange, options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div>
      <div className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-border/60 bg-background/40 px-2 py-1.5 text-xs"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}
