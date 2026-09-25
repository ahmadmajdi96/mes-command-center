import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/_authenticated/erp-contract")({
  head: () => ({
    meta: [
      { title: "ERP Contract — Cortanex MES" },
      { name: "description", content: "Data contract for ERP systems sending master data and reading production results." },
      { property: "og:title", content: "ERP Contract — Cortanex MES" },
      { property: "og:description", content: "Inbound and outbound ERP data contract." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});

type Ent = { name: string; path: string; required: string[]; optional: string[]; example: unknown };

const INBOUND: Ent[] = [
  { name: "Materials", path: "materials", required: ["id or erp_id", "sku", "name"], optional: ["description", "type", "uom", "standard_cost"],
    example: [{ erp_id: "MAT-FLR-T55", sku: "FLR-T55", name: "Wheat Flour T55", uom: "kg", type: "finished" }] },
  { name: "Work centers", path: "work-centers", required: ["id or erp_id", "name"], optional: ["kind", "line_id", "station_id"],
    example: [{ erp_id: "WC-MILL", name: "Roller Mill", kind: "line" }] },
  { name: "BOMs", path: "boms", required: ["id or erp_id", "sku"], optional: ["version", "base_qty", "uom", "status", "items[] (sku, name, qty, uom, item_type, backflush, auto_confirm)"],
    example: [{ erp_id: "BOM-T55-1", sku: "FLR-T55", version: "1", base_qty: 1000, uom: "kg",
      items: [{ sku: "WHT-RAW", name: "Soft wheat grain", qty: 1330, uom: "kg", backflush: true }, { sku: "BRN-01", name: "Wheat bran", qty: 280, uom: "kg", item_type: "by_product", auto_confirm: true }] }] },
  { name: "Routings", path: "routings", required: ["id or erp_id", "sku"], optional: ["version", "status", "operations[] (sequence, name, work_center_id, setup_min, run_min_per_unit, work_instructions)"],
    example: [{ erp_id: "RT-T55-1", sku: "FLR-T55", operations: [{ sequence: 10, name: "Milling", work_center_id: "WC-MILL", setup_min: 30, run_min_per_unit: 0.02 }] }] },
  { name: "Production versions", path: "production-versions", required: ["id or erp_id", "sku", "version"], optional: ["bom_id", "routing_id", "valid_from", "valid_to", "is_default", "description"],
    example: [{ erp_id: "PV-T55-1", sku: "FLR-T55", version: "0001", bom_id: "BOM-T55-1", routing_id: "RT-T55-1", valid_from: "2026-01-01", is_default: true }] },
  { name: "Batch numbers", path: "batch-numbers", required: ["id or erp_id", "production_order_id", "lot_number", "sku"], optional: ["number", "sequence", "qty", "uom", "product_name"],
    example: [{ erp_id: "B-1", production_order_id: "PO-1001", lot_number: "LOT-1001-A", sku: "FLR-T55", qty: 500 }] },
  { name: "Production orders", path: "production-orders", required: ["id or erp_id", "sku", "qty"], optional: ["number", "lot_number", "product_name", "uom", "line_id", "planned_start", "planned_end", "priority", "production_version_id"],
    example: [{ erp_id: "PO-1001", sku: "FLR-T55", qty: 1000, uom: "kg", production_version_id: "PV-T55-1" }] },
];

const OUTBOUND = [
  { name: "Production confirmations", path: "confirmations", fields: "operation, yield, scrap, scrap reason, final flag, who, when" },
  { name: "Goods receipts", path: "goods-receipts", fields: "finished / co-product / by-product, sku, qty, lot, storage location" },
  { name: "Material consumption", path: "consumptions", fields: "component sku, qty, input lot, backflush flag" },
  { name: "Activities (time)", path: "activities", fields: "setup / machine / labor minutes, people, operation" },
];

function Page() {
  const base = typeof window !== "undefined" ? window.location.origin : "";
  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-3">
        <Link to="/master-data" className="rounded-lg border border-border/60 p-2" aria-label="Back"><ArrowLeft className="h-4 w-4" /></Link>
        <div>
          <h1 className="text-2xl font-semibold">ERP Contract</h1>
          <p className="text-sm text-muted-foreground">How any ERP sends master data in, and reads production results back. The MES runs standalone; this contract is optional.</p>
        </div>
      </div>

      <section className="glass-panel space-y-2 rounded-2xl p-4 text-sm">
        <h2 className="font-semibold">Rules</h2>
        <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
          <li>Every call carries the company's key in the <code>x-api-key</code> header. Data only lands in that company.</li>
          <li>Records are matched by <code>id</code> (defaults to <code>erp_id</code>): new ones are created, existing ones updated.</li>
          <li>Records locked with "MES override" on the Master Data page are skipped and logged, never overwritten.</li>
          <li>BOM items and routing operations are replaced as a full set on each send.</li>
          <li>Max 500 records per call. Every record appears in the ERP sync log with its result.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">ERP → MES (send)</h2>
        {INBOUND.map((e) => (
          <div key={e.path} className="glass-panel space-y-2 rounded-2xl p-4 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-semibold">{e.name}</h3>
              <code className="rounded bg-muted px-2 py-1 text-xs">POST {base}/api/mes/v1/erp/{e.path}</code>
            </div>
            <div><span className="font-medium">Required:</span> <span className="text-muted-foreground">{e.required.join(", ")}</span></div>
            <div><span className="font-medium">Optional:</span> <span className="text-muted-foreground">{e.optional.join(", ")}</span></div>
            <pre className="overflow-x-auto rounded-lg bg-muted p-3 text-xs">{JSON.stringify(e.example, null, 2)}</pre>
          </div>
        ))}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">MES → ERP (read)</h2>
        <p className="text-sm text-muted-foreground">Add <code>?since=ISO-time</code> to fetch only new records, and <code>&amp;production_order_id=…</code> to filter by order.</p>
        {OUTBOUND.map((e) => (
          <div key={e.path} className="glass-panel flex flex-wrap items-center justify-between gap-2 rounded-2xl p-4 text-sm">
            <div><div className="font-semibold">{e.name}</div><div className="text-muted-foreground">{e.fields}</div></div>
            <code className="rounded bg-muted px-2 py-1 text-xs">GET {base}/api/mes/v1/erp/{e.path}</code>
          </div>
        ))}
      </section>
    </div>
  );
}
