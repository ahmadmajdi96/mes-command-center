import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,OPTIONS",
  "Access-Control-Allow-Headers": "content-type",
};

export const Route = createFileRoute("/api/public/mes/quality-holds")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const status = url.searchParams.get("status");
        const supabase = createClient<Database>(
          process.env.SUPABASE_URL!,
          process.env.SUPABASE_PUBLISHABLE_KEY!,
          { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
        );
        let q = supabase.from("quality_holds").select("id,lot_id,work_order_id,line_id,reason,raised_by,raised_at,raised_ts,status,severity").order("raised_ts", { ascending: false, nullsFirst: false });
        if (status) q = q.eq("status", status);
        const { data, error } = await q.limit(500);
        if (error) return Response.json({ error: error.message }, { status: 500, headers: CORS });
        return Response.json({ holds: data ?? [] }, { headers: CORS });
      },
    },
  },
});
