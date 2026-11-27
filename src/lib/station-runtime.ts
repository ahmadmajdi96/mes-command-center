import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type Tables = Database["public"]["Tables"];
export type RuntimeStation = Pick<
  Tables["stations"]["Row"],
  "id" | "name" | "line_id" | "type" | "sequence"
>;
export type RuntimeLine = Pick<Tables["lines"]["Row"], "id" | "name">;

export function useRuntimeStation(id: string) {
  return useQuery({
    queryKey: ["runtime-station", id],
    queryFn: async () => {
      const { data: station, error } = await supabase
        .from("stations")
        .select("id,name,line_id,type,sequence")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      if (!station) return null;
      const { data: line, error: lineError } = await supabase
        .from("lines")
        .select("id,name")
        .eq("id", station.line_id)
        .maybeSingle();
      if (lineError) throw lineError;
      return { station, line };
    },
  });
}
