import { createServerFn } from "@tanstack/react-start";
import {
  lines as seedLines,
  stations as seedStations,
  workOrders as seedWO,
  downtime as seedDT,
  holds as seedHolds,
  genealogy as seedGen,
  users as seedUsers,
} from "@/lib/mes-data";
import { seededAuditLog } from "@/lib/audit-seed";

/**
 * Idempotent seed. Upserts the deterministic MES fixtures into Lovable Cloud so
 * the dashboard and traceability read paths have real DB data to work against.
 * Safe to run multiple times — every table uses upsert on the primary key.
 */
export const seedMesFromFixtures = createServerFn({ method: "POST" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const results: Record<string, number> = {};

  // ---- lines
  const linesRows = seedLines.map((l) => ({
    id: l.id,
    name: l.name,
    plant: l.plant,
    status: l.status,
    oee: l.oee,
    availability: l.availability,
    performance: l.performance,
    quality: l.quality,
    current_work_order: l.currentWorkOrder ?? null,
    product: l.product ?? null,
    output: l.output,
    target: l.target,
    uptime: l.uptime,
  }));
  {
    const { error } = await supabaseAdmin.from("lines").upsert(linesRows, { onConflict: "id" });
    if (error) throw new Error(`lines: ${error.message}`);
    results.lines = linesRows.length;
  }

  // ---- stations
  const stationsRows = seedStations.map((s) => ({
    id: s.id,
    line_id: s.lineId,
    name: s.name,
    sequence: s.sequence,
    type: s.type,
    status: s.status,
    cycle_time_sec: s.cycleTimeSec,
    current_step: s.currentStep ?? null,
    current_value: s.currentValue ?? null,
    target: s.target ?? null,
    oee: s.oee ?? null,
    machine: s.machine ?? null,
    template_ids: s.templateIds ?? null,
    last_tick_at: s.lastTickAt ?? null,
  }));
  {
    const { error } = await supabaseAdmin.from("stations").upsert(stationsRows, { onConflict: "id" });
    if (error) throw new Error(`stations: ${error.message}`);
    results.stations = stationsRows.length;
  }

  // ---- users
  const userRows = seedUsers.map((u) => ({
    id: u.id,
    name: u.name,
    mobile: u.mobile,
    email: u.email,
    role: u.role,
    shift: u.shift,
    status: u.status,
    skills: u.skills ?? null,
  }));
  {
    const { error } = await supabaseAdmin.from("mes_users").upsert(userRows, { onConflict: "id" });
    if (error) throw new Error(`mes_users: ${error.message}`);
    results.mes_users = userRows.length;
  }

  // ---- work orders
  const woRows = seedWO.map((w) => ({
    id: w.id,
    production_order_id: w.productionOrderId,
    line_id: w.lineId,
    product: w.product,
    sku: w.sku,
    status: w.status,
    qty_target: w.qtyTarget,
    qty_produced: w.qtyProduced,
    uom: w.uom,
    started_at: w.startedAt ?? null,
    ends_at: w.endsAt ?? null,
    operator: w.operator ?? null,
    shift: w.shift,
    progress: w.progress,
  }));
  {
    const { error } = await supabaseAdmin.from("work_orders").upsert(woRows, { onConflict: "id" });
    if (error) throw new Error(`work_orders: ${error.message}`);
    results.work_orders = woRows.length;
  }

  // ---- downtime
  const dtRows = seedDT.map((d) => {
    // startedAt in seeds is "HH:MM" — best-effort attach to today for timeseries indexing
    const now = new Date();
    let started_ts: string | null = null;
    const m = d.startedAt.match(/^(\d{2}):(\d{2})$/);
    if (m) {
      const dt = new Date(now);
      dt.setHours(parseInt(m[1], 10), parseInt(m[2], 10), 0, 0);
      started_ts = dt.toISOString();
    }
    return {
      id: d.id,
      line_id: d.lineId,
      line_name: d.lineName,
      station_id: d.stationId ?? null,
      assignment_id: d.assignmentId ?? null,
      operator_id: d.operatorId ?? null,
      operator_name: d.operatorName ?? null,
      reason_code: d.reasonCode,
      category: d.category,
      started_at: d.startedAt,
      started_ts,
      duration_min: d.durationMin,
      work_order_id: d.workOrderId ?? null,
      status: d.status,
      notes: d.notes ?? null,
    };
  });
  {
    const { error } = await supabaseAdmin.from("downtime_events").upsert(dtRows, { onConflict: "id" });
    if (error) throw new Error(`downtime_events: ${error.message}`);
    results.downtime_events = dtRows.length;
  }

  // ---- holds
  const holdRows = seedHolds.map((h) => ({
    id: h.id,
    lot_id: h.lotId,
    work_order_id: h.workOrderId,
    line_id: h.lineId,
    reason: h.reason,
    raised_by: h.raisedBy,
    raised_at: h.raisedAt,
    raised_ts: null,
    status: h.status,
    severity: h.severity,
  }));
  {
    const { error } = await supabaseAdmin.from("quality_holds").upsert(holdRows, { onConflict: "id" });
    if (error) throw new Error(`quality_holds: ${error.message}`);
    results.quality_holds = holdRows.length;
  }

  // ---- genealogy
  const genRows = seedGen.map((g) => ({
    id: g.id,
    work_order_id: g.workOrderId,
    output_lot_id: g.outputLotId,
    input_lot_id: g.inputLotId,
    material: g.material,
    supplier: g.supplier,
    qty_consumed: g.qtyConsumed,
    uom: g.uom,
    recorded_at: g.recordedAt,
  }));
  {
    const { error } = await supabaseAdmin.from("genealogy_records").upsert(genRows, { onConflict: "id" });
    if (error) throw new Error(`genealogy_records: ${error.message}`);
    results.genealogy_records = genRows.length;
  }

  // ---- audit (3-month history — chunked upsert to stay under payload caps)
  const auditRows = seededAuditLog.map((e) => ({
    id: e.id,
    at: e.at,
    actor_id: e.actorId,
    actor_name: e.actorName,
    entity: e.entity,
    entity_id: e.entityId,
    action: e.action,
    before_data: e.before ?? null,
    after_data: e.after ?? null,
    summary: e.summary,
  }));
  const CHUNK = 500;
  let inserted = 0;
  for (let i = 0; i < auditRows.length; i += CHUNK) {
    const slice = auditRows.slice(i, i + CHUNK);
    const { error } = await supabaseAdmin
      .from("audit_entries")
      .upsert(slice, { onConflict: "id" });
    if (error) throw new Error(`audit_entries chunk ${i}: ${error.message}`);
    inserted += slice.length;
  }
  results.audit_entries = inserted;

  return { ok: true, results };
});
