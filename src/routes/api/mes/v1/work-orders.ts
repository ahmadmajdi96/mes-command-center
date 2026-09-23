import { createFileRoute } from "@tanstack/react-router";
import { corsHeaders, page, requireApiKey, serviceClient } from "@/lib/mes/api-guard.server";

export const Route = createFileRoute("/api/mes/v1/work-orders")({
  server: {
    handlers: {
      OPTIONS: async ({ request }) => new Response(null, { status: 204, headers: corsHeaders(request) }),
      GET: async ({ request }) => {
        const denied = requireApiKey(request);
        if (denied) return denied;
        const headers = corsHeaders(request);
        const { url, limit, offset, from, to } = page(request);
        const status = url.searchParams.get("status");
        const lineId = url.searchParams.get("line_id");

        const supabase = serviceClient();
        // No operator identity in the integration projection.
        let q = supabase
          .from("work_orders")
          .select(
            "id,production_order_id,line_id,product,sku,status,qty_target,qty_produced,uom,started_at,ends_at,shift,progress",
            { count: "exact" },
          )
          .order("started_at", { ascending: false, nullsFirst: false });
        if (status) q = q.eq("status", status);
        if (lineId) q = q.eq("line_id", lineId);
        const { data, error, count } = await q.range(from, to);
        if (error) return Response.json({ error: error.message }, { status: 500, headers });
        return Response.json({ work_orders: data ?? [], total: count ?? 0, limit, offset }, { headers });
      },
    },
  },
});
