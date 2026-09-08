import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMes } from "@/lib/mes-store";
import type { MesUser, UserRole, UserStatus } from "@/lib/mes-data";
import { EntityFormDialog, type Field } from "@/components/crud/entity-form-dialog";
import { ConfirmDelete } from "@/components/crud/confirm-delete";
import { Plus, Pencil, Search, Mail, Phone, Users as UsersIcon, ShieldCheck, Star, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/_authenticated/users/")({
  head: () => ({
    meta: [
      { title: "Users · Cortanex MES" },
      { name: "description", content: "Manage shop-floor users — operators, supervisors and team leads." },
    ],
  }),
  component: UsersPage,
});

const roles: { value: UserRole; label: string }[] = [
  { value: "operator", label: "Operator" },
  { value: "supervisor", label: "Supervisor" },
  { value: "team_lead", label: "Team lead" },
];

const statuses: { value: UserStatus; label: string }[] = [
  { value: "active", label: "active" },
  { value: "off-shift", label: "off-shift" },
  { value: "on-break", label: "on-break" },
  { value: "inactive", label: "inactive" },
];

const userFields: Field[] = [
  { name: "name", label: "Full name", type: "text", required: true, span: 2 },
  { name: "mobile", label: "Mobile number", type: "text", required: true, placeholder: "+966 50 000 0000" },
  { name: "email", label: "Email", type: "text", required: true, placeholder: "name@cortanex.io" },
  { name: "role", label: "Role", type: "select", required: true, options: roles },
  { name: "shift", label: "Shift", type: "select", required: true, options: [
    { value: "A", label: "A (06:00 → 14:00)" },
    { value: "B", label: "B (14:00 → 22:00)" },
    { value: "C", label: "C (22:00 → 06:00)" },
  ]},
  { name: "status", label: "Status", type: "select", required: true, options: statuses },
  { name: "skills", label: "Skills / certifications", type: "text", span: 2, placeholder: "CCP, oven, mixer" },
];

function initials(name: string) {
  return name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();
}

function roleBadge(role: UserRole) {
  const map: Record<UserRole, { label: string; cls: string; icon: any }> = {
    operator:   { label: "Operator",   cls: "border-info/40 bg-info/10 text-info",         icon: UsersIcon },
    supervisor: { label: "Supervisor", cls: "border-primary/40 bg-primary/10 text-primary", icon: ShieldCheck },
    team_lead:  { label: "Team lead",  cls: "border-accent/40 bg-accent/10 text-accent",   icon: Star },
  };
  const m = map[role];
  const Icon = m.icon;
  return (
    <span className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] uppercase tracking-wider ${m.cls}`}>
      <Icon className="h-3 w-3" /> {m.label}
    </span>
  );
}

function statusDot(s: UserStatus) {
  const map: Record<UserStatus, string> = {
    active: "bg-success animate-pulse",
    "off-shift": "bg-muted-foreground",
    "on-break": "bg-warning",
    inactive: "bg-destructive",
  };
  return <span className={`inline-block h-1.5 w-1.5 rounded-full ${map[s]}`} />;
}

function UsersPage() {
  const store = useMes();
  const [q, setQ] = useState("");
  const [role, setRole] = useState<"all" | UserRole>("all");

  const filtered = useMemo(() => {
    return store.users.filter((u) => {
      if (role !== "all" && u.role !== role) return false;
      if (!q) return true;
      const s = q.toLowerCase();
      return u.name.toLowerCase().includes(s) || u.email.toLowerCase().includes(s) || u.mobile.includes(s) || u.id.toLowerCase().includes(s);
    });
  }, [store.users, q, role]);

  const counts = {
    total: store.users.length,
    operator: store.users.filter((u) => u.role === "operator").length,
    supervisor: store.users.filter((u) => u.role === "supervisor").length,
    team_lead: store.users.filter((u) => u.role === "team_lead").length,
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Users</h1>
          <p className="text-sm text-muted-foreground">
            {counts.total} users · {counts.operator} operators · {counts.supervisor} supervisors · {counts.team_lead} team leads
          </p>
        </div>
        <EntityFormDialog<MesUser>
          title="New user"
          fields={userFields}
          initial={{ role: "operator", shift: "A", status: "active" } as any}
          onSubmit={(v) => store.createUser(v as any)}
          trigger={
            <button className="flex items-center gap-1.5 rounded-lg bg-gradient-to-br from-primary to-info px-3 py-1.5 text-xs font-medium text-primary-foreground shadow-[var(--shadow-glow)]">
              <Plus className="h-3.5 w-3.5" /> New user
            </button>
          }
        />
      </div>

      {/* Filters */}
      <div className="glass-panel flex flex-wrap items-center gap-3 rounded-2xl p-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name, email, mobile, ID…"
            className="h-9 w-full rounded-lg border border-border/60 bg-card/60 pl-8 pr-3 text-sm focus:border-primary/50 focus:outline-none"
          />
        </div>
        <div className="flex gap-1">
          {(["all", "operator", "supervisor", "team_lead"] as const).map((r) => (
            <button
              key={r}
              onClick={() => setRole(r)}
              className={`rounded-md border px-2.5 py-1 text-xs ${
                role === r ? "border-primary/50 bg-primary/15 text-primary" : "border-border/60 bg-card/60 text-muted-foreground hover:text-foreground"
              }`}
            >
              {r === "all" ? "All" : r === "team_lead" ? "Team lead" : r.charAt(0).toUpperCase() + r.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {filtered.map((u) => {
          const activeAssignments = store.assignments.filter((a) => a.userId === u.id && a.active);
          return (
            <div key={u.id} className="glass-panel rounded-2xl p-4">
              <div className="flex items-start gap-3">
                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-primary to-info text-sm font-bold text-primary-foreground">
                  {initials(u.name)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Link to="/users/$userId" params={{ userId: u.id }} className="truncate font-semibold hover:text-primary">{u.name}</Link>
                    {statusDot(u.status)}
                  </div>
                  <div className="font-mono text-[11px] text-muted-foreground">{u.id} · Shift {u.shift}</div>
                  <div className="mt-1">{roleBadge(u.role)}</div>
                </div>
              </div>

              <div className="mt-3 space-y-1 text-xs">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Phone className="h-3 w-3" /> <span className="font-mono text-foreground">{u.mobile}</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Mail className="h-3 w-3" /> <span className="truncate text-foreground">{u.email}</span>
                </div>
                {u.skills && (
                  <div className="text-[11px] text-muted-foreground">Skills: <span className="text-foreground">{u.skills}</span></div>
                )}
              </div>

              <div className="mt-3 rounded-lg border border-border/40 bg-background/40 p-2 text-[11px]">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Active assignments</div>
                {activeAssignments.length === 0 ? (
                  <div className="text-muted-foreground">— none —</div>
                ) : (
                  activeAssignments.map((a) => (
                    <div key={a.id} className="font-mono">{a.targetType.toUpperCase()} · {a.targetId} · {a.startedAt}{a.endsAt ? ` → ${a.endsAt}` : ""}</div>
                  ))
                )}
              </div>

              <div className="mt-3 flex justify-end gap-1.5">
                <Link to="/users/$userId" params={{ userId: u.id }} className="inline-flex h-8 items-center gap-1 rounded-lg border border-primary/30 bg-primary/10 px-2 text-[11px] text-primary hover:bg-primary/20">
                  Profile <ArrowRight className="h-3 w-3" />
                </Link>
                <EntityFormDialog<MesUser>
                  title={`Edit ${u.name}`}
                  fields={userFields}
                  initial={u}
                  onSubmit={(v) => store.updateUser(u.id, v)}
                  trigger={
                    <button className="grid h-8 w-8 place-items-center rounded-lg border border-border/60 bg-card/60 text-muted-foreground hover:border-primary/40 hover:text-primary">
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                  }
                />
                <ConfirmDelete label={`Delete ${u.id}`} onConfirm={() => store.deleteUser(u.id)} />
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="col-span-full grid place-items-center rounded-2xl border border-dashed border-border/60 p-10 text-sm text-muted-foreground">
            No users match those filters.
          </div>
        )}
      </div>
    </div>
  );
}
