import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  workOrders as seedWO,
  downtime as seedDT,
  holds as seedHolds,
  genealogy as seedGen,
  recipeSteps as seedSteps,
  lines as seedLines,
  type WorkOrder,
  type DowntimeEvent,
  type QualityHold,
  type GenealogyRecord,
  type RecipeStep,
  type ProductionLine,
} from "./mes-data";

type State = {
  workOrders: WorkOrder[];
  downtime: DowntimeEvent[];
  holds: QualityHold[];
  genealogy: GenealogyRecord[];
  steps: RecipeStep[];
  lines: ProductionLine[];
};

type Actions = {
  // Work orders
  createWorkOrder: (w: Omit<WorkOrder, "id" | "progress" | "qtyProduced">) => void;
  updateWorkOrder: (id: string, patch: Partial<WorkOrder>) => void;
  deleteWorkOrder: (id: string) => void;
  // Downtime
  createDowntime: (d: Omit<DowntimeEvent, "id">) => void;
  updateDowntime: (id: string, patch: Partial<DowntimeEvent>) => void;
  deleteDowntime: (id: string) => void;
  // Holds
  createHold: (h: Omit<QualityHold, "id">) => void;
  updateHold: (id: string, patch: Partial<QualityHold>) => void;
  deleteHold: (id: string) => void;
  // Genealogy
  createGenealogy: (g: Omit<GenealogyRecord, "id">) => void;
  updateGenealogy: (id: string, patch: Partial<GenealogyRecord>) => void;
  deleteGenealogy: (id: string) => void;
  // Steps
  createStep: (s: Omit<RecipeStep, "id">) => void;
  updateStep: (id: string, patch: Partial<RecipeStep>) => void;
  deleteStep: (id: string) => void;
  // Lines
  createLine: (l: Omit<ProductionLine, "id"> & { id?: string }) => void;
  updateLine: (id: string, patch: Partial<ProductionLine>) => void;
  deleteLine: (id: string) => void;
};

const Ctx = createContext<(State & Actions) | null>(null);

const KEY = "cortanex-mes-v1";

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
  }));

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setState(JSON.parse(raw));
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
    deleteLine: (id) => setState((s) => ({ ...s, lines: s.lines.filter((l) => l.id !== id) })),
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
