import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import type { ProductionOrder } from "./production-orders-db";

export type ProductUnit = Database["public"]["Tables"]["product_units"]["Row"];
export type UnitEvent = Database["public"]["Tables"]["unit_events"]["Row"];

export const unitsKey = ["product_units"] as const;
export const unitEventsKey = ["unit_events"] as const;

function pad(n: number, len = 5) { return String(n).padStart(len, "0"); }

/** UID: {LOT}-U{NNNNN} — machine-scannable, human-readable */
export function makeUnitUid(lotNumber: string, serial: number) {
  return `${lotNumber}-U${pad(serial)}`;
}

export function useUnits(filter?: { po?: string; lot?: string; station?: string; limit?: number }) {
  return useQuery({
    queryKey: [...unitsKey, filter ?? {}],
    queryFn: async () => {
      let q = supabase.from("product_units").select("*").order("serial", { ascending: true });
      if (filter?.po) q = q.eq("production_order_id", filter.po);
      if (filter?.lot) q = q.eq("lot_number", filter.lot);
      if (filter?.station) q = q.eq("current_station_id", filter.station);
      const { data, error } = await q.limit(filter?.limit ?? 500);
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
      const { data, error } = await supabase.from("unit_events").select("*").eq("unit_uid", uid!).order("at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

/** Latest N events across all units, for tracking overview */
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

/** Generate units for a production order (up to qty). Idempotent by serial. */
export function useGenerateUnits() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ po, count }: { po: ProductionOrder; count: number }) => {
      // Find current max serial for this PO
      const { data: existing } = await supabase
        .from("product_units").select("serial").eq("production_order_id", po.id).order("serial", { ascending: false }).limit(1);
      const startSerial = (existing?.[0]?.serial ?? 0) + 1;
      const rows = Array.from({ length: count }, (_, i) => {
        const serial = startSerial + i;
        return {
          uid: makeUnitUid(po.lot_number, serial),
          serial,
          lot_number: po.lot_number,
          production_order_id: po.id,
          product_id: po.product_id,
          sku: po.sku,
          product_name: po.product_name,
          status: "created",
        };
      });
      if (rows.length === 0) return [];
      const { data, error } = await supabase.from("product_units").insert(rows).select();
      if (error) throw error;
      return data ?? [];
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: unitsKey });
    },
  });
}

/** Record a station processing event and update unit's current station */
export function useProcessUnitAtStation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: {
      unit_uid: string;
      station_id: string;
      station_name?: string;
      line_id?: string;
      event?: string;   // "processed" | "started" | "rejected" | "completed"
      result?: string;
      operator_id?: string;
      operator_name?: string;
      notes?: string;
    }) => {
      const eventId = `UE-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const event = v.event ?? "processed";
      const { data: ev, error: e1 } = await supabase.from("unit_events").insert({
        id: eventId,
        unit_uid: v.unit_uid,
        station_id: v.station_id,
        station_name: v.station_name,
        line_id: v.line_id,
        event,
        result: v.result,
        operator_id: v.operator_id,
        operator_name: v.operator_name,
        notes: v.notes,
      }).select().single();
      if (e1) throw e1;

      const nowIso = new Date().toISOString();
      const patch: Database["public"]["Tables"]["product_units"]["Update"] = {
        current_station_id: v.station_id,
        current_line_id: v.line_id,
        status: event === "completed" ? "completed" : event === "rejected" ? "rejected" : "in_process",
        ...(event === "completed" ? { completed_at: nowIso } : {}),
        ...(event === "started" || event === "processed" ? { produced_at: nowIso } : {}),
      };
      const { error: e2 } = await supabase.from("product_units").update(patch).eq("uid", v.unit_uid);
      if (e2) throw e2;
      return ev;
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: unitsKey });
      qc.invalidateQueries({ queryKey: ["product_unit", v.unit_uid] });
      qc.invalidateQueries({ queryKey: ["unit_events", v.unit_uid] });
      qc.invalidateQueries({ queryKey: [...unitEventsKey, "recent"] });
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
