import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type Product = Database["public"]["Tables"]["products"]["Row"];
export type ProductInsert = Database["public"]["Tables"]["products"]["Insert"];

export const productsKey = ["products"] as const;
export const productTypes = ["finished", "semi", "raw"] as const;

function nextId(existing: { id: string }[], prefix = "P-") {
  const n = existing
    .map((x) => parseInt(x.id.replace(prefix, ""), 10))
    .filter((n) => !isNaN(n));
  return `${prefix}${String((n.length ? Math.max(...n) : 0) + 1).padStart(3, "0")}`;
}

export function useProducts() {
  return useQuery({
    queryKey: productsKey,
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("*").order("sku");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useProduct(id: string | undefined) {
  return useQuery({
    queryKey: ["product", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("*").eq("id", id!).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useCreateProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Omit<ProductInsert, "id"> & { id?: string }) => {
      const all = qc.getQueryData<Product[]>(productsKey) ?? [];
      const id = input.id ?? nextId(all);
      const { data, error } = await supabase.from("products").insert({ ...input, id }).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: productsKey }),
  });
}

export function useUpdateProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Product> }) => {
      const { data, error } = await supabase.from("products").update(patch).eq("id", id).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: productsKey });
      qc.invalidateQueries({ queryKey: ["product", v.id] });
    },
  });
}

export function useDeleteProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("products").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: productsKey }),
  });
}

export function useProductsRealtime() {
  const qc = useQueryClient();
  useEffect(() => {
    const ch = supabase.channel("rt-products")
      .on("postgres_changes", { event: "*", schema: "public", table: "products" }, () => {
        qc.invalidateQueries({ queryKey: productsKey });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);
}
