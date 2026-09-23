import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { setOrderStatus, setBatchStatus, nextStatuses } from "./mes/orders.functions";
import { recordLotProgress, sendToRework } from "./mes/execution.functions";
import { productionOrdersKey } from "./production-orders-db";
import { batchesKey } from "./batches-db";
import { unitsKey } from "./units-db";

export type LotProgress = Database["public"]["Tables"]["batch_station_progress"]["Row"];

export { nextStatuses };

/** Tracking mode and route enforcement of a line (serial = per item, lot = quantities). */
export function useLineRules(lineId?: string | null) {
  return useQuery({
    queryKey: ["line_rules", lineId],
    enabled: !!lineId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lines")
        .select("id, tracking_mode, enforce_route")
        .eq("id", lineId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useSetOrderStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: string; status: string; reason?: string }) => setOrderStatus({ data: v }),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: productionOrdersKey });
      qc.invalidateQueries({ queryKey: ["production_order", v.id] });
    },
  });
}

export function useSetBatchStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: string; status: string; reason?: string }) => setBatchStatus({ data: v }),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: batchesKey });
      qc.invalidateQueries({ queryKey: ["production_batch", v.id] });
      qc.invalidateQueries({ queryKey: productionOrdersKey });
    },
  });
}

export function useSendToRework() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { unit_uid: string; reason: string; station_id?: string | null }) =>
      sendToRework({ data: v }),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: unitsKey });
      qc.invalidateQueries({ queryKey: ["product_unit", v.unit_uid] });
      qc.invalidateQueries({ queryKey: ["unit_events", v.unit_uid] });
    },
  });
}

export const lotProgressKey = ["batch_station_progress"] as const;

export function useLotProgress(filter?: { batch_id?: string; station_id?: string; limit?: number }) {
  return useQuery({
    queryKey: [...lotProgressKey, filter ?? {}],
    queryFn: async () => {
      let q = supabase
        .from("batch_station_progress")
        .select("*")
        .order("created_at", { ascending: false });
      if (filter?.batch_id) q = q.eq("batch_id", filter.batch_id);
      if (filter?.station_id) q = q.eq("station_id", filter.station_id);
      const { data, error } = await q.limit(filter?.limit ?? 200);
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useRecordLotProgress() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: {
      batch_id: string;
      station_id: string;
      qty_in?: number;
      qty_good?: number;
      qty_rework?: number;
      qty_scrap?: number;
      scrap_reason_code?: string | null;
      notes?: string;
    }) => recordLotProgress({ data: v }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: lotProgressKey });
      qc.invalidateQueries({ queryKey: batchesKey });
      qc.invalidateQueries({ queryKey: productionOrdersKey });
    },
  });
}
