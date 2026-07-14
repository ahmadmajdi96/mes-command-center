import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type ProductionOrder = Database["public"]["Tables"]["production_orders"]["Row"];
export type PoInsert = Database["public"]["Tables"]["production_orders"]["Insert"];
export const poStatuses = ["scheduled", "released", "running", "paused", "hold", "completed", "cancelled"] as const;

export const productionOrdersKey = ["production_orders"] as const;

function pad(n: number, len = 3) { return String(n).padStart(len, "0"); }

/** LOT-{SKU3}-{YYMMDD}-{NNN} */
export function generateLotNumber(sku: string, existing: { lot_number: string }[]) {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(2);
  const mm = pad(now.getMonth() + 1, 2);
  const dd = pad(now.getDate(), 2);
  const skuPart = (sku || "SKU").replace(/[^A-Z0-9]/gi, "").slice(0, 6).toUpperCase();
  const prefix = `LOT-${skuPart}-${yy}${mm}${dd}`;
  const seq = existing.filter((e) => e.lot_number.startsWith(prefix)).length + 1;
  return `${prefix}-${pad(seq)}`;
}

/** PO-{YYMMDD}-{NNN} */
export function generatePoNumber(existing: { number: string }[]) {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(2);
  const mm = pad(now.getMonth() + 1, 2);
  const dd = pad(now.getDate(), 2);
  const prefix = `PO-${yy}${mm}${dd}`;
  const seq = existing.filter((e) => e.number.startsWith(prefix)).length + 1;
  return `${prefix}-${pad(seq)}`;
}

export function useProductionOrders() {
  return useQuery({
    queryKey: productionOrdersKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("production_orders").select("*")
        .order("planned_start", { ascending: true, nullsFirst: false })
        .limit(500);
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useProductionOrder(id: string | undefined) {
  return useQuery({
    queryKey: ["production_order", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase.from("production_orders").select("*").eq("id", id!).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useCreatePo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Omit<PoInsert, "id" | "number" | "lot_number"> & { id?: string; number?: string; lot_number?: string }) => {
      const all = qc.getQueryData<ProductionOrder[]>(productionOrdersKey) ?? [];
      const number = input.number ?? generatePoNumber(all);
      const lot = input.lot_number ?? generateLotNumber(input.sku, all);
      const id = input.id ?? number;
      const { data, error } = await supabase
        .from("production_orders")
        .insert({ ...input, id, number, lot_number: lot })
        .select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: productionOrdersKey }),
  });
}

export function useUpdatePo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<ProductionOrder> }) => {
      const { data, error } = await supabase.from("production_orders").update(patch).eq("id", id).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: productionOrdersKey });
      qc.invalidateQueries({ queryKey: ["production_order", v.id] });
    },
  });
}

export function useDeletePo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("production_orders").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: productionOrdersKey }),
  });
}

export function usePosRealtime() {
  const qc = useQueryClient();
  useEffect(() => {
    const ch = supabase.channel("rt-pos")
      .on("postgres_changes", { event: "*", schema: "public", table: "production_orders" }, () => {
        qc.invalidateQueries({ queryKey: productionOrdersKey });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);
}
