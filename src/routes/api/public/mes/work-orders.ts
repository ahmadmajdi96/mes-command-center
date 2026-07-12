import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,OPTIONS",
  "Access-Control-Allow-Headers": "content-type",
};

export const Route = createFileRoute("/api/public/mes/work-orders")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const status = url.searchParams.get("status");
        const lineId = url.searchParams.get("line_id");
        const supabase = createClient<Database>(
          process.env.SUPABASE_URL!,
          process.env.SUPABASE_PUBLISHABLE_KEY!,
          { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
        );
        let q = supabase.from("work_orders").select("id,production_order_id,line_id,product,sku,status,qty_target,qty_produced,uom,started_at,ends_at,operator,shift,progress").order("started_at", { ascending: false });
        if (status) q = q.eq("status", status);
        if (lineId) q = q.eq("line_id", lineId);
        const { data, error } = await q.limit(200);
        if (error) return Response.json({ error: error.message }, { status: 500, headers: CORS });
        return Response.json({ work_orders: data ?? [] }, { headers: CORS });
      },
    },
  },
});
