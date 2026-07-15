import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import type { ProductionOrder } from "./production-orders-db";

export type ProductionBatch = Database["public"]["Tables"]["production_batches"]["Row"];
export type BatchInsert = Database["public"]["Tables"]["production_batches"]["Insert"];
export const batchStatuses = ["scheduled", "released", "running", "paused", "hold", "completed", "cancelled"] as const;

export const batchesKey = ["production_batches"] as const;

function pad(n: number, len = 3) { return String(n).padStart(len, "0"); }

/** Batch lot: {ORDER_LOT}-B{NN} */
export function makeBatchLot(orderLot: string, seq: number) {
  return `${orderLot}-B${pad(seq, 2)}`;
}
/** Batch number: {PO#}-B{NN} */
export function makeBatchNumber(poNumber: string, seq: number) {
  return `${poNumber}-B${pad(seq, 2)}`;
}

export function useBatches(orderId?: string) {
  return useQuery({
    queryKey: [...batchesKey, orderId ?? "all"],
    queryFn: async () => {
      let q = supabase.from("production_batches").select("*").order("sequence", { ascending: true });
      if (orderId) q = q.eq("production_order_id", orderId);
      const { data, error } = await q.limit(1000);
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useBatch(id: string | undefined) {
  return useQuery({
    queryKey: ["production_batch", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase.from("production_batches").select("*").eq("id", id!).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

/** Split an order into N equal-ish batches (idempotent by sequence). */
export function useSplitOrderIntoBatches() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ po, count, sizes }: { po: ProductionOrder; count: number; sizes?: number[] }) => {
      const { data: existing } = await supabase
        .from("production_batches").select("sequence")
        .eq("production_order_id", po.id).order("sequence", { ascending: false }).limit(1);
      const startSeq = (existing?.[0]?.sequence ?? 0) + 1;

      const totalQty = Number(po.qty);
      const finalSizes = sizes && sizes.length === count
        ? sizes
        : Array.from({ length: count }, (_, i) => {
            const base = Math.floor(totalQty / count);
            const rem = totalQty - base * count;
            return base + (i < rem ? 1 : 0);
          });

      const rows: BatchInsert[] = finalSizes.map((qty, i) => {
        const seq = startSeq + i;
        const number = makeBatchNumber(po.number, seq);
        return {
          id: number,
          number,
          lot_number: makeBatchLot(po.lot_number, seq),
          production_order_id: po.id,
          sequence: seq,
          sku: po.sku,
          product_name: po.product_name,
          product_id: po.product_id,
          qty,
          uom: po.uom,
          status: "scheduled",
          line_id: po.line_id,
          priority: po.priority,
          shift: po.shift,
        };
      });

      if (rows.length === 0) return [];
      const { data, error } = await supabase.from("production_batches").insert(rows).select();
      if (error) throw error;
      return data ?? [];
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: batchesKey }),
  });
}

export function useUpdateBatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<ProductionBatch> }) => {
      const { data, error } = await supabase.from("production_batches").update(patch).eq("id", id).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: batchesKey });
      qc.invalidateQueries({ queryKey: ["production_batch", v.id] });
    },
  });
}

export function useDeleteBatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("production_batches").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: batchesKey }),
  });
}

export function useBatchesRealtime() {
  const qc = useQueryClient();
  useEffect(() => {
    const ch = supabase.channel("rt-batches")
      .on("postgres_changes", { event: "*", schema: "public", table: "production_batches" }, () => {
        qc.invalidateQueries({ queryKey: batchesKey });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);
}
