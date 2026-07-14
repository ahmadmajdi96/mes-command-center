import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type Recipe = Database["public"]["Tables"]["product_station_recipes"]["Row"];
export type WasteReason = Database["public"]["Tables"]["waste_reasons"]["Row"];
export type WasteEvent = Database["public"]["Tables"]["waste_events"]["Row"];
export type StationHold = Database["public"]["Tables"]["station_holds"]["Row"];
export type UnitReading = Database["public"]["Tables"]["unit_readings"]["Row"];

export type RecipeVariable = {
  key: string;
  label: string;
  direction: "input" | "output" | "reading";
  type: "number" | "text" | "boolean" | "select";
  unit?: string;
  min?: number;
  max?: number;
  required?: boolean;
  options?: string[];
  default?: string | number | boolean;
};

const EVIDENCE_BUCKET = "mes-evidence";

/* ---------------- Recipes ---------------- */

export function useRecipe(productId?: string, stationId?: string) {
  return useQuery({
    queryKey: ["recipe", productId, stationId],
    enabled: !!productId && !!stationId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_station_recipes")
        .select("*")
        .eq("product_id", productId!)
        .eq("station_id", stationId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useRecipesForProduct(productId?: string) {
  return useQuery({
    queryKey: ["recipes", "product", productId],
    enabled: !!productId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_station_recipes")
        .select("*")
        .eq("product_id", productId!)
        .order("sequence");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useRecipesForStation(stationId?: string) {
  return useQuery({
    queryKey: ["recipes", "station", stationId],
    enabled: !!stationId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_station_recipes")
        .select("*")
        .eq("station_id", stationId!);
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useUpsertRecipe() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: {
      product_id: string;
      station_id: string;
      variables: RecipeVariable[];
      sequence?: number;
      target_cycle_sec?: number | null;
      instructions?: string | null;
    }) => {
      const { data, error } = await supabase
        .from("product_station_recipes")
        .upsert(
          {
            product_id: v.product_id,
            station_id: v.station_id,
            variables: v.variables as never,
            sequence: v.sequence ?? 0,
            target_cycle_sec: v.target_cycle_sec ?? null,
            instructions: v.instructions ?? null,
          },
          { onConflict: "product_id,station_id" },
        )
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["recipe", v.product_id, v.station_id] });
      qc.invalidateQueries({ queryKey: ["recipes", "product", v.product_id] });
      qc.invalidateQueries({ queryKey: ["recipes", "station", v.station_id] });
    },
  });
}

/* ---------------- Waste Reasons ---------------- */

export function useWasteReasons() {
  return useQuery({
    queryKey: ["waste_reasons"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("waste_reasons")
        .select("*")
        .eq("active", true)
        .order("category")
        .order("label");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useStationWasteReasons(stationId?: string) {
  return useQuery({
    queryKey: ["station_waste_reasons", stationId],
    enabled: !!stationId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("station_waste_reasons")
        .select("reason_id, waste_reasons(*)")
        .eq("station_id", stationId!);
      if (error) throw error;
      return (data ?? [])
        .map((r) => r.waste_reasons as WasteReason | null)
        .filter(Boolean) as WasteReason[];
    },
  });
}

export function useUpsertWasteReason() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: Partial<WasteReason> & { code: string; label: string }) => {
      const { data, error } = await supabase
        .from("waste_reasons")
        .upsert(
          { code: v.code, label: v.label, category: v.category ?? "other", active: v.active ?? true },
          { onConflict: "code" },
        )
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["waste_reasons"] }),
  });
}

export function useDeleteWasteReason() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("waste_reasons").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["waste_reasons"] }),
  });
}

export function useSetStationWasteReasons() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { station_id: string; reason_ids: string[] }) => {
      const { error: e1 } = await supabase
        .from("station_waste_reasons")
        .delete()
        .eq("station_id", v.station_id);
      if (e1) throw e1;
      if (v.reason_ids.length) {
        const rows = v.reason_ids.map((rid) => ({ station_id: v.station_id, reason_id: rid }));
        const { error: e2 } = await supabase.from("station_waste_reasons").insert(rows);
        if (e2) throw e2;
      }
    },
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: ["station_waste_reasons", v.station_id] }),
  });
}

/* ---------------- Waste Events ---------------- */

export function useWasteEvents(filter?: { station_id?: string; unit_uid?: string; limit?: number }) {
  return useQuery({
    queryKey: ["waste_events", filter ?? {}],
    queryFn: async () => {
      let q = supabase.from("waste_events").select("*").order("created_at", { ascending: false });
      if (filter?.station_id) q = q.eq("station_id", filter.station_id);
      if (filter?.unit_uid) q = q.eq("unit_uid", filter.unit_uid);
      const { data, error } = await q.limit(filter?.limit ?? 100);
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useLogWaste() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: {
      unit_uid?: string | null;
      station_id?: string | null;
      station_name?: string;
      line_id?: string | null;
      production_order_id?: string | null;
      lot_number?: string | null;
      reason_code: string;
      reason_label: string;
      reason_category?: string;
      notes?: string;
      operator_name?: string;
      evidence_urls?: string[];
    }) => {
      const { data, error } = await supabase
        .from("waste_events")
        .insert({
          unit_uid: v.unit_uid ?? null,
          station_id: v.station_id ?? null,
          station_name: v.station_name,
          line_id: v.line_id ?? null,
          production_order_id: v.production_order_id ?? null,
          lot_number: v.lot_number ?? null,
          reason_code: v.reason_code,
          reason_label: v.reason_label,
          reason_category: v.reason_category,
          notes: v.notes,
          operator_name: v.operator_name,
          evidence_urls: (v.evidence_urls ?? []) as never,
        })
        .select()
        .single();
      if (error) throw error;

      if (v.unit_uid) {
        await supabase
          .from("product_units")
          .update({ status: "scrapped" })
          .eq("uid", v.unit_uid);
        await supabase.from("unit_events").insert({
          id: `UE-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          unit_uid: v.unit_uid,
          station_id: v.station_id,
          station_name: v.station_name,
          line_id: v.line_id ?? null,
          event: "waste",
          result: v.reason_code,
          operator_name: v.operator_name,
          notes: v.notes,
        });
      }
      return data;
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["waste_events"] });
      qc.invalidateQueries({ queryKey: ["product_unit", v.unit_uid] });
      qc.invalidateQueries({ queryKey: ["unit_events", v.unit_uid] });
      qc.invalidateQueries({ queryKey: ["product_units"] });
    },
  });
}

/* ---------------- Station Holds ---------------- */

export function useStationHolds(stationId?: string, openOnly = false) {
  return useQuery({
    queryKey: ["station_holds", stationId, openOnly],
    queryFn: async () => {
      let q = supabase.from("station_holds").select("*").order("opened_at", { ascending: false });
      if (stationId) q = q.eq("station_id", stationId);
      if (openOnly) q = q.eq("status", "open");
      const { data, error } = await q.limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useOpenHold() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: {
      station_id: string;
      hold_type: "qc" | "maintenance" | "other";
      reason: string;
      opened_by_name?: string;
      evidence_urls?: string[];
    }) => {
      const { data, error } = await supabase
        .from("station_holds")
        .insert({
          station_id: v.station_id,
          hold_type: v.hold_type,
          reason: v.reason,
          opened_by_name: v.opened_by_name,
          evidence_urls: (v.evidence_urls ?? []) as never,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: ["station_holds", v.station_id] }),
  });
}

export function useCloseHold() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { id: string; resolution_notes?: string; closed_by_name?: string; evidence_urls?: string[] }) => {
      const patch: Partial<StationHold> = {
        status: "closed",
        closed_at: new Date().toISOString(),
        closed_by_name: v.closed_by_name,
        resolution_notes: v.resolution_notes,
      };
      if (v.evidence_urls && v.evidence_urls.length) {
        patch.evidence_urls = v.evidence_urls as never;
      }
      const { data, error } = await supabase
        .from("station_holds")
        .update(patch)
        .eq("id", v.id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["station_holds"] }),
  });
}

/* ---------------- Unit Readings ---------------- */

export function useLogReading() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: {
      unit_uid: string;
      station_id?: string;
      unit_event_id?: string;
      mode?: "auto" | "manual";
      variables: Record<string, unknown>;
      operator_name?: string;
    }) => {
      const { data, error } = await supabase
        .from("unit_readings")
        .insert({
          unit_uid: v.unit_uid,
          station_id: v.station_id,
          unit_event_id: v.unit_event_id,
          mode: v.mode,
          variables: v.variables as never,
          operator_name: v.operator_name,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["unit_readings", v.unit_uid] });
    },
  });
}

export function useUnitReadings(uid?: string) {
  return useQuery({
    queryKey: ["unit_readings", uid],
    enabled: !!uid,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("unit_readings")
        .select("*")
        .eq("unit_uid", uid!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

/* ---------------- Evidence upload (private bucket + signed URL) ---------------- */

export async function uploadEvidenceFile(file: File, prefix = "misc"): Promise<string> {
  const ext = file.name.split(".").pop() ?? "bin";
  const path = `${prefix}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage.from(EVIDENCE_BUCKET).upload(path, file, {
    cacheControl: "3600",
    upsert: false,
  });
  if (error) throw error;
  return path;
}

export async function signedEvidenceUrl(path: string, expiresIn = 60 * 60 * 24 * 7): Promise<string> {
  const { data, error } = await supabase.storage.from(EVIDENCE_BUCKET).createSignedUrl(path, expiresIn);
  if (error) throw error;
  return data.signedUrl;
}

/* ---------------- Realtime ---------------- */

export function useHmiRealtime(stationId?: string) {
  const qc = useQueryClient();
  useEffect(() => {
    const ch = supabase
      .channel(`rt-hmi-${stationId ?? "all"}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "waste_events" }, () => {
        qc.invalidateQueries({ queryKey: ["waste_events"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "station_holds" }, () => {
        qc.invalidateQueries({ queryKey: ["station_holds"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "unit_readings" }, () => {
        qc.invalidateQueries({ queryKey: ["unit_readings"] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [qc, stationId]);
}
