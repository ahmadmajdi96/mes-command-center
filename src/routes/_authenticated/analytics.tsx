import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { z } from "zod";
import { ArrowLeft, Download } from "lucide-react";
import { Bar, CartesianGrid, Cell, ComposedChart, Line as RLine, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis, BarChart, Legend } from "recharts";
import { useMes } from "@/lib/mes-store";
import { DashFilterBar } from "@/components/dash-filters";
import { StatusPill } from "@/components/status-pill";
import { PAGE_SIZES, exportRows } from "@/components/list-controls";
import { allDowntime, CATEGORY_COLOR, CATEGORY_LABEL, paretoOf, reasonPareto, scope, useDashFilters, type ShiftCode } from "@/lib/dashboard-metrics";
import { buildAndon, readingSources, useReadings } from "@/lib/dash-feeds";

const VIEWS = { andon: "Andon Feed", pareto: "Downtime Pareto", stoppage: "Stoppage Mix", temperature: "Temperature & Machine Values" } as const;
type View = keyof typeof VIEWS;

export const Route = createFileRoute("/_authenticated/analytics")({
  validateSearch: z.object({ view: z.enum(["andon", "pareto", "stoppage", "temperature"]).catch("pareto") }),
  head: () => ({
    meta: [
      { title: "Plant Analytics · Cortanex MES" },
      { name: "description", content: "Detailed andon, downtime Pareto, stoppage mix and temperature data filtered by plant, shift and interval." },
      { property: "og:title", content: "Plant Analytics · Cortanex MES" },
      { property: "og:description", content: "Drill-down views behind the Control Center widgets." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Analytics,
});

const tt = { background: "oklch(0.16 0.02 240 / 0.95)", border: "1px solid oklch(0.3 0.02 245)", borderRadius: 8, fontSize: 12 };

function usePaged<T>(rows: T[]) {
  const [size, setSize] = useState<number>(50);
  const [page, setPage] = useState(0);
  const pages = Math.max(1, Math.ceil(rows.length / size));
  const p = Math.min(page, pages - 1);
  const slice = rows.slice(p * size, p * size + size);
  const pager = (
    <div className="flex items-center justify-between gap-2 border-t border-border/40 px-4 py-2 text-xs text-muted-foreground">
      <span>{rows.length.toLocaleString()} records</span>
      <div className="flex items-center gap-2">
        <select aria-label="Rows per page" className="rounded border border-border/60 bg-card/60 px-1.5 py-0.5" value={size} onChange={(e) => { setSize(Number(e.target.value)); setPage(0); }}>
          {PAGE_SIZES.map((n) => <option key={n} value={n}>{n} / page</option>)}
        </select>
        <button disabled={p === 0} onClick={() => setPage(p - 1)} className="rounded border border-border/60 px-2 py-0.5 disabled:opacity-40">Prev</button>
        <span>{p + 1} / {pages}</span>
        <button disabled={p >= pages - 1} onClick={() => setPage(p + 1)} className="rounded border border-border/60 px-2 py-0.5 disabled:opacity-40">Next</button>
      </div>
    </div>
  );
  return { slice, pager };
}

function ExportBtns({ rows, name }: { rows: Record<string, unknown>[]; name: string }) {
  return (
    <div className="flex gap-1.5">
      {(["csv", "xls"] as const).map((k) => (
        <button key={k} onClick={() => exportRows(rows, name, k)} className="flex items-center gap-1 rounded-lg border border-border/60 bg-card/60 px-2.5 py-1 text-xs hover:border-primary/50"><Download className="h-3 w-3" />{k.toUpperCase()}</button>
      ))}
    </div>
  );
}

function Analytics() {
  const { view } = Route.useSearch();
  const store = useMes();
  const [f, set] = useDashFilters();
  const [q, setQ] = useState("");
  const dtAll = useMemo(() => allDowntime(store.downtime, store.audit, store.lines), [store.downtime, store.audit, store.lines]);
  const s = scope(f, { lines: store.lines, stations: store.stations, downtime: dtAll });
  const dt = s.downtime.filter((d) => !q || `${d.id} ${d.reason} ${d.lineName} ${d.stationId ?? ""} ${d.operatorName ?? ""}`.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link to="/" className="grid h-9 w-9 place-items-center rounded-lg border border-border/60 bg-card/60 hover:border-primary/50" aria-label="Back to Control Center"><ArrowLeft className="h-4 w-4" /></Link>
          <div>
            <h1 className="font-display text-2xl font-semibold tracking-tight">{VIEWS[view as View]}</h1>
            <p className="text-sm text-muted-foreground">{s.lines.length} lines · {s.iv.label}</p>
          </div>
        </div>
        <DashFilterBar f={f} set={set} showLine />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1 rounded-lg border border-border/60 bg-card/40 p-1">
          {(Object.keys(VIEWS) as View[]).map((v) => (
            <Link key={v} to="/analytics" search={{ view: v }} className={`rounded-md px-3 py-1 text-xs ${v === view ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground"}`}>{VIEWS[v]}</Link>
          ))}
        </div>
        {view !== "temperature" && <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search reason, line, station, operator…" className="w-64 rounded-lg border border-border/60 bg-card/60 px-3 py-1.5 text-xs outline-none focus:border-primary/60" />}
      </div>
      {view === "andon" && <AndonView dt={dt} lineIds={new Set(s.lines.map((l) => l.id))} q={q} />}
      {view === "pareto" && <ParetoView dt={dt} />}
      {view === "stoppage" && <StoppageView dt={dt} />}
      {view === "temperature" && <TempView since={s.since} />}
    </div>
  );
}

function AndonView({ dt, lineIds, q }: { dt: ReturnType<typeof allDowntime>; lineIds: Set<string>; q: string }) {
  const store = useMes();
  const [level, setLevel] = useState("all");
  const all = buildAndon(dt, store.holds, store.stations.filter((x) => lineIds.has(x.lineId)), lineIds)
    .filter((a) => (level === "all" || a.level === level) && (!q || `${a.source} ${a.message}`.toLowerCase().includes(q.toLowerCase())));
  const { slice, pager } = usePaged(all);
  const rows = all.map((a) => ({ id: a.id, level: a.level, source: a.source, message: a.message, at: a.at.toISOString() }));
  return (
    <div className="glass-panel overflow-hidden rounded-2xl">
      <div className="flex items-center justify-between gap-2 p-4">
        <div className="flex gap-1.5 text-xs">
          {["all", "critical", "warn", "info"].map((l) => <button key={l} onClick={() => setLevel(l)} className={`rounded-full border px-2.5 py-0.5 ${level === l ? "border-primary/50 text-primary" : "border-border/60 text-muted-foreground"}`}>{l} ({l === "all" ? all.length : all.filter((a) => a.level === l).length})</button>)}
        </div>
        <ExportBtns rows={rows} name="andon-feed" />
      </div>
      <table className="w-full text-sm">
        <thead className="bg-card/60 text-[11px] uppercase tracking-wider text-muted-foreground"><tr><th className="px-4 py-2 text-left">Level</th><th className="px-4 py-2 text-left">Source</th><th className="px-4 py-2 text-left">Message</th><th className="px-4 py-2 text-left">Time</th><th className="px-4 py-2 text-right">Open</th></tr></thead>
        <tbody>
          {slice.map((a) => (
            <tr key={a.id} className="border-t border-border/40 hover:bg-card/40">
              <td className="px-4 py-2"><StatusPill status={a.level} /></td>
              <td className="px-4 py-2 font-mono text-xs">{a.source}</td>
              <td className="px-4 py-2 text-xs">{a.message}</td>
              <td className="px-4 py-2 font-mono text-xs text-muted-foreground">{a.at.toLocaleString()}</td>
              <td className="px-4 py-2 text-right text-xs">
                {a.link.kind === "station" ? <Link to="/stations/$stationId" params={{ stationId: a.link.id }} className="text-primary hover:underline">Station →</Link>
                  : a.link.kind === "hold" ? <Link to="/quality" className="text-primary hover:underline">Hold →</Link>
                  : <Link to="/lines/$lineId" params={{ lineId: a.lineId }} className="text-primary hover:underline">Line →</Link>}
              </td>
            </tr>
          ))}
          {slice.length === 0 && <tr><td colSpan={5} className="px-4 py-6 text-center text-xs text-muted-foreground">No alerts.</td></tr>}
        </tbody>
      </table>
      {pager}
    </div>
  );
}

function DtTable({ dt, name }: { dt: ReturnType<typeof allDowntime>; name: string }) {
  const { slice, pager } = usePaged(dt);
  const rows = dt.map((d) => ({ id: d.id, at: d.at.toISOString(), shift: d.shift, line: d.lineId, station: d.stationId ?? "", reason: d.reason, category: CATEGORY_LABEL[d.category] ?? d.category, minutes: d.durationMin, status: d.status, operator: d.operatorName ?? "" }));
  return (
    <div className="glass-panel overflow-hidden rounded-2xl">
      <div className="flex items-center justify-between p-4"><h3 className="text-sm font-semibold">Events</h3><ExportBtns rows={rows} name={name} /></div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-card/60 text-[11px] uppercase tracking-wider text-muted-foreground"><tr>{["Event", "Time", "Shift", "Line", "Station", "Reason", "Category", "Min", "Operator", "Status"].map((h) => <th key={h} className="px-3 py-2 text-left font-medium">{h}</th>)}</tr></thead>
          <tbody>
            {slice.map((d) => (
              <tr key={d.id} className="border-t border-border/40 hover:bg-card/40">
                <td className="px-3 py-2 font-mono text-xs">{d.id}</td>
                <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{d.at.toLocaleString([], { dateStyle: "short", timeStyle: "short" })}</td>
                <td className="px-3 py-2 text-xs">{d.shift}</td>
                <td className="px-3 py-2 text-xs"><Link to="/lines/$lineId" params={{ lineId: d.lineId }} className="text-primary hover:underline">{d.lineId}</Link></td>
                <td className="px-3 py-2 text-xs">{d.stationId ? <Link to="/stations/$stationId" params={{ stationId: d.stationId }} className="text-primary hover:underline">{d.stationId}</Link> : "—"}</td>
                <td className="px-3 py-2 text-xs">{d.reason}</td>
                <td className="px-3 py-2 text-xs"><span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: CATEGORY_COLOR[d.category] }} />{CATEGORY_LABEL[d.category] ?? d.category}</span></td>
                <td className="px-3 py-2 font-mono text-xs">{d.durationMin}</td>
                <td className="px-3 py-2 text-xs text-muted-foreground">{d.operatorName ?? "—"}</td>
                <td className="px-3 py-2"><StatusPill status={d.status} /></td>
              </tr>
            ))}
            {slice.length === 0 && <tr><td colSpan={10} className="px-4 py-6 text-center text-xs text-muted-foreground">No downtime in this scope.</td></tr>}
          </tbody>
        </table>
      </div>
      {pager}
    </div>
  );
}

function ParetoView({ dt }: { dt: ReturnType<typeof allDowntime> }) {
  const reasons = reasonPareto(dt).slice(0, 15);
  const cats = paretoOf(dt);
  const total = cats.reduce((a, c) => a + c.minutes, 0);
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-4">
        <Stat k="Events" v={dt.length} /><Stat k="Downtime" v={`${total} min`} /><Stat k="Avg / event" v={`${dt.length ? Math.round(total / dt.length) : 0} min`} /><Stat k="Open" v={dt.filter((d) => d.status === "open").length} />
      </div>
      <div className="glass-panel rounded-2xl p-5">
        <h3 className="mb-2 text-sm font-semibold">Pareto by reason (top 15) — bars: minutes, line: cumulative %</h3>
        <div className="h-80">
          <ResponsiveContainer>
            <ComposedChart data={reasons}>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.3 0.02 245 / 0.4)" />
              <XAxis dataKey="reason" stroke="oklch(0.68 0.02 245)" fontSize={10} interval={0} angle={-25} textAnchor="end" height={60} />
              <YAxis yAxisId="l" stroke="oklch(0.68 0.02 245)" fontSize={10} />
              <YAxis yAxisId="r" orientation="right" domain={[0, 100]} stroke="oklch(0.68 0.02 245)" fontSize={10} />
              <Tooltip contentStyle={tt} />
              <Bar yAxisId="l" dataKey="minutes" radius={[6, 6, 0, 0]}>{reasons.map((r, i) => <Cell key={i} fill={CATEGORY_COLOR[r.category] ?? "var(--color-primary)"} />)}</Bar>
              <RLine yAxisId="r" type="monotone" dataKey="cumPct" stroke="var(--color-accent)" strokeWidth={2} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>
      <DtTable dt={dt} name="downtime-pareto" />
    </>
  );
}

function StoppageView({ dt }: { dt: ReturnType<typeof allDowntime> }) {
  const store = useMes();
  const cats = paretoOf(dt);
  const byLine = store.lines.map((l) => {
    const row: Record<string, number | string> = { line: l.id };
    for (const c of cats) row[c.category] = dt.filter((d) => d.lineId === l.id && d.category === c.category).reduce((a, d) => a + d.durationMin, 0);
    return row;
  }).filter((r) => cats.some((c) => Number(r[c.category]) > 0));
  const byShift = (["A", "B", "C"] as ShiftCode[]).map((sh) => {
    const row: Record<string, number | string> = { shift: `Shift ${sh}` };
    for (const c of cats) row[c.category] = dt.filter((d) => d.shift === sh && d.category === c.category).reduce((a, d) => a + d.durationMin, 0);
    return row;
  });
  return (
    <>
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="glass-panel rounded-2xl p-5">
          <h3 className="text-sm font-semibold">Share of minutes</h3>
          <div className="h-60"><ResponsiveContainer><PieChart><Pie data={cats} dataKey="minutes" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={2}>{cats.map((c, i) => <Cell key={i} fill={c.color} />)}</Pie><Tooltip contentStyle={tt} /></PieChart></ResponsiveContainer></div>
          <div className="space-y-1 text-[11px]">{cats.map((c) => <div key={c.category} className="flex justify-between"><span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full" style={{ background: c.color }} />{c.name}</span><span className="font-mono text-muted-foreground">{c.pct}% · {c.count} ev · {c.minutes}m</span></div>)}</div>
        </div>
        {[{ t: "By line", data: byLine, k: "line" }, { t: "By shift", data: byShift, k: "shift" }].map((g) => (
          <div key={g.t} className="glass-panel rounded-2xl p-5">
            <h3 className="text-sm font-semibold">{g.t} (minutes)</h3>
            <div className="h-72"><ResponsiveContainer><BarChart data={g.data}><CartesianGrid strokeDasharray="3 3" stroke="oklch(0.3 0.02 245 / 0.4)" /><XAxis dataKey={g.k} stroke="oklch(0.68 0.02 245)" fontSize={10} /><YAxis stroke="oklch(0.68 0.02 245)" fontSize={10} /><Tooltip contentStyle={tt} /><Legend wrapperStyle={{ fontSize: 10 }} />{cats.map((c) => <Bar key={c.category} dataKey={c.category} name={c.name} stackId="a" fill={c.color} />)}</BarChart></ResponsiveContainer></div>
          </div>
        ))}
      </div>
      <DtTable dt={dt} name="stoppage-mix" />
    </>
  );
}

function TempView({ since }: { since: number }) {
  const { data = [], isLoading } = useReadings(since);
  const sources = readingSources(data);
  const [key, setKey] = useState("");
  const [onlyOut, setOnlyOut] = useState(false);
  const cur = sources.find((x) => x.key === key) ?? sources[0];
  const rowsAll = data.filter((r) => (!cur || `${r.machine_id}|${r.tag}` === cur.key) && (!onlyOut || r.in_limits === false)).slice().reverse();
  const vals = rowsAll.map((r) => Number(r.value)).filter((v) => isFinite(v));
  const series = rowsAll.slice().reverse().map((r) => ({ t: new Date(r.created_at).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }), v: Number(r.value) }));
  const { slice, pager } = usePaged(rowsAll);
  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <select aria-label="Sensor" className="rounded-lg border border-border/60 bg-card/60 px-2.5 py-1.5 text-xs" value={cur?.key ?? ""} onChange={(e) => setKey(e.target.value)}>
          {sources.length === 0 && <option value="">No sensors</option>}
          {sources.map((x) => <option key={x.key} value={x.key}>{x.machine} · {x.tag}{x.unit ? ` (${x.unit})` : ""} — {x.count}</option>)}
        </select>
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground"><input type="checkbox" checked={onlyOut} onChange={(e) => setOnlyOut(e.target.checked)} /> Only out-of-limit</label>
        <div className="ml-auto"><ExportBtns rows={rowsAll.map((r) => ({ time: r.created_at, machine: r.machine_id, station: r.station_id ?? "", tag: r.tag, value: r.value, unit: r.unit ?? "", in_limits: r.in_limits }))} name="machine-readings" /></div>
      </div>
      <div className="grid gap-3 sm:grid-cols-4">
        <Stat k="Readings" v={vals.length} /><Stat k="Min" v={vals.length ? Math.min(...vals) : "—"} /><Stat k="Avg" v={vals.length ? (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2) : "—"} /><Stat k="Max" v={vals.length ? Math.max(...vals) : "—"} />
      </div>
      <div className="glass-panel rounded-2xl p-5">
        <div className="h-72">
          {isLoading ? <p className="text-xs text-muted-foreground">Loading…</p> : series.length === 0 ? <p className="grid h-full place-items-center text-xs text-muted-foreground">No readings in this interval. Record values on the <Link to="/machines" className="text-primary hover:underline">Machines</Link> page.</p> : (
            <ResponsiveContainer><LineChart data={series}><CartesianGrid strokeDasharray="3 3" stroke="oklch(0.3 0.02 245 / 0.4)" /><XAxis dataKey="t" stroke="oklch(0.68 0.02 245)" fontSize={10} /><YAxis stroke="oklch(0.68 0.02 245)" fontSize={10} domain={["auto", "auto"]} /><Tooltip contentStyle={tt} /><RLine type="monotone" dataKey="v" stroke="var(--color-primary)" strokeWidth={2} dot={false} /></LineChart></ResponsiveContainer>
          )}
        </div>
      </div>
      <div className="glass-panel overflow-hidden rounded-2xl">
        <table className="w-full text-sm">
          <thead className="bg-card/60 text-[11px] uppercase tracking-wider text-muted-foreground"><tr>{["Time", "Machine", "Station", "Tag", "Value", "Limits"].map((h) => <th key={h} className="px-3 py-2 text-left font-medium">{h}</th>)}</tr></thead>
          <tbody>
            {slice.map((r) => (
              <tr key={r.id} className="border-t border-border/40 hover:bg-card/40">
                <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString()}</td>
                <td className="px-3 py-2 text-xs"><Link to="/machines/$machineId" params={{ machineId: r.machine_id }} className="text-primary hover:underline">{r.machine_id}</Link></td>
                <td className="px-3 py-2 text-xs">{r.station_id ?? "—"}</td>
                <td className="px-3 py-2 text-xs">{r.tag}</td>
                <td className="px-3 py-2 font-mono text-xs">{r.value}{r.unit ?? ""}</td>
                <td className="px-3 py-2 text-xs">{r.in_limits === false ? <span className="text-destructive">Outside</span> : r.in_limits ? <span className="text-success">OK</span> : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {pager}
      </div>
    </>
  );
}

function Stat({ k, v }: { k: string; v: string | number }) {
  return <div className="glass-panel rounded-2xl p-4"><div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">{k}</div><div className="mt-1 font-mono text-2xl font-semibold">{v}</div></div>;
}
