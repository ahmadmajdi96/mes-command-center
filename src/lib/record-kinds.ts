/** Detail-page config: which table backs each list and what related records to show. */
export type Related = { title: string; table: string; fk: string; cols: string[]; order?: string };
export type Kind = { table: string; key: string; back: string; backLabel: string; title: string; hide?: string[]; related: Related[] };

const audit: Related = { title: "Change history", table: "audit_entries", fk: "entity_id", cols: ["at", "actor_name", "action", "summary", "reason"], order: "at" };

export const KINDS: Record<string, Kind> = {
  approval: { table: "approval_requests", key: "id", back: "/approvals", backLabel: "Approvals & Signatures", title: "Approval request", related: [
    { title: "Electronic signatures", table: "e_signatures", fk: "ref_id", cols: ["signed_at", "signer_name", "signer_email", "meaning", "reason"], order: "signed_at" },
  ] },
  downtime: { table: "downtime_events", key: "id", back: "/downtime", backLabel: "Andon & Downtime", title: "Downtime event", related: [audit] },
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
