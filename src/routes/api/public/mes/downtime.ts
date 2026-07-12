import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,OPTIONS",
  "Access-Control-Allow-Headers": "content-type",
};

export const Route = createFileRoute("/api/public/mes/downtime")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const lineId = url.searchParams.get("line_id");
        const status = url.searchParams.get("status");
        const supabase = createClient<Database>(
          process.env.SUPABASE_URL!,
          process.env.SUPABASE_PUBLISHABLE_KEY!,
          { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
        );
        let q = supabase.from("downtime_events").select("id,line_id,line_name,station_id,category,reason_code,started_at,started_ts,duration_min,work_order_id,status,operator_name,notes").order("started_ts", { ascending: false });
        if (lineId) q = q.eq("line_id", lineId);
        if (status) q = q.eq("status", status);
        const { data, error } = await q.limit(500);
        if (error) return Response.json({ error: error.message }, { status: 500, headers: CORS });
        return Response.json({ downtime: data ?? [] }, { headers: CORS });
      },
    },
  },
});
