import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,OPTIONS",
  "Access-Control-Allow-Headers": "content-type",
};

/**
 * Public traceability feed for sibling apps
 * (MES Command Central, CORTA QC System, Unified Command Center, Command Center Pro).
 * Supports date range + entity + work_order + actor filters.
 */
export const Route = createFileRoute("/api/public/mes/traceability")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const entity = url.searchParams.get("entity");
        const actorId = url.searchParams.get("actor_id");
        const from = url.searchParams.get("from");
        const to = url.searchParams.get("to");
        const workOrder = url.searchParams.get("work_order_id");
        const limit = Math.min(1000, Number(url.searchParams.get("limit") ?? 200));

        const supabase = createClient<Database>(
          process.env.SUPABASE_URL!,
          process.env.SUPABASE_PUBLISHABLE_KEY!,
          { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
        );
        let q = supabase.from("audit_entries")
          .select("id,at,actor_id,actor_name,entity,entity_id,action,summary,before_data,after_data")
          .order("at", { ascending: false });
        if (entity) q = q.eq("entity", entity);
        if (actorId) q = q.eq("actor_id", actorId);
        if (from) q = q.gte("at", from);
        if (to) q = q.lte("at", to);
        if (workOrder) q = q.eq("entity_id", workOrder);
        const { data, error } = await q.limit(limit);
        if (error) return Response.json({ error: error.message }, { status: 500, headers: CORS });
        return Response.json({ entries: data ?? [] }, { headers: CORS });
      },
    },
  },
});
