import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import type { ProductionBatch } from "./batches-db";

export type ProductUnit = Database["public"]["Tables"]["product_units"]["Row"];
export type UnitEvent = Database["public"]["Tables"]["unit_events"]["Row"];

export const unitsKey = ["product_units"] as const;
export const unitEventsKey = ["unit_events"] as const;

function pad(n: number, len = 5) { return String(n).padStart(len, "0"); }

/** UID: {BATCH_LOT}-U{NNNNN} */
export function makeUnitUid(lotNumber: string, serial: number) {
  return `${lotNumber}-U${pad(serial)}`;
}

export function useUnits(filter?: { po?: string; batch?: string; lot?: string; station?: string; limit?: number }) {
  return useQuery({
    queryKey: [...unitsKey, filter ?? {}],
    queryFn: async () => {
      let q = supabase.from("product_units").select("*").order("serial", { ascending: true });
      if (filter?.po) q = q.eq("production_order_id", filter.po);
      if (filter?.batch) q = q.eq("batch_id", filter.batch);
      if (filter?.lot) q = q.eq("lot_number", filter.lot);
      if (filter?.station) q = q.eq("current_station_id", filter.station);
      const { data, error } = await q.limit(filter?.limit ?? 1000);
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useUnit(uid: string | undefined) {
  return useQuery({
    queryKey: ["product_unit", uid],
    enabled: !!uid,
    queryFn: async () => {
      const { data, error } = await supabase.from("product_units").select("*").eq("uid", uid!).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useUnitEvents(uid: string | undefined) {
  return useQuery({
    queryKey: ["unit_events", uid],
    enabled: !!uid,
    queryFn: async () => {
      const { data, error } = await supabase.from("unit_events").select("*").eq("unit_uid", uid!)
        .order("entered_at", { ascending: true, nullsFirst: true }).order("at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useRecentUnitEvents(limit = 30) {
  return useQuery({
    queryKey: [...unitEventsKey, "recent", limit],
    queryFn: async () => {
      const { data, error } = await supabase.from("unit_events").select("*").order("at", { ascending: false }).limit(limit);
      if (error) throw error;
      return data ?? [];
    },
  });
}

/** Events currently "in station" (entered_at set, exited_at null) */
export function useOpenStationVisits(filter?: { station?: string }) {
  return useQuery({
    queryKey: [...unitEventsKey, "open", filter ?? {}],
    queryFn: async () => {
      let q = supabase.from("unit_events").select("*").is("exited_at", null).not("entered_at", "is", null);
      if (filter?.station) q = q.eq("station_id", filter.station);
      const { data, error } = await q.order("entered_at", { ascending: false }).limit(500);
      if (error) throw error;
      return data ?? [];
    },
  });
}

/** Generate units for a batch (up to qty). */
export function useGenerateUnits() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ batch, count }: { batch: ProductionBatch; count: number }) => {
      const { data: existing } = await supabase
        .from("product_units").select("serial").eq("batch_id", batch.id).order("serial", { ascending: false }).limit(1);
      const startSerial = (existing?.[0]?.serial ?? 0) + 1;
      const rows = Array.from({ length: count }, (_, i) => {
        const serial = startSerial + i;
        return {
          uid: makeUnitUid(batch.lot_number, serial),
          serial,
          lot_number: batch.lot_number,
          batch_id: batch.id,
          production_order_id: batch.production_order_id,
          product_id: batch.product_id,
          sku: batch.sku,
          product_name: batch.product_name,
          status: "created",
        };
      });
      if (rows.length === 0) return [];
      const { data, error } = await supabase.from("product_units").insert(rows).select();
      if (error) throw error;
      return data ?? [];
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: unitsKey }),
  });
}

type ProcessArgs = {
  unit_uid: string;
  station_id: string;
  station_name?: string;
  line_id?: string;
  /** enter / started open a visit; exit_pass / exit_reject / exit_complete
   * (or legacy processed / rejected / completed) closes the latest open one. */
  event: string;
  result?: string;
  operator_id?: string;
  operator_name?: string;
  notes?: string;
  batch_id?: string | null;
};

/** Record a station enter/exit event with second-level timestamps. */
export function useProcessUnitAtStation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: ProcessArgs) => {
      const nowIso = new Date().toISOString();
      const isEnter = v.event === "enter" || v.event === "started";
      const isExit = !isEnter;

      // Try to close an open visit for this unit+station first
      let closed: UnitEvent | null = null;
      if (isExit) {
        const { data: open } = await supabase.from("unit_events")
          .select("*").eq("unit_uid", v.unit_uid).eq("station_id", v.station_id)
          .is("exited_at", null).order("entered_at", { ascending: false }).limit(1).maybeSingle();
        if (open?.id) {
          const enteredAt = open.entered_at ?? open.at ?? nowIso;
          const dwell = Math.max(0, Math.round((new Date(nowIso).getTime() - new Date(enteredAt).getTime()) / 1000));
          const finalEvent =
            v.event === "exit_reject" || v.event === "rejected" ? "rejected"
            : v.event === "exit_complete" || v.event === "completed" ? "completed"
            : "processed";
          const { data, error } = await supabase.from("unit_events").update({
            exited_at: nowIso, dwell_seconds: dwell, event: finalEvent,
            result: v.event === "exit_reject" || v.event === "rejected" ? "fail" : "pass",
            notes: v.notes ?? open.notes,
          }).eq("id", open.id).select().single();
          if (error) throw error;
          closed = data;
        }
      }

      if (!closed) {
        // Insert a new event row (enter, or exit-without-prior-enter which becomes an instant visit)
        const eventId = `UE-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        const eventLabel =
          v.event === "enter" || v.event === "started" ? "started"
          : v.event === "exit_reject" || v.event === "rejected" ? "rejected"
          : v.event === "exit_complete" || v.event === "completed" ? "completed"
          : "processed";
        const enteredAt = nowIso;
        const exitedAt = isEnter ? null : nowIso;
        const { data, error } = await supabase.from("unit_events").insert({
          id: eventId,
          unit_uid: v.unit_uid,
          station_id: v.station_id,
          station_name: v.station_name,
          line_id: v.line_id,
          batch_id: v.batch_id ?? null,
          production_order_id: v.production_order_id ?? null,
          event: eventLabel,
          result: v.event === "exit_reject" || v.event === "rejected" ? "fail" : (isExit ? "pass" : null),
          operator_id: v.operator_id,
          operator_name: v.operator_name,
          notes: v.notes,
          entered_at: enteredAt,
          exited_at: exitedAt,
          dwell_seconds: isEnter ? null : 0,
        }).select().single();
        if (error) throw error;
        closed = data;
      }

      // Update the unit's snapshot
      const status =
        v.event === "exit_reject" || v.event === "rejected" ? "rejected"
        : v.event === "exit_complete" || v.event === "completed" ? "completed"
        : isEnter ? "in_process" : "in_process";
      const patch: Database["public"]["Tables"]["product_units"]["Update"] = {
        current_station_id: v.station_id,
        current_line_id: v.line_id,
        status,
        ...(status === "completed" ? { completed_at: nowIso } : {}),
        ...(isEnter ? { produced_at: nowIso } : {}),
      };
      const { error: e2 } = await supabase.from("product_units").update(patch).eq("uid", v.unit_uid);
      if (e2) throw e2;
      return closed;
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: unitsKey });
      qc.invalidateQueries({ queryKey: ["product_unit", v.unit_uid] });
      qc.invalidateQueries({ queryKey: ["unit_events", v.unit_uid] });
      qc.invalidateQueries({ queryKey: unitEventsKey });
    },
  });
}

export function useDeleteUnit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (uid: string) => {
      const { error } = await supabase.from("product_units").delete().eq("uid", uid);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: unitsKey }),
  });
}

export function useUnitsRealtime() {
  const qc = useQueryClient();
  useEffect(() => {
    const chU = supabase.channel("rt-units")
      .on("postgres_changes", { event: "*", schema: "public", table: "product_units" }, () => {
        qc.invalidateQueries({ queryKey: unitsKey });
      })
      .subscribe();
    const chE = supabase.channel("rt-unit-events")
      .on("postgres_changes", { event: "*", schema: "public", table: "unit_events" }, () => {
        qc.invalidateQueries({ queryKey: unitEventsKey });
      })
      .subscribe();
    return () => { supabase.removeChannel(chU); supabase.removeChannel(chE); };
  }, [qc]);
}
