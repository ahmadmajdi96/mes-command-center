import { createFileRoute } from "@tanstack/react-router";
import { authorizeApi, corsHeaders, page, serviceClient } from "@/lib/mes/api-guard.server";

export const Route = createFileRoute("/api/mes/v1/downtime")({
  server: {
    handlers: {
      OPTIONS: async ({ request }) => new Response(null, { status: 204, headers: corsHeaders(request) }),
      GET: async ({ request }) => {
        const auth = await authorizeApi(request);
        if ("denied" in auth) return auth.denied;
        const org = auth.caller.organizationId;
        const headers = corsHeaders(request);
        const { url, limit, offset, from, to } = page(request);
        const status = url.searchParams.get("status");
        const lineId = url.searchParams.get("line_id");

        const supabase = serviceClient();
        let q = supabase
          .from("downtime_events")
          .select(
            "id,line_id,line_name,station_id,reason_code,category,started_at,started_ts,duration_min,work_order_id,status",
            { count: "exact" },
          )
          .order("started_ts", { ascending: false, nullsFirst: false });
        if (org) q = q.eq("organization_id", org);
        if (status) q = q.eq("status", status);
        if (lineId) q = q.eq("line_id", lineId);
        const { data, error, count } = await q.range(from, to);
        if (error) return Response.json({ error: error.message }, { status: 500, headers });
        return Response.json({ events: data ?? [], total: count ?? 0, limit, offset }, { headers });
      },
    },
  },
});
