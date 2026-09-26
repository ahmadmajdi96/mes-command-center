import { useMemo } from "react";
import { Plus, UserRound, X } from "lucide-react";
import { EntityFormDialog, type Field } from "@/components/crud/entity-form-dialog";
import { Button } from "@/components/ui/button";
import { useMes } from "@/lib/mes-store";

export function LineOperatorAssignments({ lineId, compact = false }: { lineId: string; compact?: boolean }) {
  const store = useMes();
  const stations = useMemo(
    () => store.stations.filter((station) => station.lineId === lineId).sort((a, b) => a.sequence - b.sequence),
    [store.stations, lineId],
  );
  const stationIds = useMemo(() => new Set(stations.map((station) => station.id)), [stations]);
  const assignments = store.assignments.filter(
    (assignment) => assignment.targetType === "station" && stationIds.has(assignment.targetId),
  );
  const fields: Field[] = [
    {
      name: "stationId",
      label: "Station",
      type: "select",
      required: true,
      span: 2,
      options: stations.map((station) => ({ value: station.id, label: `${station.id} · ${station.name}` })),
    },
    {
      name: "userId",
      label: "Operator",
      type: "select",
      required: true,
      span: 2,
      options: store.users
        .filter((user) => user.status !== "inactive")
        .map((user) => ({ value: user.id, label: `${user.name} · ${user.role} · Shift ${user.shift}` })),
    },
    {
      name: "shift",
      label: "Shift",
      type: "select",
      required: true,
      options: ["A", "B", "C"].map((shift) => ({ value: shift, label: `Shift ${shift}` })),
    },
    { name: "startedAt", label: "Starts", type: "text", required: true, placeholder: "06:00" },
    { name: "endsAt", label: "Ends", type: "text", placeholder: "14:00" },
  ];

  return (
    <section className={compact ? "mt-3 border-t border-border/40 pt-3" : "glass-panel rounded-2xl p-5"}>
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className={compact ? "text-xs font-semibold" : "font-display text-lg font-semibold"}>Operator assignments</h2>
          <p className="text-[11px] text-muted-foreground">{assignments.filter((assignment) => assignment.active).length} active across {stations.length} stations</p>
        </div>
        <EntityFormDialog
          title="Assign operator to line"
          description="Choose the station, operator, shift, and working window."
          fields={fields}
          initial={{ shift: "A", startedAt: "06:00", endsAt: "14:00" } as any}
          onSubmit={(values: any) => store.createAssignment({
            userId: values.userId,
            targetType: "station",
            targetId: values.stationId,
            shift: values.shift,
            startedAt: values.startedAt,
            endsAt: values.endsAt || undefined,
            active: true,
          })}
          trigger={
            <Button size="sm" variant="outline" disabled={stations.length === 0} title={stations.length === 0 ? "Add a station first" : "Assign operator"}>
              <Plus /> Assign
            </Button>
          }
        />
      </div>

      <div className={compact ? "mt-2 max-h-24 space-y-1 overflow-y-auto" : "mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-3"}>
        {assignments.map((assignment) => {
          const user = store.users.find((item) => item.id === assignment.userId);
          const station = stations.find((item) => item.id === assignment.targetId);
          return (
            <div key={assignment.id} className="flex min-w-0 items-center gap-2 rounded-md border border-border/50 bg-background/40 px-2 py-1.5 text-xs">
              <UserRound className="h-3.5 w-3.5 shrink-0 text-primary" />
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{user?.name ?? assignment.userId}</div>
                <div className="truncate text-[10px] text-muted-foreground">{station?.name ?? assignment.targetId} · Shift {assignment.shift} · {assignment.startedAt}{assignment.endsAt ? `–${assignment.endsAt}` : ""}</div>
              </div>
              {!assignment.active && <span className="text-[9px] uppercase text-muted-foreground">inactive</span>}
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                title={`Remove ${user?.name ?? "assignment"}`}
                onClick={() => store.deleteAssignment(assignment.id)}
              >
                <X />
              </Button>
            </div>
          );
        })}
        {assignments.length === 0 && (
          <p className="py-2 text-xs text-muted-foreground">No operators assigned to this line.</p>
        )}
      </div>
    </section>
  );
}