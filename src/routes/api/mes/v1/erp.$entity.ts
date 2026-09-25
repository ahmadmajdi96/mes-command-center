import { createFileRoute } from "@tanstack/react-router";
import { authorizeApi, corsHeaders, serviceClient } from "@/lib/mes/api-guard.server";

/**
 * ERP replication (inbound). POST /api/mes/v1/erp/{entity} with a JSON array (or { records: [...] }).
 * Entities: materials, work-centers, boms, routings, production-versions, batch-numbers, production-orders.
 * Records are upserted by `id` (defaults to the ERP id). Records flagged `mes_override` in the MES are
 * not overwritten — the skip is logged. Every record is written to the ERP sync log.
 *
 * GET /api/mes/v1/erp/confirmations | goods-receipts | consumptions — outbound results for the ERP.
 */
import { ingestErp, ERP_TABLE as TABLE } from "@/lib/mes/erp-ingest.server";
type Rec = Record<string, any>;
const OUTBOUND: Record<string, string> = {
  confirmations: "production_confirmations", "goods-receipts": "goods_receipts", consumptions: "material_consumptions", activities: "activity_confirmations",
};

export const Route = createFileRoute("/api/mes/v1/erp/$entity")({
  server: {
    handlers: {
      OPTIONS: async ({ request }) => new Response(null, { status: 204, headers: corsHeaders(request) }),
      GET: async ({ request, params }) => {
        const auth = await authorizeApi(request);
        if ("denied" in auth) return auth.denied;
        const headers = corsHeaders(request);
        const table = OUTBOUND[params.entity];
        if (!table) return Response.json({ error: "Unknown outbound entity" }, { status: 404, headers });
        const url = new URL(request.url);
        const since = url.searchParams.get("since");
        let q = serviceClient().from(table as never).select("*").order("created_at", { ascending: true }).limit(1000);
        if (auth.caller.organizationId) q = q.eq("organization_id", auth.caller.organizationId);
        if (since) q = q.gt("created_at", since);
        const po = url.searchParams.get("production_order_id");
        if (po) q = q.eq("production_order_id", po);
        const { data, error } = await q;
        if (error) return Response.json({ error: error.message }, { status: 500, headers });
        return Response.json({ records: data ?? [] }, { headers });
      },
      POST: async ({ request, params }) => {
        const auth = await authorizeApi(request);
        if ("denied" in auth) return auth.denied;
        const headers = corsHeaders(request);
        const entity = params.entity;
        const table = TABLE[entity];
        if (!table) return Response.json({ error: "Unknown entity" }, { status: 404, headers });
        let body: any;
        try { body = await request.json(); } catch { return Response.json({ error: "Body must be JSON" }, { status: 400, headers }); }
        const records: Rec[] = Array.isArray(body) ? body : body?.records;
        if (!Array.isArray(records) || records.length === 0) return Response.json({ error: "Send an array of records" }, { status: 400, headers });
        if (records.length > 500) return Response.json({ error: "Max 500 records per call" }, { status: 400, headers });
        const org = auth.caller.organizationId ?? String(body?.organization_id ?? "ORG-01");
        const results = await ingestErp(entity, records, org, "api");
        const failed = results.filter((x) => x.status === "error").length;
        return Response.json({ results, failed }, { status: failed === results.length ? 422 : 200, headers });
      },
    },
  },
});
