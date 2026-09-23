import { createFileRoute } from "@tanstack/react-router";
import { corsHeaders, page, requireApiKey, serviceClient } from "@/lib/mes/api-guard.server";

export const Route = createFileRoute("/api/mes/v1/quality-holds")({
  server: {
    handlers: {
      OPTIONS: async ({ request }) => new Response(null, { status: 204, headers: corsHeaders(request) }),
      GET: async ({ request }) => {
        const denied = requireApiKey(request);
        if (denied) return denied;
        const headers = corsHeaders(request);
        const { url, limit, offset, from, to } = page(request);
        const status = url.searchParams.get("status");

        const supabase = serviceClient();
        let q = supabase
          .from("quality_holds")
          .select("id,lot_id,work_order_id,line_id,reason,raised_at,raised_ts,status,severity", {
            count: "exact",
          })
          .order("raised_ts", { ascending: false, nullsFirst: false });
        if (status) q = q.eq("status", status);
        const { data, error, count } = await q.range(from, to);
        if (error) return Response.json({ error: error.message }, { status: 500, headers });
        return Response.json({ holds: data ?? [], total: count ?? 0, limit, offset }, { headers });
      },
    },
  },
});
