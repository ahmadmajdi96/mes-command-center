import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrowLeft, ChevronLeft, ChevronRight, Plus, RotateCcw, Trash2, Users, AlertTriangle, Clock } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useMes } from "@/lib/mes-store";
import type { MesUser, UserRole } from "@/lib/mes-data";
import { dayKey, inShift, shiftHours, useShifts, type ShiftDef } from "@/lib/shifts-store";
import { allDowntime } from "@/lib/dashboard-metrics";
import { StatusPill } from "@/components/status-pill";
import { exportRows } from "@/components/list-controls";

export const Route = createFileRoute("/_authenticated/shifts")({
  head: () => ({
    meta: [
      { title: "Shift Management · Cortanex MES" },
      { name: "description", content: "Plan shifts and rosters, check staffing coverage by role, and see live crew and shift performance." },
      { property: "og:title", content: "Shift Management · Cortanex MES" },
      { property: "og:description", content: "Visual shift planner linked to users, roles, assignments and downtime." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ShiftsPage,
});

const ROLES: UserRole[] = ["operator", "team_lead", "supervisor"];
const ROLE_LABEL: Record<UserRole, string> = { operator: "Operator", team_lead: "Team lead", supervisor: "Supervisor" };
const tt = { background: "oklch(0.16 0.02 240 / 0.95)", border: "1px solid oklch(0.3 0.02 245)", borderRadius: 8, fontSize: 12 };
const hh = (h: number) => `${String(h).padStart(2, "0")}:00`;

function weekStart(d: Date) { const x = new Date(d); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() - x.getDay()); return x; }

function ShiftsPage() {
  const store = useMes();
  const sh = useShifts(store.users);
  const [anchor, setAnchor] = useState(() => weekStart(new Date()));
  const [role, setRole] = useState<"all" | UserRole>("all");
  const [team, setTeam] = useState("all");
  const [paint, setPaint] = useState<string>("cycle");
  const days = Array.from({ length: 7 }, (_, i) => { const d = new Date(anchor); d.setDate(d.getDate() + i); return d; });
  const today = dayKey(new Date());
  const hour = new Date().getHours();
  const current = sh.shifts.find((s) => inShift(s, hour));
  const codes = [...sh.shifts.map((s) => s.code), "OFF", "LEAVE"];
  const color = (c: string) => sh.shifts.find((s) => s.code === c)?.color;

  const people = store.users.filter((u) => u.status !== "inactive" && (role === "all" || u.role === role) &&
    (team === "all" || store.teams.find((t) => t.id === team && (t.leadId === u.id || t.memberIds.includes(u.id)))));

  const onCell = (u: MesUser, d: Date) => {
    const cur = sh.codeFor(u, d);
    const next = paint === "cycle" ? codes[(codes.indexOf(cur) + 1) % codes.length] : paint;
    sh.setCode(u.id, d, next);
  };

  // Coverage: for each day × shift, headcount by role vs minimum
  const coverage = days.map((d) => sh.shifts.map((s) => {
    const on = store.users.filter((u) => u.status !== "inactive" && sh.codeFor(u, d) === s.code);
    const byRole = Object.fromEntries(ROLES.map((r) => [r, on.filter((u) => u.role === r).length])) as Record<UserRole, number>;
    const gaps = ROLES.filter((r) => byRole[r] < (s.minStaff[r] ?? 0));
    return { d, s, total: on.length, byRole, gaps };
  }));
  const gapCount = coverage.flat().filter((c) => c.gaps.length).length;

  // Hourly headcount for today
  const todayDate = new Date();
  const hourly = Array.from({ length: 24 }, (_, h) => {
    const row: Record<string, number | string> = { h: hh(h) };
    for (const r of ROLES) row[r] = store.users.filter((u) => u.role === r && u.status !== "inactive" && sh.shifts.some((s) => s.code === sh.codeFor(u, todayDate) && inShift(s, h))).length;
    return row;
  });

  // Performance per shift (last 7 days) from downtime history + work orders
  const dt = useMemo(() => allDowntime(store.downtime, store.audit, store.lines), [store.downtime, store.audit, store.lines]);
  const since = Date.now() - 7 * 86400_000;
  const perf = sh.shifts.map((s) => {
    const ev = dt.filter((d) => d.at.getTime() >= since && inShift(s, d.at.getHours()));
    const wos = store.workOrders.filter((w) => w.shift === s.code);
    return { shift: `${s.code} · ${s.name}`, downtime: ev.reduce((a, d) => a + d.durationMin, 0), events: ev.length, wos: wos.length, output: wos.reduce((a, w) => a + w.qtyProduced, 0) };
  });

  const onNow = current ? store.users.filter((u) => sh.codeFor(u, todayDate) === current.code) : [];

  const exportRoster = () => exportRows(people.map((u) => ({ id: u.id, name: u.name, role: u.role, default_shift: u.shift, ...Object.fromEntries(days.map((d) => [dayKey(d), sh.codeFor(u, d)])) })), `roster-${dayKey(anchor)}`, "xls");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link to="/users" className="grid h-9 w-9 place-items-center rounded-lg border border-border/60 bg-card/60 hover:border-primary/50" aria-label="Back to users"><ArrowLeft className="h-4 w-4" /></Link>
          <div>
            <h1 className="font-display text-2xl font-semibold tracking-tight">Shift Management</h1>
            <p className="text-sm text-muted-foreground">{sh.shifts.length} shifts · {store.users.length} people · now: {current ? `${current.code} · ${current.name}` : "no shift"}</p>
          </div>
        </div>
        <div className="flex gap-2 text-xs">
          <Link to="/assignments" className="rounded-lg border border-border/60 bg-card/60 px-3 py-1.5 hover:border-primary/50">Station assignments →</Link>
          <Link to="/access" className="rounded-lg border border-border/60 bg-card/60 px-3 py-1.5 hover:border-primary/50">Roles & access →</Link>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <Stat k="On shift now" v={onNow.length} icon={Users} />
        <Stat k="Coverage gaps this week" v={gapCount} icon={AlertTriangle} tone={gapCount ? "text-destructive" : "text-success"} />
        <Stat k="Planned hours / week" v={people.reduce((a, u) => a + days.reduce((b, d) => { const s = sh.shifts.find((x) => x.code === sh.codeFor(u, d)); return b + (s ? shiftHours(s) - s.breakMin / 60 : 0); }, 0), 0).toFixed(0)} icon={Clock} />
        <Stat k="On leave this week" v={people.reduce((a, u) => a + days.filter((d) => sh.codeFor(u, d) === "LEAVE").length, 0)} icon={Users} />
      </div>

      {/* 24h shift clock */}
      <div className="glass-panel rounded-2xl p-5">
        <h3 className="mb-3 text-sm font-semibold">24-hour shift pattern</h3>
        <div className="relative h-10 overflow-hidden rounded-lg bg-muted/40">
          {sh.shifts.map((s) => {
            const segs = s.start < s.end ? [[s.start, s.end]] : [[s.start, 24], [0, s.end]];
            return segs.map(([a, b], i) => (
              <div key={s.code + i} className="absolute top-0 flex h-full items-center justify-center text-[11px] font-medium text-primary-foreground" style={{ left: `${(a / 24) * 100}%`, width: `${((b - a) / 24) * 100}%`, background: s.color, opacity: 0.85 }}>
                {s.code} · {s.name}
              </div>
            ));
          })}
          <div className="absolute top-0 h-full w-0.5 bg-foreground" style={{ left: `${((hour + new Date().getMinutes() / 60) / 24) * 100}%` }} title="Now" />
        </div>
        <div className="mt-1 flex justify-between font-mono text-[10px] text-muted-foreground">{[0, 3, 6, 9, 12, 15, 18, 21, 24].map((h) => <span key={h}>{hh(h % 24)}</span>)}</div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-[10px] uppercase tracking-wider text-muted-foreground"><tr>{["Code", "Name", "Start", "End", "Break (min)", "Color", "Min operators", "Min team leads", "Min supervisors", ""].map((h) => <th key={h} className="px-2 py-1.5 text-left font-medium">{h}</th>)}</tr></thead>
            <tbody>
              {sh.shifts.map((s) => <ShiftRow key={s.code} s={s} onChange={(p) => sh.updateShift(s.code, p)} onRemove={() => sh.removeShift(s.code)} canRemove={sh.shifts.length > 1} />)}
            </tbody>
          </table>
          <button onClick={() => { const code = String.fromCharCode(65 + sh.shifts.length); sh.addShift({ code, name: "New shift", start: 8, end: 16, color: "var(--color-success)", breakMin: 30, minStaff: { operator: 1, supervisor: 0, team_lead: 0 } }); }} className="mt-2 flex items-center gap-1 rounded-lg border border-border/60 px-2.5 py-1 text-xs hover:border-primary/50"><Plus className="h-3 w-3" /> Add shift</button>
        </div>
      </div>

      {/* Roster */}
      <div className="glass-panel overflow-hidden rounded-2xl">
        <div className="flex flex-wrap items-center justify-between gap-2 p-4">
          <div className="flex items-center gap-2">
            <button aria-label="Previous week" onClick={() => { const d = new Date(anchor); d.setDate(d.getDate() - 7); setAnchor(d); }} className="grid h-7 w-7 place-items-center rounded border border-border/60"><ChevronLeft className="h-3.5 w-3.5" /></button>
            <h3 className="text-sm font-semibold">Week of {anchor.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })}</h3>
            <button aria-label="Next week" onClick={() => { const d = new Date(anchor); d.setDate(d.getDate() + 7); setAnchor(d); }} className="grid h-7 w-7 place-items-center rounded border border-border/60"><ChevronRight className="h-3.5 w-3.5" /></button>
            <button onClick={() => setAnchor(weekStart(new Date()))} className="rounded border border-border/60 px-2 py-0.5 text-xs">This week</button>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <select aria-label="Role filter" value={role} onChange={(e) => setRole(e.target.value as typeof role)} className="rounded border border-border/60 bg-card/60 px-2 py-1"><option value="all">All roles</option>{ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}</select>
            <select aria-label="Team filter" value={team} onChange={(e) => setTeam(e.target.value)} className="rounded border border-border/60 bg-card/60 px-2 py-1"><option value="all">All teams</option>{store.teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
            <span className="text-muted-foreground">Brush:</span>
            <select aria-label="Brush" value={paint} onChange={(e) => setPaint(e.target.value)} className="rounded border border-border/60 bg-card/60 px-2 py-1"><option value="cycle">Cycle on click</option>{codes.map((c) => <option key={c} value={c}>{c}</option>)}</select>
            <button onClick={() => sh.clearWeek(days)} className="flex items-center gap-1 rounded border border-border/60 px-2 py-1"><RotateCcw className="h-3 w-3" /> Reset week to pattern</button>
            <button onClick={exportRoster} className="rounded border border-border/60 px-2 py-1">Export XLS</button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-card/60 text-[10px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Person</th>
                <th className="px-3 py-2 text-left font-medium">Default</th>
                {days.map((d) => <th key={dayKey(d)} className={`px-1 py-2 text-center font-medium ${dayKey(d) === today ? "text-primary" : ""}`}>{d.toLocaleDateString([], { weekday: "short", day: "numeric" })}</th>)}
                <th className="px-3 py-2 text-right font-medium">Hours</th>
              </tr>
            </thead>
            <tbody>
              {people.map((u) => {
                const hrs = days.reduce((b, d) => { const s = sh.shifts.find((x) => x.code === sh.codeFor(u, d)); return b + (s ? shiftHours(s) - s.breakMin / 60 : 0); }, 0);
                return (
                  <tr key={u.id} className="border-t border-border/40">
                    <td className="px-3 py-1.5">
                      <Link to="/users/$userId" params={{ userId: u.id }} className="font-medium hover:text-primary">{u.name}</Link>
                      <div className="text-[10px] text-muted-foreground">{ROLE_LABEL[u.role]} · {u.skills ?? ""}</div>
                    </td>
                    <td className="px-3 py-1.5">
                      <select aria-label={`Default shift for ${u.name}`} value={u.shift} onChange={(e) => store.updateUser(u.id, { shift: e.target.value as MesUser["shift"] })} className="rounded border border-border/60 bg-card/60 px-1 py-0.5">
                        {(["A", "B", "C"] as const).map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </td>
                    {days.map((d) => {
                      const c = sh.codeFor(u, d);
                      const col = color(c);
                      return (
                        <td key={dayKey(d)} className="px-1 py-1.5 text-center">
                          <button onClick={() => onCell(u, d)} title={`${u.name} · ${d.toDateString()} · ${c}`} className={`h-7 w-full min-w-[44px] rounded-md border text-[11px] font-semibold transition hover:scale-105 ${col ? "border-transparent text-primary-foreground" : c === "LEAVE" ? "border-warning/50 text-warning" : "border-border/50 text-muted-foreground"}`} style={col ? { background: col } : undefined}>{c}</button>
                        </td>
                      );
                    })}
                    <td className={`px-3 py-1.5 text-right font-mono ${hrs > 48 ? "text-destructive" : ""}`}>{hrs.toFixed(1)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Coverage heatmap */}
        <div className="glass-panel rounded-2xl p-5">
          <h3 className="text-sm font-semibold">Staffing coverage vs minimum</h3>
          <p className="mb-3 text-xs text-muted-foreground">Headcount per shift and day · red = below minimum for a role</p>
          <div className="overflow-x-auto">
            <table className="w-full text-[11px]">
              <thead><tr><th />{days.map((d) => <th key={dayKey(d)} className="px-1 py-1 font-medium text-muted-foreground">{d.toLocaleDateString([], { weekday: "short" })}</th>)}</tr></thead>
              <tbody>
                {sh.shifts.map((s, si) => (
                  <tr key={s.code}>
                    <td className="pr-2 font-medium"><span className="mr-1 inline-block h-2 w-2 rounded-full" style={{ background: s.color }} />{s.code}</td>
                    {coverage.map((col, di) => {
                      const c = col[si];
                      return (
                        <td key={di} className="p-0.5">
                          <div title={c.gaps.length ? `Short: ${c.gaps.map((g) => ROLE_LABEL[g]).join(", ")}` : "Fully staffed"} className={`rounded-md border px-1 py-1.5 text-center ${c.gaps.length ? "border-destructive/50 bg-destructive/15 text-destructive" : c.total ? "border-success/40 bg-success/10 text-success" : "border-border/40 text-muted-foreground"}`}>
                            <div className="font-mono text-sm font-semibold">{c.total}</div>
                            <div className="text-[9px]">{c.byRole.operator}·{c.byRole.team_lead}·{c.byRole.supervisor}</div>
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-2 text-[10px] text-muted-foreground">Small numbers: operators · team leads · supervisors</p>
          </div>
        </div>

        <div className="glass-panel rounded-2xl p-5">
          <h3 className="text-sm font-semibold">Today — headcount by hour & role</h3>
          <div className="h-64">
            <ResponsiveContainer>
              <BarChart data={hourly}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.3 0.02 245 / 0.4)" />
                <XAxis dataKey="h" stroke="oklch(0.68 0.02 245)" fontSize={9} interval={2} />
                <YAxis allowDecimals={false} stroke="oklch(0.68 0.02 245)" fontSize={10} />
                <Tooltip contentStyle={tt} />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                <Bar dataKey="operator" name="Operators" stackId="a" fill="var(--color-primary)" />
                <Bar dataKey="team_lead" name="Team leads" stackId="a" fill="var(--color-accent)" />
                <Bar dataKey="supervisor" name="Supervisors" stackId="a" fill="var(--color-info)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="glass-panel rounded-2xl p-5">
          <h3 className="text-sm font-semibold">On shift now {current ? `· ${current.code} ${current.name}` : ""}</h3>
          <div className="mt-3 space-y-1.5">
            {onNow.length === 0 && <p className="text-xs text-muted-foreground">Nobody rostered for the current shift.</p>}
            {onNow.map((u) => {
              const asg = store.assignments.filter((a) => a.userId === u.id && a.active);
              return (
                <Link key={u.id} to="/users/$userId" params={{ userId: u.id }} className="flex items-center justify-between rounded-lg border border-border/60 bg-card/40 px-3 py-2 text-xs hover:border-primary/50">
                  <span><span className="font-medium">{u.name}</span> <span className="text-muted-foreground">· {ROLE_LABEL[u.role]}</span></span>
                  <span className="flex items-center gap-2 text-muted-foreground">{asg.map((a) => a.targetId).join(", ") || "unassigned"}<StatusPill status={u.status === "active" ? "active" : u.status === "on-break" ? "paused" : "idle"} /></span>
                </Link>
              );
            })}
          </div>
        </div>
        <div className="glass-panel rounded-2xl p-5">
          <h3 className="text-sm font-semibold">Shift performance · last 7 days</h3>
          <p className="text-xs text-muted-foreground">Downtime minutes and work-order output by shift</p>
          <div className="h-56">
            <ResponsiveContainer>
              <BarChart data={perf}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.3 0.02 245 / 0.4)" />
                <XAxis dataKey="shift" stroke="oklch(0.68 0.02 245)" fontSize={10} />
                <YAxis stroke="oklch(0.68 0.02 245)" fontSize={10} />
                <Tooltip contentStyle={tt} />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                <Bar dataKey="downtime" name="Downtime (min)" fill="var(--color-destructive)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="events" name="Stoppages" fill="var(--color-warning)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="wos" name="Work orders" fill="var(--color-success)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <Link to="/analytics" search={{ view: "stoppage" }} className="text-xs text-primary hover:underline">Stoppages by shift →</Link>
        </div>
      </div>
    </div>
  );
}

function ShiftRow({ s, onChange, onRemove, canRemove }: { s: ShiftDef; onChange: (p: Partial<ShiftDef>) => void; onRemove: () => void; canRemove: boolean }) {
  const inp = "w-16 rounded border border-border/60 bg-card/60 px-1.5 py-0.5";
  const colors = ["var(--color-primary)", "var(--color-accent)", "var(--color-info)", "var(--color-success)", "var(--color-warning)"];
  return (
    <tr className="border-t border-border/40">
      <td className="px-2 py-1.5 font-mono font-semibold">{s.code}</td>
      <td className="px-2 py-1.5"><input aria-label="Shift name" className="w-28 rounded border border-border/60 bg-card/60 px-1.5 py-0.5" value={s.name} onChange={(e) => onChange({ name: e.target.value })} /></td>
      <td className="px-2 py-1.5"><select aria-label="Start" className={inp} value={s.start} onChange={(e) => onChange({ start: Number(e.target.value) })}>{Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{hh(h)}</option>)}</select></td>
      <td className="px-2 py-1.5"><select aria-label="End" className={inp} value={s.end} onChange={(e) => onChange({ end: Number(e.target.value) })}>{Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{hh(h)}</option>)}</select></td>
      <td className="px-2 py-1.5"><input aria-label="Break" type="number" min={0} className={inp} value={s.breakMin} onChange={(e) => onChange({ breakMin: Number(e.target.value) })} /></td>
      <td className="px-2 py-1.5"><div className="flex gap-1">{colors.map((c) => <button key={c} aria-label="Pick color" onClick={() => onChange({ color: c })} className={`h-4 w-4 rounded-full ${s.color === c ? "ring-2 ring-foreground" : ""}`} style={{ background: c }} />)}</div></td>
      {(["operator", "team_lead", "supervisor"] as UserRole[]).map((r) => (
        <td key={r} className="px-2 py-1.5"><input aria-label={`Minimum ${r}`} type="number" min={0} className={inp} value={s.minStaff[r] ?? 0} onChange={(e) => onChange({ minStaff: { ...s.minStaff, [r]: Number(e.target.value) } })} /></td>
      ))}
      <td className="px-2 py-1.5">{canRemove && <button aria-label="Remove shift" onClick={onRemove} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>}</td>
    </tr>
  );
}

function Stat({ k, v, icon: Icon, tone = "text-primary" }: { k: string; v: string | number; icon: React.ComponentType<{ className?: string }>; tone?: string }) {
  return (
    <div className="glass-panel rounded-2xl p-4">
      <div className="flex items-center justify-between"><span className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">{k}</span><Icon className={`h-4 w-4 ${tone}`} /></div>
      <div className={`mt-2 font-mono text-3xl font-semibold ${tone}`}>{v}</div>
    </div>
  );
}
