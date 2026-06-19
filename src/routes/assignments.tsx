import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMes } from "@/lib/mes-store";
import type { Assignment, AssignmentTarget, Team } from "@/lib/mes-data";
import { EntityFormDialog, type Field } from "@/components/crud/entity-form-dialog";
import { ConfirmDelete } from "@/components/crud/confirm-delete";
import { Plus, Pencil, UserCog, Users as UsersIcon, MapPin, ArrowRightLeft, Power, PowerOff } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/assignments")({
  head: () => ({
    meta: [
      { title: "Assignments · Cortanex MES" },
      { name: "description", content: "Dynamically assign users to stations or teams." },
    ],
  }),
  component: AssignmentsPage,
});

function AssignmentsPage() {
  const store = useMes();
  const [tab, setTab] = useState<"assignments" | "teams">("assignments");

  const userOptions = store.users.map((u) => ({ value: u.id, label: `${u.name} — ${u.role}` }));
  const stationOptions = store.stations.map((s) => {
    const line = store.lines.find((l) => l.id === s.lineId);
    return { value: s.id, label: `${s.id} · ${s.name} (${line?.name ?? s.lineId})` };
  });
  const teamOptionsAll = store.teams.map((t) => ({ value: t.id, label: `${t.id} · ${t.name}` }));

  // Resolver
  const resolveTargetName = (a: Assignment) => {
    if (a.targetType === "station") {
      const s = store.stations.find((x) => x.id === a.targetId);
      const l = s ? store.lines.find((l) => l.id === s.lineId) : undefined;
      return s ? `${s.name} · ${l?.name ?? s.lineId}` : a.targetId;
    }
    const t = store.teams.find((x) => x.id === a.targetId);
    return t ? `${t.name} (${t.area})` : a.targetId;
  };

  const assignmentFields = (mode: "create" | "edit"): Field[] => [
    { name: "userId", label: "User", type: "select", required: true, options: userOptions, span: 2 },
    { name: "targetType", label: "Assign to", type: "select", required: true, options: [
      { value: "station", label: "Station" },
      { value: "team", label: "Team" },
    ]},
    { name: "shift", label: "Shift", type: "select", required: true, options: [
      { value: "A", label: "A" }, { value: "B", label: "B" }, { value: "C", label: "C" },
    ]},
    { name: "targetId", label: "Station", type: "select", required: true, options: stationOptions, span: 2,
      visibleWhen: { field: "targetType", equals: "station" } },
    { name: "targetId", label: "Team", type: "select", required: true, options: teamOptionsAll, span: 2,
      visibleWhen: { field: "targetType", equals: "team" } },
    { name: "startedAt", label: "Starts at", type: "text", placeholder: "06:00", required: true },
    { name: "endsAt", label: "Ends at", type: "text", placeholder: "14:00" },
    { name: "active", label: "Active", type: "select", required: true, options: [
      { value: "true", label: "Active" }, { value: "false", label: "Inactive" },
    ]},
  ];

  const createAssignment = (v: any) => {
    store.createAssignment({
      userId: v.userId,
      targetType: v.targetType as AssignmentTarget,
      targetId: v.targetId,
      shift: v.shift,
      startedAt: v.startedAt,
      endsAt: v.endsAt || undefined,
      active: v.active === "true" || v.active === true,
    } as any);
  };

  // Team fields use a comma-separated memberIds string for simplicity in this UI
  const teamFields: Field[] = [
    { name: "id", label: "Team ID", type: "text", placeholder: "T-04", required: true },
    { name: "name", label: "Name", type: "text", required: true, span: 2 },
    { name: "shift", label: "Shift", type: "select", required: true, options: [
      { value: "A", label: "A" }, { value: "B", label: "B" }, { value: "C", label: "C" },
    ]},
    { name: "leadId", label: "Team lead", type: "select", required: true,
      options: store.users.filter((u) => u.role === "team_lead" || u.role === "supervisor").map((u) => ({ value: u.id, label: u.name })) },
    { name: "area", label: "Area / line", type: "text", span: 2, placeholder: "L-01 · Mixer Line A" },
    { name: "memberIds_csv", label: "Member IDs (comma-separated)", type: "textarea", span: 2,
      placeholder: "U-002,U-008" },
  ];

  const teamToForm = (t: Team) => ({ ...t, memberIds_csv: t.memberIds.join(",") });
  const formToTeam = (v: any): Omit<Team, "id"> & { id?: string } => ({
    id: v.id,
    name: v.name,
    shift: v.shift,
    leadId: v.leadId,
    area: v.area,
    memberIds: String(v.memberIds_csv || "").split(",").map((s) => s.trim()).filter(Boolean),
  });

  // Workload summary
  const userWorkload = useMemo(() => {
    return store.users.map((u) => ({
      user: u,
      count: store.assignments.filter((a) => a.userId === u.id && a.active).length,
    }));
  }, [store.users, store.assignments]);

  const unassignedStations = useMemo(() => {
    const assigned = new Set(store.assignments.filter((a) => a.active && a.targetType === "station").map((a) => a.targetId));
    return store.stations.filter((s) => !assigned.has(s.id));
  }, [store.stations, store.assignments]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Assignments</h1>
          <p className="text-sm text-muted-foreground">
            {store.assignments.filter((a) => a.active).length} active · {store.teams.length} teams · {unassignedStations.length} unassigned stations
          </p>
        </div>
        <div className="flex gap-2">
          {tab === "assignments" ? (
            <EntityFormDialog
              title="New assignment"
              fields={assignmentFields("create")}
              initial={{ targetType: "station", shift: "A", active: "true", startedAt: "06:00", endsAt: "14:00" } as any}
              onSubmit={createAssignment}
              trigger={
                <button className="flex items-center gap-1.5 rounded-lg bg-gradient-to-br from-primary to-info px-3 py-1.5 text-xs font-medium text-primary-foreground shadow-[var(--shadow-glow)]">
                  <Plus className="h-3.5 w-3.5" /> New assignment
                </button>
              }
            />
          ) : (
            <EntityFormDialog<Team>
              title="New team"
              fields={teamFields}
              initial={{ shift: "A", memberIds_csv: "" } as any}
              onSubmit={(v) => store.createTeam(formToTeam(v) as any)}
              trigger={
                <button className="flex items-center gap-1.5 rounded-lg bg-gradient-to-br from-primary to-info px-3 py-1.5 text-xs font-medium text-primary-foreground shadow-[var(--shadow-glow)]">
                  <Plus className="h-3.5 w-3.5" /> New team
                </button>
              }
            />
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg border border-border/60 bg-card/40 p-1 w-fit">
        {(["assignments", "teams"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium ${
              tab === t ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t === "assignments" ? <UserCog className="h-3.5 w-3.5" /> : <UsersIcon className="h-3.5 w-3.5" />}
            {t === "assignments" ? "Assignments" : "Teams"}
          </button>
        ))}
      </div>

      {tab === "assignments" && (
        <>
          {/* Workload summary */}
          <div className="glass-panel rounded-2xl p-4">
            <div className="mb-2 text-[10px] uppercase tracking-wider text-muted-foreground">Workload per user</div>
            <div className="flex flex-wrap gap-2">
              {userWorkload.map(({ user, count }) => (
                <div key={user.id} className={`rounded-md border px-2 py-1 text-[11px] ${count === 0 ? "border-border/60 text-muted-foreground" : "border-primary/30 bg-primary/5 text-foreground"}`}>
                  {user.name} <span className="ml-1 font-mono">{count}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Assignments table */}
          <div className="glass-panel overflow-x-auto rounded-2xl p-2">
            <table className="w-full text-sm">
              <thead className="text-[10px] uppercase tracking-wider text-muted-foreground">
                <tr className="border-b border-border/60">
                  <th className="px-3 py-2 text-left">ID</th>
                  <th className="px-3 py-2 text-left">User</th>
                  <th className="px-3 py-2 text-left">Target</th>
                  <th className="px-3 py-2 text-left">Shift</th>
                  <th className="px-3 py-2 text-left">Window</th>
                  <th className="px-3 py-2 text-left">State</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {store.assignments.map((a) => {
                  const u = store.users.find((x) => x.id === a.userId);
                  return (
                    <tr key={a.id} className="border-b border-border/30">
                      <td className="px-3 py-2 font-mono text-xs">{a.id}</td>
                      <td className="px-3 py-2">
                        <div className="font-medium">{u?.name ?? "—"}</div>
                        <div className="text-[11px] text-muted-foreground">{u?.role}</div>
                      </td>
                      <td className="px-3 py-2 text-xs">
                        <span className={`mr-2 inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] uppercase ${
                          a.targetType === "station" ? "border-info/40 bg-info/10 text-info" : "border-accent/40 bg-accent/10 text-accent"
                        }`}>
                          {a.targetType === "station" ? <MapPin className="h-3 w-3" /> : <UsersIcon className="h-3 w-3" />}
                          {a.targetType}
                        </span>
                        {resolveTargetName(a)}
                      </td>
                      <td className="px-3 py-2 font-mono text-xs">{a.shift}</td>
                      <td className="px-3 py-2 font-mono text-xs">{a.startedAt}{a.endsAt ? ` → ${a.endsAt}` : ""}</td>
                      <td className="px-3 py-2">
                        <button
                          onClick={() => {
                            store.updateAssignment(a.id, { active: !a.active });
                            toast.success(`Assignment ${a.id} ${!a.active ? "activated" : "deactivated"}`);
                          }}
                          className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] uppercase ${
                            a.active ? "border-success/40 bg-success/10 text-success" : "border-border/60 bg-card/60 text-muted-foreground"
                          }`}
                        >
                          {a.active ? <Power className="h-3 w-3" /> : <PowerOff className="h-3 w-3" />}
                          {a.active ? "active" : "inactive"}
                        </button>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex justify-end gap-1.5">
                          <EntityFormDialog
                            title={`Edit ${a.id}`}
                            fields={assignmentFields("edit")}
                            initial={{ ...a, active: a.active ? "true" : "false" } as any}
                            onSubmit={(v: any) => store.updateAssignment(a.id, {
                              userId: v.userId, targetType: v.targetType, targetId: v.targetId, shift: v.shift,
                              startedAt: v.startedAt, endsAt: v.endsAt || undefined,
                              active: v.active === "true" || v.active === true,
                            })}
                            trigger={
                              <button className="grid h-8 w-8 place-items-center rounded-lg border border-border/60 bg-card/60 text-muted-foreground hover:border-primary/40 hover:text-primary">
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                            }
                          />
                          <ConfirmDelete label={`Delete ${a.id}`} onConfirm={() => store.deleteAssignment(a.id)} />
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {store.assignments.length === 0 && (
                  <tr><td colSpan={7} className="px-3 py-8 text-center text-sm text-muted-foreground">No assignments yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Unassigned stations callout */}
          {unassignedStations.length > 0 && (
            <div className="glass-panel rounded-2xl p-4">
              <div className="mb-2 flex items-center gap-2 text-xs">
                <ArrowRightLeft className="h-3.5 w-3.5 text-warning" />
                <span className="text-warning">Stations without an active operator</span>
              </div>
              <div className="flex flex-wrap gap-2 text-[11px]">
                {unassignedStations.map((s) => {
                  const l = store.lines.find((l) => l.id === s.lineId);
                  return (
                    <span key={s.id} className="rounded-md border border-warning/30 bg-warning/5 px-2 py-1 font-mono">
                      {s.id} · {s.name} <span className="text-muted-foreground">({l?.name ?? s.lineId})</span>
                    </span>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      {tab === "teams" && (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {store.teams.map((t) => {
            const lead = store.users.find((u) => u.id === t.leadId);
            return (
              <div key={t.id} className="glass-panel rounded-2xl p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-mono text-[11px] text-muted-foreground">{t.id} · Shift {t.shift}</div>
                    <h3 className="font-semibold">{t.name}</h3>
                    <div className="text-[11px] text-muted-foreground">{t.area}</div>
                  </div>
                  <div className="flex gap-1.5">
                    <EntityFormDialog<Team>
                      title={`Edit ${t.id}`}
                      fields={teamFields}
                      initial={teamToForm(t) as any}
                      onSubmit={(v) => store.updateTeam(t.id, formToTeam(v))}
                      trigger={
                        <button className="grid h-8 w-8 place-items-center rounded-lg border border-border/60 bg-card/60 text-muted-foreground hover:border-primary/40 hover:text-primary">
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                      }
                    />
                    <ConfirmDelete label={`Delete ${t.id}`} onConfirm={() => store.deleteTeam(t.id)} />
                  </div>
                </div>

                <div className="mt-3 rounded-lg border border-border/40 bg-background/40 p-2 text-xs">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Lead</div>
                  <div>{lead?.name ?? "—"}</div>
                </div>

                <div className="mt-2 rounded-lg border border-border/40 bg-background/40 p-2 text-xs">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Members · {t.memberIds.length}</div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {t.memberIds.map((id) => {
                      const u = store.users.find((x) => x.id === id);
                      return (
                        <span key={id} className="rounded-md border border-border/60 px-1.5 py-0.5 font-mono text-[10px]">
                          {u?.name ?? id}
                        </span>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
          {store.teams.length === 0 && (
            <div className="col-span-full grid place-items-center rounded-2xl border border-dashed border-border/60 p-10 text-sm text-muted-foreground">
              No teams configured.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
