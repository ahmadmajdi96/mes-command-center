import type { AuditEntry, AuditAction, AuditEntity } from "./mes-data";

/**
 * Deterministic 3-month audit-log seed.
 *
 * Generates ~90 days of realistic MES activity: shift assignments, work-order
 * lifecycle, downtime events, quality holds, station/template CRUD, and
 * machine command activations. Uses a seeded PRNG so the output is stable
 * across reloads and doesn't drift between sessions.
 */

// ---- Seeded PRNG (mulberry32) — deterministic across reloads
function mulberry32(seed: number) {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = t;
    r = Math.imul(r ^ (r >>> 15), r | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(20260408);
const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(rand() * arr.length)];
const chance = (p: number) => rand() < p;
const intBetween = (a: number, b: number) => a + Math.floor(rand() * (b - a + 1));

// ---- Actor pool (mirrors src/lib/mes-data.ts users)
const actors: Array<{ id: string; name: string; role: "supervisor" | "team_lead" | "operator"; shift: "A" | "B" | "C" }> = [
  { id: "U-001", name: "Faisal Al-Mutairi", role: "supervisor", shift: "A" },
  { id: "U-002", name: "Mariam Khalid",     role: "operator",   shift: "A" },
  { id: "U-003", name: "Omar Al-Saleh",     role: "operator",   shift: "A" },
  { id: "U-004", name: "Layla Al-Maliki",   role: "team_lead",  shift: "A" },
  { id: "U-005", name: "Hassan Rashed",     role: "operator",   shift: "C" },
  { id: "U-006", name: "Noura Al-Harbi",    role: "operator",   shift: "B" },
  { id: "U-007", name: "Khalid Al-Otaibi",  role: "team_lead",  shift: "B" },
  { id: "U-008", name: "Sara Bin-Zayed",    role: "operator",   shift: "A" },
];
const operatorsByShift = {
  A: actors.filter((a) => a.shift === "A" && a.role !== "supervisor"),
  B: actors.filter((a) => a.shift === "B" && a.role !== "supervisor"),
  C: actors.filter((a) => a.shift === "C" && a.role !== "supervisor"),
};
const supervisors = actors.filter((a) => a.role === "supervisor" || a.role === "team_lead");

// ---- Shop-floor pool (mirrors seed stations/lines)
const lines = [
  { id: "L-01", name: "Mixer Line A",     plant: "Plant 01 — Riyadh" },
  { id: "L-02", name: "Oven Line B",      plant: "Plant 01 — Riyadh" },
  { id: "L-03", name: "Bottling Line C",  plant: "Plant 02 — Jeddah" },
  { id: "L-04", name: "Packaging D",      plant: "Plant 02 — Jeddah" },
  { id: "L-05", name: "Cheese Vat E",     plant: "Plant 03 — Dammam" },
  { id: "L-06", name: "Snack Fryer F",    plant: "Plant 03 — Dammam" },
];
const stationsByLine: Record<string, string[]> = {
  "L-01": ["ST-101", "ST-102", "ST-103", "ST-104", "ST-105", "ST-106"],
  "L-02": ["ST-201", "ST-202", "ST-203", "ST-204", "ST-205"],
  "L-03": ["ST-301", "ST-302", "ST-303", "ST-304"],
  "L-04": ["ST-401", "ST-402"],
  "L-05": ["ST-501", "ST-502"],
  "L-06": ["ST-601", "ST-602"],
};
const productByLine: Record<string, { sku: string; product: string; uom: string }[]> = {
  "L-01": [{ sku: "GRA-060", product: "Granola Bar 60g", uom: "ea" },
           { sku: "PRC-080", product: "Protein Cluster 80g", uom: "ea" }],
  "L-02": [{ sku: "SRD-500", product: "Sourdough Loaf 500g", uom: "ea" },
           { sku: "BAG-250", product: "Whole-wheat Baguette 250g", uom: "ea" }],
  "L-03": [{ sku: "CPJ-330", product: "Cold-Press Juice 330ml", uom: "btl" },
           { sku: "ORJ-500", product: "Orange Juice 500ml", uom: "btl" }],
  "L-04": [{ sku: "ALM-1L",  product: "Almond Milk 1L", uom: "ctn" }],
  "L-05": [{ sku: "HAL-200", product: "Halloumi 200g", uom: "ea" },
           { sku: "LAB-150", product: "Labneh 150g", uom: "cup" }],
  "L-06": [{ sku: "CHC-180", product: "Chili Crisp 180g", uom: "jar" }],
};

const downtimeReasons = [
  { code: "Capper jam",         category: "equipment_failure" },
  { code: "Sensor fault",       category: "equipment_failure" },
  { code: "Material shortage",  category: "material" },
  { code: "Changeover",         category: "planned" },
  { code: "CIP cleaning",       category: "planned" },
  { code: "Operator break",     category: "operator" },
  { code: "Quality hold",       category: "quality" },
  { code: "Power fluctuation",  category: "utility" },
  { code: "Label mis-feed",     category: "equipment_failure" },
];
const holdReasons = [
  "Brix out of spec", "Metal-detect reject", "Seal peel-test failed",
  "Weight below tolerance", "pH drift", "Foreign matter suspected",
];
const shifts = ["A", "B", "C"] as const;
const shiftWindow: Record<"A" | "B" | "C", { start: number; end: number }> = {
  A: { start: 6,  end: 14 },
  B: { start: 14, end: 22 },
  C: { start: 22, end: 30 }, // wraps to next day 06
};

function isoAt(day: Date, hour: number, minute: number, second = 0): string {
  const d = new Date(day);
  d.setHours(hour % 24, minute, second, 0);
  if (hour >= 24) d.setDate(d.getDate() + 1);
  return d.toISOString();
}

let seq = 1;
function make(
  at: string,
  actor: { id: string; name: string },
  entity: AuditEntity,
  entityId: string,
  action: AuditAction,
  summary: string,
  before: any = null,
  after: any = null,
): AuditEntry {
  return {
    id: `AU-${String(seq++).padStart(5, "0")}`,
    at,
    actorId: actor.id,
    actorName: actor.name,
    entity,
    entityId,
    action,
    before,
    after,
    summary,
  };
}

function generate(): AuditEntry[] {
  const entries: AuditEntry[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let woCounter = 1;
  const nextWoId = () => `WO-24H-${String(woCounter++).padStart(4, "0")}`;

  // Iterate day-by-day, 90 days back → today
  for (let dayOffset = 90; dayOffset >= 0; dayOffset--) {
    const day = new Date(today);
    day.setDate(day.getDate() - dayOffset);
    const dow = day.getDay(); // 0=Sun … 6=Sat
    const isWeekend = dow === 5 || dow === 6; // KSA weekend Fri/Sat
    const activityLines = isWeekend ? lines.slice(0, 3) : lines;

    // Occasional master-data changes (rare)
    if (chance(0.08)) {
      const sup = pick(supervisors);
      const tplId = `TPL-${String(intBetween(8, 20)).padStart(2, "0")}`;
      entries.push(make(
        isoAt(day, 8, intBetween(5, 55)), sup, "step_template", tplId,
        chance(0.5) ? "update" : "create",
        `${chance(0.5) ? "Updated" : "Created"} step template ${tplId}`,
      ));
    }
    if (chance(0.05)) {
      const sup = pick(supervisors);
      const stId = pick(stationsByLine[pick(Object.keys(stationsByLine))]);
      entries.push(make(
        isoAt(day, 9, intBetween(0, 30)), sup, "station", stId, "update",
        `Adjusted cycle-time target on ${stId}`,
        { cycleTimeSec: intBetween(60, 300) }, { cycleTimeSec: intBetween(60, 300) },
      ));
    }

    // Per line, per shift: run a work-order cycle
    for (const line of activityLines) {
      for (const shift of shifts) {
        if (isWeekend && shift === "C") continue;
        // Skip some shifts randomly so it isn't perfectly uniform
        if (chance(0.15)) continue;

        const win = shiftWindow[shift];
        const ops = operatorsByShift[shift];
        if (ops.length === 0) continue;
        const lead = ops.find((o) => o.role === "team_lead") ?? ops[0];
        const operator = pick(ops);
        const sup = pick(supervisors);

        // 1) Assign operator to a station on this line at shift start
        const startStation = pick(stationsByLine[line.id]);
        const asmtId = `AS-${String(seq).padStart(5, "0")}`;
        entries.push(make(
          isoAt(day, win.start, intBetween(0, 8)), sup, "assignment", asmtId, "create",
          `Assigned ${operator.name} → station ${startStation} (${line.name}, Shift ${shift})`,
          null,
          { userId: operator.id, targetType: "station", targetId: startStation, shift, active: true },
        ));

        // 2) Start a work order
        const woId = nextWoId();
        const prod = pick(productByLine[line.id]);
        const qtyTarget = intBetween(2000, 12000);
        entries.push(make(
          isoAt(day, win.start, intBetween(9, 20)), lead, "work_order", woId, "create",
          `Started WO ${woId} — ${prod.product} on ${line.name} (target ${qtyTarget.toLocaleString()} ${prod.uom})`,
          null,
          { productionOrderId: `PO-${intBetween(90000, 99999)}`, lineId: line.id, product: prod.product, sku: prod.sku, qtyTarget, uom: prod.uom, shift, status: "running" },
        ));

        // 3) Mid-shift downtime events (0–3)
        const dtCount = intBetween(0, 3);
        let totalDown = 0;
        for (let i = 0; i < dtCount; i++) {
          const reason = pick(downtimeReasons);
          const hour = intBetween(win.start + 1, win.end - 1);
          const durMin = reason.category === "planned" ? intBetween(15, 45) : intBetween(3, 35);
          totalDown += durMin;
          const stId = pick(stationsByLine[line.id]);
          const dtId = `DT-${String(seq).padStart(5, "0")}`;
          entries.push(make(
            isoAt(day, hour, intBetween(0, 59)), operator, "downtime", dtId, "create",
            `Downtime "${reason.code}" on ${stId} — ${durMin}m`,
            null,
            { lineId: line.id, stationId: stId, reasonCode: reason.code, category: reason.category, durationMin: durMin, status: "open", operatorId: operator.id, operatorName: operator.name },
          ));
          // Resolve later (mostly same shift)
          if (chance(0.85)) {
            entries.push(make(
              isoAt(day, hour, intBetween(0, 59) + Math.min(59, durMin)), lead, "downtime", dtId, "update",
              `Resolved downtime ${dtId} (${reason.code})`,
              { status: "open" }, { status: "resolved" },
            ));
          }
        }

        // 4) Occasional quality hold (CCP fail)
        if (chance(0.12)) {
          const qhId = `QH-${String(seq).padStart(5, "0")}`;
          const reason = pick(holdReasons);
          entries.push(make(
            isoAt(day, intBetween(win.start + 1, win.end - 1), intBetween(0, 59)),
            lead, "hold", qhId, "create",
            `Quality hold raised — ${reason} on ${line.name}`,
            null, { lineId: line.id, woId, reason, status: "open" },
          ));
          if (chance(0.7)) {
            entries.push(make(
              isoAt(day, win.end - 1, intBetween(0, 30)), sup, "hold", qhId, "update",
              `Released quality hold ${qhId}`,
              { status: "open" }, { status: "released" },
            ));
          }
        }

        // 5) Machine command activations on automatic stations (CCP + seal + metal detect)
        const autoStations = stationsByLine[line.id].filter((_, idx) => idx > 0);
        const cmdCount = intBetween(1, 4);
        for (let i = 0; i < cmdCount; i++) {
          const stId = pick(autoStations);
          const hour = intBetween(win.start, win.end - 1);
          const isAccept = chance(0.9);
          entries.push(make(
            isoAt(day, hour, intBetween(0, 59), intBetween(0, 59)),
            operator, "station", stId, isAccept ? "activate" : "deactivate",
            `${isAccept ? "ACCEPT" : "REJECT"} sent to ${stId} via OPC-UA (${isAccept ? "ACK" : "NAK"})`,
            null,
            { command: isAccept ? "ACK" : "NAK", protocol: "OPC-UA" },
          ));
        }

        // 6) Reassign / unassign toward end of shift
        if (chance(0.35)) {
          const newStation = pick(stationsByLine[line.id]);
          entries.push(make(
            isoAt(day, win.end - 2, intBetween(0, 45)), sup, "assignment", asmtId, "update",
            `Reassigned ${operator.name}: ${startStation} → ${newStation}`,
            { targetId: startStation }, { targetId: newStation },
          ));
        }
        entries.push(make(
          isoAt(day, win.end, intBetween(0, 15)), sup, "assignment", asmtId, "deactivate",
          `Unassigned ${operator.name} — end of Shift ${shift}`,
          { active: true }, { active: false },
        ));

        // 7) Close work order
        const produced = Math.max(0, qtyTarget - intBetween(0, Math.floor(qtyTarget * 0.15)) - totalDown * 6);
        const status = produced >= qtyTarget * 0.98 ? "completed" : produced > qtyTarget * 0.5 ? "completed" : "hold";
        entries.push(make(
          isoAt(day, win.end, intBetween(15, 55)), lead, "work_order", woId,
          status === "completed" ? "update" : "update",
          `${status === "completed" ? "Completed" : "Paused"} WO ${woId} — produced ${produced.toLocaleString()} / ${qtyTarget.toLocaleString()} ${prod.uom}`,
          { status: "running", qtyProduced: 0 }, { status, qtyProduced: produced, progress: Math.min(100, Math.round((produced / qtyTarget) * 100)) },
        ));
      }
    }

    // Weekly maintenance (Sundays)
    if (dow === 0 && chance(0.7)) {
      const sup = pick(supervisors);
      const stId = pick(stationsByLine[pick(Object.keys(stationsByLine))]);
      entries.push(make(
        isoAt(day, 5, intBetween(0, 30)), sup, "station", stId, "update",
        `Preventive maintenance completed on ${stId}`,
        { status: "maintenance" }, { status: "idle" },
      ));
    }
  }

  // Sort newest first (traceability page consumes chronological order)
  entries.sort((a, b) => (a.at < b.at ? 1 : -1));
  // Re-id in reverse chronological order so AU-00001 = most recent
  entries.forEach((e, i) => { e.id = `AU-${String(i + 1).padStart(5, "0")}`; });
  return entries;
}

export const seededAuditLog: AuditEntry[] = generate();
