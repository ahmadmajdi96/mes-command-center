import { serviceClient } from "./api-guard.server";

type Rec = Record<string, any>;
const req = (r: Rec, ...keys: string[]) => {
  for (const k of keys) if (r[k] === undefined || r[k] === null || r[k] === "") throw new Error(`Missing field: ${k}`);
};

export const ERP_TABLE: Record<string, string> = {
  materials: "products", "work-centers": "work_centers", boms: "boms", routings: "routings",
  "production-versions": "production_versions", "batch-numbers": "production_batches", "production-orders": "production_orders",
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

export type IngestResult = { id: string; status: string; message?: string };

/** Upsert ERP records for one company; honours MES override; logs every record. */
export async function ingestErp(entity: string, records: Rec[], org: string, source = "api"): Promise<IngestResult[]> {
  const table = ERP_TABLE[entity];
  if (!table) throw new Error("Unknown entity");
  const db = serviceClient();
  const results: IngestResult[] = [];
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
        continue;
      }
      const { error } = await db.from(table as never).upsert(row as never, { onConflict: "id" });
      if (error) throw new Error(error.message);
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
    } catch (e) {
      results.push({ id, status: "error", message: e instanceof Error ? e.message : String(e) });
    }
  }
  await db.from("erp_sync_log").insert(results.map((x) => ({
    organization_id: org, direction: "inbound", entity, erp_id: x.id, action: source === "api" ? "upsert" : "manual_import", status: x.status, message: x.message ?? null,
    payload: records.find((r) => String(r.id ?? r.erp_id) === x.id) ?? null,
  })));
  return results;
}

/** Parse CSV text (header row) into records; numeric-looking cells become numbers. */
export function parseCsv(text: string): Rec[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];
  const split = (l: string) => l.match(/("([^"]|"")*"|[^,]*)(,|$)/g)!.slice(0, -1).map((c) => c.replace(/,$/, "").replace(/^"|"$/g, "").replace(/""/g, '"').trim());
  const head = split(lines[0]);
  return lines.slice(1).map((l) => {
    const cells = split(l); const o: Rec = {};
    head.forEach((h, i) => { const v = cells[i] ?? ""; if (v !== "") o[h] = /^-?\d+(\.\d+)?$/.test(v) ? Number(v) : v === "true" ? true : v === "false" ? false : v; });
    return o;
  });
}
