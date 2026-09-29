import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/** Company of the signed-in person (first one when several). */
export function useMyOrg() {
  return useQuery({
    queryKey: ["my_org"],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return null;
      const { data } = await supabase.rpc("user_orgs" as never, { _user_id: u.user.id } as never);
      const rows = (data ?? []) as { organization_id: string }[];
      if (rows[0]) return rows[0].organization_id;
      const { data: org } = await supabase.from("organizations").select("id").limit(1).maybeSingle();
      return (org as { id?: string } | null)?.id ?? null;
    },
  });
}

function useRpc(fn: string, keys: string[][]) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: Record<string, unknown>) => {
      const { data, error } = await supabase.rpc(fn as never, args as never);
      if (error) throw error;
      return data as unknown;
    },
    onSuccess: () => keys.forEach((k) => qc.invalidateQueries({ queryKey: k })),
  });
}

const K = [["exec"], ["production_batches"], ["production_batch"]];
export const useMoveBatch = () => useRpc("move_batch", K);
export const useSplitBatch = () => useRpc("split_batch", K);
export const useMergeBatches = () => useRpc("merge_batches", K);

/** Hours a batch has been sitting at its current location. */
export function ageHours(b: { located_at?: string | null; created_at?: string }) {
  const t = b.located_at ?? b.created_at;
  return t ? (Date.now() - new Date(t).getTime()) / 3_600_000 : 0;
}

export const unprocessed = (b: { qty: number | string; qty_produced: number | string; qty_scrap: number | string }) =>
  Math.max(0, Number(b.qty) - Number(b.qty_produced) - Number(b.qty_scrap));

export const LOT_KINDS: Record<string, string> = {
  raw: "Raw material", semi_finished: "Semi-finished", finished: "Finished good", by_product: "By-product", co_product: "Co-product",
};
export const REWORK_STATUS: Record<string, string> = {
  open: "Open", in_progress: "In progress", awaiting_inspection: "Awaiting re-inspection", passed: "Passed", failed: "Failed", scrapped: "Scrapped",
};
