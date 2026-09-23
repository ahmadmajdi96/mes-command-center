import { createFileRoute } from "@tanstack/react-router";
import { authorizeApi, corsHeaders, page, serviceClient } from "@/lib/mes/api-guard.server";

export const Route = createFileRoute("/api/mes/v1/traceability")({
  server: {
    handlers: {
      OPTIONS: async ({ request }) => new Response(null, { status: 204, headers: corsHeaders(request) }),
      GET: async ({ request }) => {
        const auth = await authorizeApi(request);
        if ("denied" in auth) return auth.denied;
        const org = auth.caller.organizationId;
        const headers = corsHeaders(request);
        const { url, limit, offset, from: rFrom, to: rTo } = page(request);
        const entity = url.searchParams.get("entity");
        const workOrder = url.searchParams.get("work_order_id");
        const from = url.searchParams.get("from");
        const to = url.searchParams.get("to");

        const supabase = serviceClient();
        let q = supabase
          .from("audit_entries")
          .select("id,at,actor_name,entity,entity_id,action,summary,reason,correlation_id", {
            count: "exact",
          })
          .order("at", { ascending: false });
        if (entity) q = q.eq("entity", entity);
        if (workOrder) q = q.eq("entity_id", workOrder);
        if (from) q = q.gte("at", from);
        if (to) q = q.lte("at", to);
        const { data, error, count } = await q.range(rFrom, rTo);
        if (error) return Response.json({ error: error.message }, { status: 500, headers });
        return Response.json({ entries: data ?? [], total: count ?? 0, limit, offset }, { headers });
      },
    },
  },
});
