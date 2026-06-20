import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useMes } from "@/lib/mes-store";
import {
  ArrowLeft, Mail, Phone, ShieldCheck, Star, Users as UsersIcon, Factory,
  Clock, AlertOctagon, History, Award,
} from "lucide-react";

export const Route = createFileRoute("/users/$userId")({
  head: ({ params }) => ({
    meta: [
      { title: `User ${params.userId} · Profile · Cortanex MES` },
      { name: "description", content: "Operator profile — role, active assignments, shift, contact and recent activity." },
    ],
  }),
  component: UserProfile,
  notFoundComponent: () => (
    <div className="grid place-items-center p-12 text-sm text-muted-foreground">User not found.</div>
  ),
});

function UserProfile() {
  const { userId } = Route.useParams();
  const store = useMes();
  const user = store.users.find((u) => u.id === userId);
  if (!user) throw notFound();

  const active = store.assignments.filter((a) => a.userId === user.id && a.active);
  const history = store.assignments.filter((a) => a.userId === user.id && !a.active).slice(0, 8);
  const auditEntries = store.audit.filter((e) => e.actorId === user.id).slice(0, 10);
  const downtimeRaised = store.downtime.filter((d) => d.operatorId === user.id).slice(0, 6);

  const roleMeta = {
    operator:   { label: "Operator",   cls: "border-info/40 bg-info/10 text-info",         Icon: UsersIcon },
    supervisor: { label: "Supervisor", cls: "border-primary/40 bg-primary/10 text-primary", Icon: ShieldCheck },
    team_lead:  { label: "Team lead",  cls: "border-accent/40 bg-accent/10 text-accent",   Icon: Star },
  }[user.role];
  const RIcon = roleMeta.Icon;

  return (
    <div className="space-y-6">
      <div>
        <Link to="/users" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3 w-3" /> All users
        </Link>
      </div>

      {/* Hero */}
      <div className="glass-panel rounded-2xl p-5">
        <div className="flex flex-wrap items-center gap-4">
          <div className="grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-primary to-info text-lg font-bold text-primary-foreground shadow-[var(--shadow-glow)]">
            {user.name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-display text-2xl font-semibold tracking-tight">{user.name}</h1>
              <span className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] uppercase tracking-wider ${roleMeta.cls}`}>
                <RIcon className="h-3 w-3" /> {roleMeta.label}
              </span>
              <span className="rounded-full border border-border/60 bg-card/60 px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                {user.status}
              </span>
            </div>
            <p className="font-mono text-[11px] text-muted-foreground">{user.id} · Shift {user.shift}</p>
            <div className="mt-3 flex flex-wrap gap-3 text-xs">
              <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                <Phone className="h-3.5 w-3.5" /> <span className="font-mono text-foreground">{user.mobile}</span>
              </span>
              <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                <Mail className="h-3.5 w-3.5" /> <span className="text-foreground">{user.email}</span>
              </span>
            </div>
            {user.skills && (
              <div className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-border/40 bg-background/40 px-2 py-1 text-[11px]">
                <Award className="h-3 w-3 text-accent" /> {user.skills}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Active assignments */}
        <div className="glass-panel rounded-2xl p-4">
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
            <Factory className="h-3 w-3" /> Active assignments · {active.length}
          </div>
          {active.length === 0 ? (
            <div className="mt-2 text-xs text-muted-foreground">No active assignments.</div>
          ) : (
            <ul className="mt-2 space-y-2">
              {active.map((a) => {
                const station = a.targetType === "station" ? store.stations.find((s) => s.id === a.targetId) : null;
                const team = a.targetType === "team" ? store.teams.find((t) => t.id === a.targetId) : null;
                const line = station ? store.lines.find((l) => l.id === station.lineId) : null;
                return (
                  <li key={a.id} className="rounded-lg border border-border/40 bg-background/40 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        {station ? (
                          <Link to="/stations/$stationId" params={{ stationId: station.id }} className="font-medium hover:text-primary">
                            {station.name}
                          </Link>
                        ) : team ? (
                          <span className="font-medium">{team.name}</span>
                        ) : (
                          <span className="font-mono">{a.targetId}</span>
                        )}
                        <div className="font-mono text-[11px] text-muted-foreground">
                          {a.targetType.toUpperCase()} · {a.targetId}
                          {line && <> · {line.name}</>}
                        </div>
                      </div>
                      <span className="rounded border border-success/40 bg-success/10 px-1.5 py-0.5 text-[10px] text-success">active</span>
                    </div>
                    <div className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
                      <Clock className="h-3 w-3" /> Shift {a.shift} · <span className="font-mono">{a.startedAt}{a.endsAt ? ` → ${a.endsAt}` : ""}</span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Recent activity */}
        <div className="glass-panel rounded-2xl p-4">
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
            <History className="h-3 w-3" /> Recent activity
          </div>
          {auditEntries.length === 0 ? (
            <div className="mt-2 text-xs text-muted-foreground">No recorded activity.</div>
          ) : (
            <ul className="mt-2 space-y-1.5">
              {auditEntries.map((e) => (
                <li key={e.id} className="rounded border border-border/40 bg-background/40 p-2 text-[11px]">
                  <div className="font-medium">{e.summary}</div>
                  <div className="font-mono text-[10px] text-muted-foreground">{new Date(e.at).toLocaleString()} · {e.entity} · {e.action}</div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Downtime captured */}
        <div className="glass-panel rounded-2xl p-4">
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
            <AlertOctagon className="h-3 w-3" /> Downtime captured · {downtimeRaised.length}
          </div>
          {downtimeRaised.length === 0 ? (
            <div className="mt-2 text-xs text-muted-foreground">No downtime events attributed.</div>
          ) : (
            <ul className="mt-2 space-y-1.5">
              {downtimeRaised.map((d) => (
                <li key={d.id} className="rounded border border-border/40 bg-background/40 p-2 text-[11px]">
                  <div className="font-medium">{d.reasonCode}</div>
                  <div className="font-mono text-[10px] text-muted-foreground">{d.lineId} · {d.startedAt} · {d.durationMin}m · {d.status}</div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Assignment history */}
        <div className="glass-panel rounded-2xl p-4">
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
            <Clock className="h-3 w-3" /> Past assignments
          </div>
          {history.length === 0 ? (
            <div className="mt-2 text-xs text-muted-foreground">—</div>
          ) : (
            <ul className="mt-2 space-y-1.5">
              {history.map((a) => (
                <li key={a.id} className="rounded border border-border/40 bg-background/40 p-2 text-[11px]">
                  <div className="font-mono">{a.targetType} · {a.targetId}</div>
                  <div className="text-[10px] text-muted-foreground">Shift {a.shift} · {a.startedAt}{a.endsAt ? ` → ${a.endsAt}` : ""}</div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
