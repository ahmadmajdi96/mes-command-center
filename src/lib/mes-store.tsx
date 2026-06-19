import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  workOrders as seedWO,
  downtime as seedDT,
  holds as seedHolds,
  genealogy as seedGen,
  recipeSteps as seedSteps,
  lines as seedLines,
  stations as seedStations,
  users as seedUsers,
  teams as seedTeams,
  assignments as seedAssignments,
  stepTemplates as seedTemplates,
  auditEntries as seedAudit,
  type WorkOrder,
  type DowntimeEvent,
  type QualityHold,
  type GenealogyRecord,
  type RecipeStep,
  type ProductionLine,
  type Station,
  type MesUser,
  type Team,
  type Assignment,
  type StepTemplate,
  type AuditEntry,
  type AuditAction,
  type AuditEntity,
} from "./mes-data";

type State = {
  workOrders: WorkOrder[];
  downtime: DowntimeEvent[];
  holds: QualityHold[];
  genealogy: GenealogyRecord[];
  steps: RecipeStep[];
  lines: ProductionLine[];
  stations: Station[];
  users: MesUser[];
  teams: Team[];
  assignments: Assignment[];
  stepTemplates: StepTemplate[];
  audit: AuditEntry[];
};

type Actions = {
  createWorkOrder: (w: Omit<WorkOrder, "id" | "progress" | "qtyProduced">) => void;
  updateWorkOrder: (id: string, patch: Partial<WorkOrder>) => void;
  deleteWorkOrder: (id: string) => void;
  createDowntime: (d: Omit<DowntimeEvent, "id">) => void;
  updateDowntime: (id: string, patch: Partial<DowntimeEvent>) => void;
  deleteDowntime: (id: string) => void;
  createHold: (h: Omit<QualityHold, "id">) => void;
  updateHold: (id: string, patch: Partial<QualityHold>) => void;
  deleteHold: (id: string) => void;
  createGenealogy: (g: Omit<GenealogyRecord, "id">) => void;
  updateGenealogy: (id: string, patch: Partial<GenealogyRecord>) => void;
  deleteGenealogy: (id: string) => void;
  createStep: (s: Omit<RecipeStep, "id">) => void;
  updateStep: (id: string, patch: Partial<RecipeStep>) => void;
  deleteStep: (id: string) => void;
  createLine: (l: Omit<ProductionLine, "id"> & { id?: string }) => void;
  updateLine: (id: string, patch: Partial<ProductionLine>) => void;
  deleteLine: (id: string) => void;
  createStation: (s: Omit<Station, "id"> & { id?: string }) => void;
  updateStation: (id: string, patch: Partial<Station>) => void;
  deleteStation: (id: string) => void;
  createUser: (u: Omit<MesUser, "id"> & { id?: string }) => void;
  updateUser: (id: string, patch: Partial<MesUser>) => void;
  deleteUser: (id: string) => void;
  createTeam: (t: Omit<Team, "id"> & { id?: string }) => void;
  updateTeam: (id: string, patch: Partial<Team>) => void;
  deleteTeam: (id: string) => void;
  createAssignment: (a: Omit<Assignment, "id"> & { id?: string }) => void;
  updateAssignment: (id: string, patch: Partial<Assignment>) => void;
  deleteAssignment: (id: string) => void;
  createStepTemplate: (t: Omit<StepTemplate, "id"> & { id?: string }) => void;
  updateStepTemplate: (id: string, patch: Partial<StepTemplate>) => void;
  deleteStepTemplate: (id: string) => void;
  /** Apply a step template to a station (idempotent). */
  applyTemplateToStation: (stationId: string, templateId: string) => void;
  /** Remove a step template binding from a station. */
  removeTemplateFromStation: (stationId: string, templateId: string) => void;
  /** Identity of the user driving the UI (used for audit attribution). */
  currentActor: { id: string; name: string };
  setCurrentActor: (actor: { id: string; name: string }) => void;
};

const Ctx = createContext<(State & Actions) | null>(null);
const KEY = "cortanex-mes-v3";

function nextId(prefix: string, list: { id: string }[]) {
  const nums = list
    .map((x) => {
      const m = x.id.match(/(\d+)(?!.*\d)/);
      return m ? parseInt(m[1], 10) : 0;
    })
    .filter((n) => !isNaN(n));
  const max = nums.length ? Math.max(...nums) : 0;
  return `${prefix}${String(max + 1).padStart(3, "0")}`;
}

function diffObject(a: any, b: any) {
  const before: Record<string, any> = {};
  const after: Record<string, any> = {};
  const keys = new Set([...Object.keys(a ?? {}), ...Object.keys(b ?? {})]);
  for (const k of keys) {
    const av = a?.[k];
    const bv = b?.[k];
    if (JSON.stringify(av) !== JSON.stringify(bv)) {
      before[k] = av;
      after[k] = bv;
    }
  }
  return { before, after };
}

function hhmmss() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

// Jitter helpers for the simulated live tick
function jitterNumeric(s: string | undefined, pct = 0.02): string | undefined {
  if (!s) return s;
  const m = s.match(/^([\d.]+)(.*)$/);
  if (!m) return s;
  const n = parseFloat(m[1]);
  if (!isFinite(n)) return s;
  const delta = n * pct * (Math.random() - 0.5) * 2;
  const next = Math.round((n + delta) * 100) / 100;
  return `${next}${m[2]}`;
}

export function MesStoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>(() => ({
    workOrders: seedWO,
    downtime: seedDT,
    holds: seedHolds,
    genealogy: seedGen,
    steps: seedSteps,
    lines: seedLines,
    stations: seedStations,
    users: seedUsers,
    teams: seedTeams,
    assignments: seedAssignments,
    stepTemplates: seedTemplates,
    audit: seedAudit,
  }));

  const [currentActor, setCurrentActor] = useState<{ id: string; name: string }>(
    { id: "U-001", name: "Faisal Al-Mutairi" },
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        setState((s) => ({ ...s, ...parsed }));
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch {}
  }, [state]);

  // ===== Live tick: refresh running automatic stations every 3s
  const tickRef = useRef<number | null>(null);
  useEffect(() => {
    if (typeof window === "undefined") return;
    tickRef.current = window.setInterval(() => {
      setState((s) => {
        const now = hhmmss();
        const stations = s.stations.map((st) => {
          if (st.status !== "running") return { ...st, lastTickAt: st.lastTickAt };
          // Re-render trigger + jitter on numeric currentValue
          return {
            ...st,
            currentValue: jitterNumeric(st.currentValue),
            lastTickAt: now,
          };
        });
        return { ...s, stations };
      });
    }, 3000);
    return () => {
      if (tickRef.current) window.clearInterval(tickRef.current);
    };
  }, []);

  // ===== Audit helper bound to the current state setter
  const audit = (
    entity: AuditEntity,
    entityId: string,
    action: AuditAction,
    before: any,
    after: any,
    summary: string,
  ) => {
    setState((s) => {
      const id = nextId("AU-", s.audit);
      const entry: AuditEntry = {
        id,
        at: new Date().toISOString(),
        actorId: currentActor.id,
        actorName: currentActor.name,
        entity, entityId, action,
        before: before ?? null,
        after: after ?? null,
        summary,
      };
      // Cap log to most recent 500 entries
      const next = [entry, ...s.audit].slice(0, 500);
      return { ...s, audit: next };
    });
  };

  const value = useMemo<State & Actions>(() => ({
    ...state,
    currentActor,
    setCurrentActor,

    // ---------- Work orders
    createWorkOrder: (w) => {
      const newWO = { ...w, id: nextId("WO-2401-", state.workOrders), qtyProduced: 0, progress: 0 } as WorkOrder;
      setState((s) => ({ ...s, workOrders: [newWO, ...s.workOrders] }));
      audit("work_order", newWO.id, "create", null, newWO, `Created work order ${newWO.id}`);
    },
    updateWorkOrder: (id, p) => {
      const before = state.workOrders.find((w) => w.id === id);
      setState((s) => ({
        ...s,
        workOrders: s.workOrders.map((w) => {
          if (w.id !== id) return w;
          const merged = { ...w, ...p };
          merged.progress = Math.min(100, Math.round((merged.qtyProduced / Math.max(1, merged.qtyTarget)) * 100));
          return merged;
        }),
      }));
      const after = { ...(before ?? {}), ...p };
      const d = diffObject(before, after);
      audit("work_order", id, "update", d.before, d.after, `Updated work order ${id}`);
    },
    deleteWorkOrder: (id) => {
      const before = state.workOrders.find((w) => w.id === id);
      setState((s) => ({ ...s, workOrders: s.workOrders.filter((w) => w.id !== id) }));
      audit("work_order", id, "delete", before, null, `Deleted work order ${id}`);
    },

    // ---------- Downtime
    createDowntime: (d) => {
      const id = nextId("DT-", state.downtime);
      // Enrich with operator name from assignment when station provided
      let enriched: DowntimeEvent = { ...d, id };
      if (d.stationId) {
        const activeAsmt = state.assignments.find((a) => a.active && a.targetType === "station" && a.targetId === d.stationId);
        if (activeAsmt && !enriched.assignmentId) enriched.assignmentId = activeAsmt.id;
        const op = state.users.find((u) => u.id === (enriched.operatorId || activeAsmt?.userId));
        if (op) { enriched.operatorId = op.id; enriched.operatorName = op.name; }
      }
      setState((s) => ({ ...s, downtime: [enriched, ...s.downtime] }));
      audit("downtime", id, "create", null, enriched, `Downtime "${enriched.reasonCode}" on ${enriched.stationId ?? enriched.lineId}`);
    },
    updateDowntime: (id, p) => {
      const before = state.downtime.find((d) => d.id === id);
      setState((s) => ({ ...s, downtime: s.downtime.map((d) => (d.id === id ? { ...d, ...p } : d)) }));
      const after = { ...(before ?? {}), ...p };
      const dd = diffObject(before, after);
      audit("downtime", id, "update", dd.before, dd.after, `Updated downtime ${id}`);
    },
    deleteDowntime: (id) => {
      const before = state.downtime.find((d) => d.id === id);
      setState((s) => ({ ...s, downtime: s.downtime.filter((d) => d.id !== id) }));
      audit("downtime", id, "delete", before, null, `Deleted downtime ${id}`);
    },

    // ---------- Holds
    createHold: (h) => {
      const id = nextId("QH-", state.holds);
      const newH = { ...h, id };
      setState((s) => ({ ...s, holds: [newH, ...s.holds] }));
      audit("hold", id, "create", null, newH, `Quality hold raised: ${newH.reason}`);
    },
    updateHold: (id, p) => {
      const before = state.holds.find((h) => h.id === id);
      setState((s) => ({ ...s, holds: s.holds.map((h) => (h.id === id ? { ...h, ...p } : h)) }));
      const dd = diffObject(before, { ...(before ?? {}), ...p });
      audit("hold", id, "update", dd.before, dd.after, `Updated hold ${id}`);
    },
    deleteHold: (id) => {
      const before = state.holds.find((h) => h.id === id);
      setState((s) => ({ ...s, holds: s.holds.filter((h) => h.id !== id) }));
      audit("hold", id, "delete", before, null, `Deleted hold ${id}`);
    },

    // ---------- Genealogy
    createGenealogy: (g) => {
      const id = nextId("G-", state.genealogy);
      const newG = { ...g, id };
      setState((s) => ({ ...s, genealogy: [newG, ...s.genealogy] }));
      audit("genealogy", id, "create", null, newG, `Genealogy record ${id}`);
    },
    updateGenealogy: (id, p) => {
      const before = state.genealogy.find((g) => g.id === id);
      setState((s) => ({ ...s, genealogy: s.genealogy.map((g) => (g.id === id ? { ...g, ...p } : g)) }));
      const dd = diffObject(before, { ...(before ?? {}), ...p });
      audit("genealogy", id, "update", dd.before, dd.after, `Updated genealogy ${id}`);
    },
    deleteGenealogy: (id) => {
      const before = state.genealogy.find((g) => g.id === id);
      setState((s) => ({ ...s, genealogy: s.genealogy.filter((g) => g.id !== id) }));
      audit("genealogy", id, "delete", before, null, `Deleted genealogy ${id}`);
    },

    // ---------- Steps
    createStep: (st) => {
      const id = nextId("S", state.steps);
      const newSt = { ...st, id };
      setState((s) => ({ ...s, steps: [...s.steps, newSt] }));
      audit("step", id, "create", null, newSt, `Step "${newSt.instruction}"`);
    },
    updateStep: (id, p) => {
      const before = state.steps.find((x) => x.id === id);
      setState((s) => ({ ...s, steps: s.steps.map((x) => (x.id === id ? { ...x, ...p } : x)) }));
      const dd = diffObject(before, { ...(before ?? {}), ...p });
      audit("step", id, "update", dd.before, dd.after, `Updated step ${id}`);
    },
    deleteStep: (id) => {
      const before = state.steps.find((x) => x.id === id);
      setState((s) => ({ ...s, steps: s.steps.filter((x) => x.id !== id) }));
      audit("step", id, "delete", before, null, `Deleted step ${id}`);
    },

    // ---------- Lines
    createLine: (l) => {
      const id = l.id || nextId("L-", state.lines);
      const newL = { ...l, id } as ProductionLine;
      setState((s) => ({ ...s, lines: [...s.lines, newL] }));
      audit("line", id, "create", null, newL, `Created line ${id}`);
    },
    updateLine: (id, p) => {
      const before = state.lines.find((l) => l.id === id);
      setState((s) => ({ ...s, lines: s.lines.map((l) => (l.id === id ? { ...l, ...p } : l)) }));
      const dd = diffObject(before, { ...(before ?? {}), ...p });
      audit("line", id, "update", dd.before, dd.after, `Updated line ${id}`);
    },
    deleteLine: (id) => {
      const before = state.lines.find((l) => l.id === id);
      setState((s) => ({
        ...s,
        lines: s.lines.filter((l) => l.id !== id),
        stations: s.stations.filter((st) => st.lineId !== id),
      }));
      audit("line", id, "delete", before, null, `Deleted line ${id} (and its stations)`);
    },

    // ---------- Stations
    createStation: (st) => {
      const id = st.id || nextId("ST-", state.stations);
      const newSt = { ...st, id } as Station;
      setState((s) => ({ ...s, stations: [...s.stations, newSt] }));
      audit("station", id, "create", null, newSt, `Created station ${id} on ${newSt.lineId}`);
    },
    updateStation: (id, p) => {
      const before = state.stations.find((x) => x.id === id);
      setState((s) => ({ ...s, stations: s.stations.map((x) => (x.id === id ? { ...x, ...p } : x)) }));
      const dd = diffObject(before, { ...(before ?? {}), ...p });
      // Suppress tick-only audit noise
      const onlyTick = Object.keys(dd.after).every((k) => k === "lastTickAt" || k === "currentValue");
      if (!onlyTick) audit("station", id, "update", dd.before, dd.after, `Updated station ${id}`);
    },
    deleteStation: (id) => {
      const before = state.stations.find((x) => x.id === id);
      setState((s) => ({
        ...s,
        stations: s.stations.filter((x) => x.id !== id),
        assignments: s.assignments.filter((a) => !(a.targetType === "station" && a.targetId === id)),
      }));
      audit("station", id, "delete", before, null, `Deleted station ${id}`);
    },

    // ---------- Users
    createUser: (u) => {
      const id = u.id || nextId("U-", state.users);
      const newU = { ...u, id } as MesUser;
      setState((s) => ({ ...s, users: [...s.users, newU] }));
      audit("user", id, "create", null, newU, `Created user ${newU.name}`);
    },
    updateUser: (id, p) => {
      const before = state.users.find((u) => u.id === id);
      setState((s) => ({ ...s, users: s.users.map((u) => (u.id === id ? { ...u, ...p } : u)) }));
      const dd = diffObject(before, { ...(before ?? {}), ...p });
      audit("user", id, "update", dd.before, dd.after, `Updated user ${id}`);
    },
    deleteUser: (id) => {
      const before = state.users.find((u) => u.id === id);
      setState((s) => ({
        ...s,
        users: s.users.filter((u) => u.id !== id),
        assignments: s.assignments.filter((a) => a.userId !== id),
      }));
      audit("user", id, "delete", before, null, `Deleted user ${id}`);
    },

    // ---------- Teams
    createTeam: (t) => {
      const id = t.id || nextId("T-", state.teams);
      const newT = { ...t, id, memberIds: t.memberIds || [] } as Team;
      setState((s) => ({ ...s, teams: [...s.teams, newT] }));
      audit("team", id, "create", null, newT, `Created team ${newT.name}`);
    },
    updateTeam: (id, p) => {
      const before = state.teams.find((t) => t.id === id);
      setState((s) => ({ ...s, teams: s.teams.map((t) => (t.id === id ? { ...t, ...p } : t)) }));
      const dd = diffObject(before, { ...(before ?? {}), ...p });
      audit("team", id, "update", dd.before, dd.after, `Updated team ${id}`);
    },
    deleteTeam: (id) => {
      const before = state.teams.find((t) => t.id === id);
      setState((s) => ({
        ...s,
        teams: s.teams.filter((t) => t.id !== id),
        assignments: s.assignments.filter((a) => !(a.targetType === "team" && a.targetId === id)),
      }));
      audit("team", id, "delete", before, null, `Deleted team ${id}`);
    },

    // ---------- Assignments
    createAssignment: (a) => {
      const id = a.id || nextId("AS-", state.assignments);
      const newA = { ...a, id } as Assignment;
      setState((s) => ({ ...s, assignments: [newA, ...s.assignments] }));
      const u = state.users.find((x) => x.id === newA.userId);
      audit("assignment", id, "create", null, newA, `Assigned ${u?.name ?? newA.userId} → ${newA.targetType} ${newA.targetId}`);
    },
    updateAssignment: (id, p) => {
      const before = state.assignments.find((a) => a.id === id);
      setState((s) => ({ ...s, assignments: s.assignments.map((a) => (a.id === id ? { ...a, ...p } : a)) }));
      const after = { ...(before ?? {}), ...p };
      const dd = diffObject(before, after);
      // Specialize action when only "active" flipped
      const onlyActive = Object.keys(dd.after).length === 1 && "active" in dd.after;
      const action: AuditAction = onlyActive ? (after.active ? "activate" : "deactivate") : "update";
      audit("assignment", id, action, dd.before, dd.after, `Assignment ${id} ${action}d`);
    },
    deleteAssignment: (id) => {
      const before = state.assignments.find((a) => a.id === id);
      setState((s) => ({ ...s, assignments: s.assignments.filter((a) => a.id !== id) }));
      audit("assignment", id, "delete", before, null, `Deleted assignment ${id}`);
    },

    // ---------- Step Templates
    createStepTemplate: (t) => {
      const id = t.id || nextId("TPL-", state.stepTemplates);
      const newT = { ...t, id } as StepTemplate;
      setState((s) => ({ ...s, stepTemplates: [...s.stepTemplates, newT] }));
      audit("step_template", id, "create", null, newT, `Created template "${newT.name}"`);
    },
    updateStepTemplate: (id, p) => {
      const before = state.stepTemplates.find((t) => t.id === id);
      setState((s) => ({ ...s, stepTemplates: s.stepTemplates.map((t) => (t.id === id ? { ...t, ...p } : t)) }));
      const dd = diffObject(before, { ...(before ?? {}), ...p });
      audit("step_template", id, "update", dd.before, dd.after, `Updated template ${id}`);
    },
    deleteStepTemplate: (id) => {
      const before = state.stepTemplates.find((t) => t.id === id);
      setState((s) => ({
        ...s,
        stepTemplates: s.stepTemplates.filter((t) => t.id !== id),
        stations: s.stations.map((st) => ({
          ...st,
          templateIds: st.templateIds?.filter((t) => t !== id),
        })),
      }));
      audit("step_template", id, "delete", before, null, `Deleted template ${id}`);
    },

    applyTemplateToStation: (stationId, templateId) => {
      const st = state.stations.find((x) => x.id === stationId);
      if (!st) return;
      const cur = st.templateIds ?? [];
      if (cur.includes(templateId)) return;
      const next = [...cur, templateId];
      setState((s) => ({ ...s, stations: s.stations.map((x) => (x.id === stationId ? { ...x, templateIds: next } : x)) }));
      const tpl = state.stepTemplates.find((t) => t.id === templateId);
      audit("station", stationId, "update", { templateIds: cur }, { templateIds: next },
        `Applied template "${tpl?.name ?? templateId}" to ${stationId}`);
    },
    removeTemplateFromStation: (stationId, templateId) => {
      const st = state.stations.find((x) => x.id === stationId);
      if (!st) return;
      const cur = st.templateIds ?? [];
      const next = cur.filter((t) => t !== templateId);
      setState((s) => ({ ...s, stations: s.stations.map((x) => (x.id === stationId ? { ...x, templateIds: next } : x)) }));
      audit("station", stationId, "update", { templateIds: cur }, { templateIds: next },
        `Removed template ${templateId} from ${stationId}`);
    },
  }), [state, currentActor]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useMes() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useMes must be used inside MesStoreProvider");
  return v;
}

export function resetMesStore() {
  if (typeof window !== "undefined") {
    localStorage.removeItem(KEY);
    location.reload();
  }
}
