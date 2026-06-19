import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
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
};

const Ctx = createContext<(State & Actions) | null>(null);
const KEY = "cortanex-mes-v2";

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
  }));

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        // Merge to ensure newly added entity arrays exist even on older caches
        setState((s) => ({ ...s, ...parsed }));
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch {}
  }, [state]);

  const value = useMemo<State & Actions>(() => ({
    ...state,
    createWorkOrder: (w) =>
      setState((s) => ({
        ...s,
        workOrders: [
          { ...w, id: nextId("WO-2401-", s.workOrders), qtyProduced: 0, progress: 0 } as WorkOrder,
          ...s.workOrders,
        ],
      })),
    updateWorkOrder: (id, p) =>
      setState((s) => ({
        ...s,
        workOrders: s.workOrders.map((w) => {
          if (w.id !== id) return w;
          const merged = { ...w, ...p };
          merged.progress = Math.min(100, Math.round((merged.qtyProduced / Math.max(1, merged.qtyTarget)) * 100));
          return merged;
        }),
      })),
    deleteWorkOrder: (id) => setState((s) => ({ ...s, workOrders: s.workOrders.filter((w) => w.id !== id) })),

    createDowntime: (d) => setState((s) => ({ ...s, downtime: [{ ...d, id: nextId("DT-", s.downtime) }, ...s.downtime] })),
    updateDowntime: (id, p) => setState((s) => ({ ...s, downtime: s.downtime.map((d) => (d.id === id ? { ...d, ...p } : d)) })),
    deleteDowntime: (id) => setState((s) => ({ ...s, downtime: s.downtime.filter((d) => d.id !== id) })),

    createHold: (h) => setState((s) => ({ ...s, holds: [{ ...h, id: nextId("QH-", s.holds) }, ...s.holds] })),
    updateHold: (id, p) => setState((s) => ({ ...s, holds: s.holds.map((h) => (h.id === id ? { ...h, ...p } : h)) })),
    deleteHold: (id) => setState((s) => ({ ...s, holds: s.holds.filter((h) => h.id !== id) })),

    createGenealogy: (g) => setState((s) => ({ ...s, genealogy: [{ ...g, id: nextId("G-", s.genealogy) }, ...s.genealogy] })),
    updateGenealogy: (id, p) => setState((s) => ({ ...s, genealogy: s.genealogy.map((g) => (g.id === id ? { ...g, ...p } : g)) })),
    deleteGenealogy: (id) => setState((s) => ({ ...s, genealogy: s.genealogy.filter((g) => g.id !== id) })),

    createStep: (st) => setState((s) => ({ ...s, steps: [...s.steps, { ...st, id: nextId("S", s.steps) }] })),
    updateStep: (id, p) => setState((s) => ({ ...s, steps: s.steps.map((x) => (x.id === id ? { ...x, ...p } : x)) })),
    deleteStep: (id) => setState((s) => ({ ...s, steps: s.steps.filter((x) => x.id !== id) })),

    createLine: (l) => setState((s) => ({ ...s, lines: [...s.lines, { ...l, id: l.id || nextId("L-", s.lines) } as ProductionLine] })),
    updateLine: (id, p) => setState((s) => ({ ...s, lines: s.lines.map((l) => (l.id === id ? { ...l, ...p } : l)) })),
    deleteLine: (id) => setState((s) => ({
      ...s,
      lines: s.lines.filter((l) => l.id !== id),
      stations: s.stations.filter((st) => st.lineId !== id),
    })),

    createStation: (st) => setState((s) => ({
      ...s,
      stations: [...s.stations, { ...st, id: st.id || nextId("ST-", s.stations) } as Station],
    })),
    updateStation: (id, p) => setState((s) => ({ ...s, stations: s.stations.map((x) => (x.id === id ? { ...x, ...p } : x)) })),
    deleteStation: (id) => setState((s) => ({
      ...s,
      stations: s.stations.filter((x) => x.id !== id),
      assignments: s.assignments.filter((a) => !(a.targetType === "station" && a.targetId === id)),
    })),

    createUser: (u) => setState((s) => ({ ...s, users: [...s.users, { ...u, id: u.id || nextId("U-", s.users) } as MesUser] })),
    updateUser: (id, p) => setState((s) => ({ ...s, users: s.users.map((u) => (u.id === id ? { ...u, ...p } : u)) })),
    deleteUser: (id) => setState((s) => ({
      ...s,
      users: s.users.filter((u) => u.id !== id),
      assignments: s.assignments.filter((a) => a.userId !== id),
    })),

    createTeam: (t) => setState((s) => ({ ...s, teams: [...s.teams, { ...t, id: t.id || nextId("T-", s.teams), memberIds: t.memberIds || [] } as Team] })),
    updateTeam: (id, p) => setState((s) => ({ ...s, teams: s.teams.map((t) => (t.id === id ? { ...t, ...p } : t)) })),
    deleteTeam: (id) => setState((s) => ({
      ...s,
      teams: s.teams.filter((t) => t.id !== id),
      assignments: s.assignments.filter((a) => !(a.targetType === "team" && a.targetId === id)),
    })),

    createAssignment: (a) => setState((s) => ({ ...s, assignments: [{ ...a, id: a.id || nextId("AS-", s.assignments) } as Assignment, ...s.assignments] })),
    updateAssignment: (id, p) => setState((s) => ({ ...s, assignments: s.assignments.map((a) => (a.id === id ? { ...a, ...p } : a)) })),
    deleteAssignment: (id) => setState((s) => ({ ...s, assignments: s.assignments.filter((a) => a.id !== id) })),
  }), [state]);

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
