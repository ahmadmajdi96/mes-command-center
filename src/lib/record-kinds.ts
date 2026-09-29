/** Detail-page config: which table backs each list and what related records to show. */
export type Related = { title: string; table: string; fk: string; cols: string[]; order?: string };
export type Kind = { table: string; key: string; back: string; backLabel: string; title: string; hide?: string[]; related: Related[] };

const audit: Related = { title: "Change history", table: "audit_entries", fk: "entity_id", cols: ["at", "actor_name", "action", "summary", "reason"], order: "at" };

export const KINDS: Record<string, Kind> = {
  person: { table: "profiles", key: "id", back: "/access", backLabel: "People & Access", title: "Person", related: [
    { title: "Roles & scope", table: "user_role_grants", fk: "user_id", cols: ["role_key", "scope_kind", "scope_id", "effective_from", "effective_to"] },
    { title: "Actions taken", table: "audit_entries", fk: "actor_user_id", cols: ["at", "entity", "entity_id", "action", "summary"], order: "at" },
  ] },
  approval: { table: "approval_requests", key: "id", back: "/approvals", backLabel: "Approvals & Signatures", title: "Approval request", related: [
    { title: "Electronic signatures", table: "e_signatures", fk: "ref_id", cols: ["signed_at", "signer_name", "signer_email", "meaning", "reason"], order: "signed_at" },
  ] },
  downtime: { table: "downtime_events", key: "id", back: "/downtime", backLabel: "Andon & Downtime", title: "Downtime event", related: [audit] },
  portal: { table: "portal_connections", key: "id", back: "/integrations", backLabel: "Integrations", title: "Portal connection", hide: ["shared_secret"], related: [
    { title: "Messages", table: "portal_events", fk: "connection_id", cols: ["created_at", "direction", "event_type", "ref_id", "status", "attempts", "last_error"] },
  ] },
  portal_event: { table: "portal_events", key: "id", back: "/integrations", backLabel: "Integrations", title: "Portal message", related: [] },
  stock: { table: "stock_on_hand", key: "sku", back: "/inventory", backLabel: "Inventory", title: "Stock item", related: [
    { title: "Goods receipts", table: "goods_receipts", fk: "sku", cols: ["created_at", "production_order_id", "receipt_type", "qty", "uom", "lot_number", "actor_name"] },
    { title: "Consumption", table: "material_consumptions", fk: "component_sku", cols: ["created_at", "production_order_id", "qty", "uom", "input_lot", "actor_name"] },
  ] },
  receipt: { table: "goods_receipts", key: "id", back: "/inventory", backLabel: "Inventory", title: "Goods receipt", related: [] },
  work_center: { table: "work_centers", key: "id", back: "/master-data", backLabel: "Master Data", title: "Work center", related: [
    { title: "Routing steps here", table: "routing_operations", fk: "work_center_id", cols: ["routing_id", "sequence", "name", "setup_min", "run_min_per_unit"] },
  ] },
  bom: { table: "boms", key: "id", back: "/master-data", backLabel: "Master Data", title: "Bill of materials", related: [
    { title: "Components", table: "bom_items", fk: "bom_id", cols: ["sequence", "item_type", "component_sku", "component_name", "qty", "uom", "backflush"], order: "sequence" },
  ] },
  routing: { table: "routings", key: "id", back: "/master-data", backLabel: "Master Data", title: "Routing", related: [
    { title: "Operations", table: "routing_operations", fk: "routing_id", cols: ["sequence", "name", "work_center_id", "setup_min", "run_min_per_unit", "requires_approval"], order: "sequence" },
  ] },
  version: { table: "production_versions", key: "id", back: "/master-data", backLabel: "Master Data", title: "Production version", related: [
    { title: "Orders using it", table: "production_orders", fk: "production_version_id", cols: ["id", "product_name", "qty", "uom", "status", "planned_start"] },
  ] },
  tool: { table: "tools", key: "id", back: "/tools", backLabel: "Tools", title: "Tool", related: [
    { title: "Usage", table: "tool_usages", fk: "tool_id", cols: ["created_at", "order_operation_id", "used_by_name"] },
  ] },
  waste_reason: { table: "waste_reasons", key: "id", back: "/waste-reasons", backLabel: "Waste Reasons", title: "Waste reason", related: [
    { title: "Waste recorded with this reason", table: "waste_events", fk: "reason_code", cols: ["created_at", "station_name", "production_order_id", "lot_number", "operator_name", "notes"] },
  ] },
  instruction: { table: "instruction_steps", key: "id", back: "/work-instructions", backLabel: "Work Instructions", title: "Work instruction", related: [
    { title: "Confirmations by operators", table: "instruction_acks", fk: "step_id", cols: ["created_at", "order_operation_id", "acked_by_name"] },
  ] },
  trace: { table: "production_orders", key: "id", back: "/traceability", backLabel: "Traceability", title: "Order trace", related: [
    { title: "Batches", table: "production_batches", fk: "production_order_id", cols: ["id", "lot_number", "qty", "qty_good", "qty_scrap", "status"] },
    { title: "Items", table: "product_units", fk: "production_order_id", cols: ["uid", "serial", "lot_number", "current_station_id", "status"] },
    { title: "Materials used", table: "material_consumptions", fk: "production_order_id", cols: ["created_at", "component_sku", "qty", "uom", "input_lot"] },
    { title: "Output", table: "goods_receipts", fk: "production_order_id", cols: ["created_at", "sku", "qty", "uom", "lot_number"] },
    { title: "Waste", table: "waste_events", fk: "production_order_id", cols: ["created_at", "station_name", "reason_label", "operator_name"] },
  ] },
};
