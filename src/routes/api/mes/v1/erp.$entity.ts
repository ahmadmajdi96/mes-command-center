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
type Rec = Record<string, any>;
const req = (r: Rec, ...keys: string[]) => {
  for (const k of keys) if (r[k] === undefined || r[k] === null || r[k] === "") throw new Error(`Missing field: ${k}`);
};

const TABLE: Record<string, string> = {
  materials: "products", "work-centers": "work_centers", boms: "boms", routings: "routings",
  "production-versions": "production_versions", "batch-numbers": "production_batches", "production-orders": "production_orders",
};
const OUTBOUND: Record<string, string> = {
  confirmations: "production_confirmations", "goods-receipts": "goods_receipts", consumptions: "material_consumptions", activities: "activity_confirmations",
};

function shape(entity: string, r: Rec, org: string): Rec {
  const id = String(r.id ?? r.erp_id ?? "");
  if (!id) throw new Error("Missing field: id or erp_id");
  const base = { id, erp_id: r.erp_id ?? id, organization_id: org };
  switch (entity) {
    case "materials": req(r, "sku", "name");
      return { ...base, sku: r.sku, name: r.name, description: r.description ?? null, type: r.type ?? "finished", uom: r.uom ?? "ea", standard_cost: r.standard_cost ?? 0 };
    case "work-centers": req(r, "name");
      return { ...base, name: r.name, kind: r.kind ?? "line", line_id: r.line_id ?? null, station_id: r.station_id ?? null };
    case "boms": req(r, "sku");
      return { ...base, sku: r.sku, product_id: r.product_id ?? null, version: String(r.version ?? "1"), base_qty: r.base_qty ?? 1, uom: r.uom ?? "ea", status: r.status ?? "active" };
    case "routings": req(r, "sku");
      return { ...base, sku: r.sku, product_id: r.product_id ?? null, version: String(r.version ?? "1"), status: r.status ?? "active" };
    case "production-versions": req(r, "sku", "version");
      return { ...base, sku: r.sku, product_id: r.product_id ?? null, version: String(r.version), description: r.description ?? null, bom_id: r.bom_id ?? null, routing_id: r.routing_id ?? null, valid_from: r.valid_from ?? null, valid_to: r.valid_to ?? null, is_default: !!r.is_default };
    case "batch-numbers": req(r, "production_order_id", "lot_number", "sku");
      return { ...base, production_order_id: r.production_order_id, number: r.number ?? id, lot_number: r.lot_number, sequence: r.sequence ?? 1, sku: r.sku, product_name: r.product_name ?? r.sku, qty: r.qty ?? 0, uom: r.uom ?? "ea" };
    case "production-orders": req(r, "sku", "qty");
      return { ...base, number: r.number ?? id, lot_number: r.lot_number ?? `LOT-${id}`, sku: r.sku, product_name: r.product_name ?? r.sku, product_id: r.product_id ?? null, qty: r.qty, uom: r.uom ?? "ea", line_id: r.line_id ?? null, planned_start: r.planned_start ?? null, planned_end: r.planned_end ?? null, priority: r.priority ?? "normal", production_version_id: r.production_version_id ?? null };
  }
  throw new Error("Unknown entity");
}

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
        const db = serviceClient();
        const results: { id: string; status: string; message?: string }[] = [];

        for (const r of records) {
          let id = String(r?.id ?? r?.erp_id ?? "?");
          try {
            const row = shape(entity, r, org);
            id = row.id;
            const { data: existing } = await db.from(table as never).select("organization_id" + (entity === "batch-numbers" ? "" : ", mes_override")).eq("id", id).maybeSingle();
            const ex = existing as Rec | null;
            if (ex && ex.organization_id !== org) throw new Error("Record belongs to another company");
            if (ex?.mes_override) {
              results.push({ id, status: "skipped", message: "MES override is set; ERP values not applied" });
            } else {
              const { error } = await db.from(table as never).upsert(row as never, { onConflict: "id" });
              if (error) throw new Error(error.message);
              // Child rows: BOM items and routing operations are replaced as a set.
              if (entity === "boms" && Array.isArray(r.items)) {
                await db.from("bom_items").delete().eq("bom_id", id);
                const items = r.items.map((i: Rec, n: number) => ({ organization_id: org, bom_id: id, item_type: i.item_type ?? "component", component_product_id: i.product_id ?? null, component_sku: i.sku, component_name: i.name ?? i.sku, qty: i.qty, uom: i.uom ?? "ea", backflush: !!i.backflush, auto_confirm: !!i.auto_confirm, sequence: i.sequence ?? (n + 1) * 10 }));
                const { error: e2 } = await db.from("bom_items").insert(items);
                if (e2) throw new Error(e2.message);
              }
              if (entity === "routings" && Array.isArray(r.operations)) {
                await db.from("routing_operations").delete().eq("routing_id", id);
                const ops = r.operations.map((o: Rec, n: number) => ({ organization_id: org, routing_id: id, sequence: o.sequence ?? (n + 1) * 10, name: o.name, work_center_id: o.work_center_id ?? null, setup_min: o.setup_min ?? 0, run_min_per_unit: o.run_min_per_unit ?? 0, work_instructions: o.work_instructions ?? null }));
                const { error: e3 } = await db.from("routing_operations").insert(ops);
                if (e3) throw new Error(e3.message);
              }
              results.push({ id, status: ex ? "updated" : "created" });
            }
          } catch (e) {
            results.push({ id, status: "error", message: e instanceof Error ? e.message : String(e) });
          }
        }
        await db.from("erp_sync_log").insert(results.map((x) => ({
          organization_id: org, direction: "inbound", entity, erp_id: x.id, action: "upsert", status: x.status, message: x.message ?? null,
          payload: records.find((r) => String(r.id ?? r.erp_id) === x.id) ?? null,
        })));
        const failed = results.filter((x) => x.status === "error").length;
        return Response.json({ results, failed }, { status: failed === results.length ? 422 : 200, headers });
      },
    },
  },
});
