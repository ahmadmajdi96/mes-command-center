import { useCallback, useEffect, useState } from "react";
import type { MesUser, UserRole } from "@/lib/mes-data";

export type ShiftDef = { code: string; name: string; start: number; end: number; color: string; breakMin: number; minStaff: Record<UserRole, number> };
export type Rota = Record<string, Record<string, string>>; // date -> userId -> shift code | "OFF" | "LEAVE"

export const DEFAULT_SHIFTS: ShiftDef[] = [
  { code: "A", name: "Morning", start: 6, end: 14, color: "var(--color-primary)", breakMin: 30, minStaff: { operator: 3, supervisor: 1, team_lead: 1 } },
  { code: "B", name: "Afternoon", start: 14, end: 22, color: "var(--color-accent)", breakMin: 30, minStaff: { operator: 2, supervisor: 1, team_lead: 1 } },
  { code: "C", name: "Night", start: 22, end: 6, color: "var(--color-info)", breakMin: 45, minStaff: { operator: 2, supervisor: 0, team_lead: 1 } },
];
const KEY = "cortanex-shifts-v1";
export const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export function shiftHours(s: ShiftDef) { return ((s.end - s.start + 24) % 24) || 24; }
export function inShift(s: ShiftDef, hour: number) {
  return s.start < s.end ? hour >= s.start && hour < s.end : hour >= s.start || hour < s.end;
}

export function useShifts(users: MesUser[]) {
  const [shifts, setShifts] = useState<ShiftDef[]>(DEFAULT_SHIFTS);
  const [rota, setRota] = useState<Rota>({});
  const [ready, setReady] = useState(false);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) { const p = JSON.parse(raw); if (p.shifts) setShifts(p.shifts); if (p.rota) setRota(p.rota); }
    } catch { /* ignore */ }
    setReady(true);
  }, []);
  useEffect(() => { if (ready) localStorage.setItem(KEY, JSON.stringify({ shifts, rota })); }, [shifts, rota, ready]);

  /** Planned code for a user on a date — explicit roster entry, else default pattern (user's shift, Fri/Sat off). */
  const codeFor = useCallback((u: MesUser, d: Date) => {
    const k = dayKey(d);
    const v = rota[k]?.[u.id];
    if (v) return v;
    if (u.status === "inactive") return "OFF";
    const dow = d.getDay();
    return dow === 5 || dow === 6 ? "OFF" : u.shift;
  }, [rota]);

  const setCode = (userId: string, d: Date, code: string) =>
    setRota((r) => ({ ...r, [dayKey(d)]: { ...(r[dayKey(d)] ?? {}), [userId]: code } }));
  const clearWeek = (days: Date[]) => setRota((r) => { const n = { ...r }; days.forEach((d) => delete n[dayKey(d)]); return n; });
  const updateShift = (code: string, p: Partial<ShiftDef>) => setShifts((s) => s.map((x) => (x.code === code ? { ...x, ...p } : x)));
  const addShift = (d: ShiftDef) => setShifts((s) => [...s, d]);
  const removeShift = (code: string) => setShifts((s) => s.filter((x) => x.code !== code));
  void users;
  return { shifts, rota, codeFor, setCode, clearWeek, updateShift, addShift, removeShift };
}
