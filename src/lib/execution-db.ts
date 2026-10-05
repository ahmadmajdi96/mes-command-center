import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/** Thin generic helpers for the production-execution tables (RLS enforces company + permission). */
export function useRows<T = any>(table: string, opts: { eq?: Record<string, string | null | undefined>; order?: string; asc?: boolean; enabled?: boolean } = {}) {
  return useQuery({
    queryKey: ["exec", table, opts.eq ?? {}],
    enabled: opts.enabled ?? true,
    queryFn: async () => {
      let q = supabase.from(table as never).select("*");
      for (const [k, v] of Object.entries(opts.eq ?? {})) if (v != null) q = q.eq(k, v);
      const { data, error } = await q.order(opts.order ?? "created_at", { ascending: opts.asc ?? false }).limit(2000);
      if (error) throw error;
      return (data ?? []) as T[];
    },
  });
}

async function me() {
  const { data } = await supabase.auth.getUser();
  const u = data.user;
  return { actor_user_id: u?.id ?? null, actor_name: (u?.user_metadata?.full_name as string) || u?.email || "Unknown user" };
}

export function useWrite(table: string) {
  const qc = useQueryClient();
  const done = () => qc.invalidateQueries({ queryKey: ["exec"] });
  return {
    insert: useMutation({
      mutationFn: async (row: Record<string, unknown> | Record<string, unknown>[]) => {
        const { data, error } = await supabase.from(table as never).insert(row as never).select();
        if (error) throw error;
        return data;
      },
      onSuccess: done,
    }),
    /** Insert with the signed-in person stamped as actor (history tables). */
    record: useMutation({
      mutationFn: async (row: Record<string, unknown>) => {
        const { data, error } = await supabase.from(table as never).insert({ ...row, ...(await me()) } as never).select();
        if (error) throw error;
        return data;
      },
      onSuccess: () => { done(); qc.invalidateQueries({ queryKey: ["production_orders"] }); },
    }),
    update: useMutation({
      mutationFn: async ({ id, patch }: { id: string; patch: Record<string, unknown> }) => {
        const { error } = await supabase.from(table as never).update(patch as never).eq("id", id);
        if (error) throw error;
      },
      onSuccess: done,
    }),
    remove: useMutation({
      mutationFn: async (id: string) => {
        const { error } = await supabase.from(table as never).delete().eq("id", id);
        if (error) throw error;
      },
      onSuccess: done,
    }),
  };
}

export async function applyProductionVersion(poId: string, versionId: string) {
  const { error } = await supabase.rpc("apply_production_version" as never, { _po_id: poId, _version_id: versionId } as never);
  if (error) throw error;
}

const FRIENDLY: Record<string, string> = {
  bom_items_qty_check: "Quantity must be more than 0",
  boms_base_qty_positive: "Base qty must be more than 0",
  routing_operations_sequence_nonneg: "Sequence cannot be negative",
  routing_operations_setup_nonneg: "Setup minutes cannot be negative",
  routing_operations_run_nonneg: "Run minutes cannot be negative",
};
export const errMsg = (e: unknown) => {
  const m = e instanceof Error ? e.message : (e as { message?: string })?.message ?? String(e);
  const hit = Object.keys(FRIENDLY).find((k) => m.includes(k));
  if (hit) return FRIENDLY[hit];
  if (m.includes("violates check constraint")) return "One of the values isn't allowed — check the numbers and try again";
  return m;
};
