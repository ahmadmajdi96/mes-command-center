// Mock data for MES demo
export type LineStatus = "running" | "idle" | "down" | "changeover";

export interface ProductionLine {
  id: string;
  name: string;
  plant: string;
  status: LineStatus;
  oee: number;
  availability: number;
  performance: number;
  quality: number;
  currentWorkOrder?: string;
  product?: string;
  output: number;
  target: number;
  uptime: string;
}

export const lines: ProductionLine[] = [
  { id: "L-01", name: "Mixer Line A", plant: "Plant 01 — Riyadh", status: "running", oee: 87, availability: 94, performance: 96, quality: 96, currentWorkOrder: "WO-2401-118", product: "Granola Bar 60g", output: 8420, target: 10000, uptime: "6h 12m" },
  { id: "L-02", name: "Oven Line B", plant: "Plant 01 — Riyadh", status: "running", oee: 78, availability: 88, performance: 91, quality: 97, currentWorkOrder: "WO-2401-119", product: "Sourdough Loaf 500g", output: 5210, target: 7200, uptime: "4h 48m" },
  { id: "L-03", name: "Bottling Line C", plant: "Plant 02 — Jeddah", status: "down", oee: 42, availability: 55, performance: 84, quality: 91, currentWorkOrder: "WO-2401-120", product: "Cold-Press Juice 330ml", output: 2100, target: 9000, uptime: "1h 04m" },
  { id: "L-04", name: "Packaging D", plant: "Plant 02 — Jeddah", status: "changeover", oee: 0, availability: 0, performance: 0, quality: 0, output: 0, target: 0, uptime: "—" },
  { id: "L-05", name: "Cheese Vat E", plant: "Plant 03 — Dammam", status: "running", oee: 92, availability: 97, performance: 95, quality: 100, currentWorkOrder: "WO-2401-121", product: "Halloumi 200g", output: 1820, target: 2000, uptime: "7h 41m" },
  { id: "L-06", name: "Snack Fryer F", plant: "Plant 03 — Dammam", status: "idle", oee: 0, availability: 0, performance: 0, quality: 0, output: 0, target: 0, uptime: "—" },
];

export type WOStatus = "scheduled" | "running" | "paused" | "hold" | "completed";
export interface WorkOrder {
  id: string;
  productionOrderId: string;
  lineId: string;
  product: string;
  sku: string;
  status: WOStatus;
  qtyTarget: number;
  qtyProduced: number;
  uom: string;
  startedAt?: string;
  endsAt?: string;
  operator?: string;
  shift: "A" | "B" | "C";
  progress: number;
}

export const workOrders: WorkOrder[] = [
  { id: "WO-2401-118", productionOrderId: "PO-99812", lineId: "L-01", product: "Granola Bar 60g", sku: "GRA-060", status: "running", qtyTarget: 10000, qtyProduced: 8420, uom: "ea", startedAt: "06:00", endsAt: "14:00", operator: "Faisal A.", shift: "A", progress: 84 },
  { id: "WO-2401-119", productionOrderId: "PO-99813", lineId: "L-02", product: "Sourdough Loaf 500g", sku: "SRD-500", status: "running", qtyTarget: 7200, qtyProduced: 5210, uom: "ea", startedAt: "06:30", endsAt: "14:30", operator: "Mariam K.", shift: "A", progress: 72 },
  { id: "WO-2401-120", productionOrderId: "PO-99814", lineId: "L-03", product: "Cold-Press Juice 330ml", sku: "CPJ-330", status: "hold", qtyTarget: 9000, qtyProduced: 2100, uom: "btl", startedAt: "07:10", endsAt: "15:10", operator: "Omar S.", shift: "A", progress: 23 },
  { id: "WO-2401-121", productionOrderId: "PO-99815", lineId: "L-05", product: "Halloumi 200g", sku: "HAL-200", status: "running", qtyTarget: 2000, qtyProduced: 1820, uom: "ea", startedAt: "05:50", endsAt: "13:50", operator: "Layla M.", shift: "A", progress: 91 },
  { id: "WO-2401-122", productionOrderId: "PO-99816", lineId: "L-04", product: "Almond Milk 1L", sku: "ALM-1L", status: "scheduled", qtyTarget: 4500, qtyProduced: 0, uom: "ctn", startedAt: "14:30", endsAt: "22:30", operator: "—", shift: "B", progress: 0 },
  { id: "WO-2401-123", productionOrderId: "PO-99817", lineId: "L-06", product: "Chili Crisp 180g", sku: "CHC-180", status: "scheduled", qtyTarget: 3200, qtyProduced: 0, uom: "jar", startedAt: "15:00", endsAt: "23:00", operator: "—", shift: "B", progress: 0 },
  { id: "WO-2401-117", productionOrderId: "PO-99811", lineId: "L-01", product: "Protein Cluster 80g", sku: "PRC-080", status: "completed", qtyTarget: 6500, qtyProduced: 6478, uom: "ea", startedAt: "Yesterday 22:00", endsAt: "Today 05:30", operator: "Hassan R.", shift: "C", progress: 100 },
];

export interface RecipeStep {
  id: string;
  workOrderId: string;
  sequence: number;
  instruction: string;
  target: string;
  tolerance: string;
  status: "done" | "active" | "pending" | "warn";
  capturedValue?: string;
}

export const recipeSteps: RecipeStep[] = [
  { id: "S1", workOrderId: "WO-2401-118", sequence: 1, instruction: "Pre-heat mixing vessel to target temperature", target: "65°C", tolerance: "±2°C", status: "done", capturedValue: "64.8°C" },
  { id: "S2", workOrderId: "WO-2401-118", sequence: 2, instruction: "Scan and load oat lot — verify quantity", target: "240 kg", tolerance: "±0.5 kg", status: "done", capturedValue: "240.2 kg" },
  { id: "S3", workOrderId: "WO-2401-118", sequence: 3, instruction: "Scan honey lot LOT-HNY-44219 and pump", target: "85 kg", tolerance: "±0.3 kg", status: "done", capturedValue: "84.9 kg" },
  { id: "S4", workOrderId: "WO-2401-118", sequence: 4, instruction: "Mix for 8 minutes at speed 3", target: "8:00", tolerance: "±00:10", status: "active", capturedValue: "5:42 elapsed" },
  { id: "S5", workOrderId: "WO-2401-118", sequence: 5, instruction: "Transfer to extrusion conveyor", target: "—", tolerance: "—", status: "pending" },
  { id: "S6", workOrderId: "WO-2401-118", sequence: 6, instruction: "CCP — metal detector check (test wand)", target: "PASS", tolerance: "—", status: "pending" },
  { id: "S7", workOrderId: "WO-2401-118", sequence: 7, instruction: "Wrap and seal — verify seal temperature", target: "148°C", tolerance: "±3°C", status: "pending" },
  { id: "S8", workOrderId: "WO-2401-118", sequence: 8, instruction: "Case-pack 24 units per case, palletize", target: "—", tolerance: "—", status: "pending" },
];

export interface GenealogyRecord {
  id: string;
  workOrderId: string;
  outputLotId: string;
  inputLotId: string;
  material: string;
  supplier: string;
  qtyConsumed: number;
  uom: string;
  recordedAt: string;
}

export const genealogy: GenealogyRecord[] = [
  { id: "G-001", workOrderId: "WO-2401-118", outputLotId: "LOT-GRA060-24A11", inputLotId: "LOT-OAT-88112", material: "Rolled Oats — Organic", supplier: "Al-Rawabi Grains", qtyConsumed: 240.2, uom: "kg", recordedAt: "08:14" },
  { id: "G-002", workOrderId: "WO-2401-118", outputLotId: "LOT-GRA060-24A11", inputLotId: "LOT-HNY-44219", material: "Wildflower Honey", supplier: "Najd Apiaries", qtyConsumed: 84.9, uom: "kg", recordedAt: "08:21" },
  { id: "G-003", workOrderId: "WO-2401-118", outputLotId: "LOT-GRA060-24A11", inputLotId: "LOT-ALM-72104", material: "Almond Slivers", supplier: "Levant Nut Co.", qtyConsumed: 48.0, uom: "kg", recordedAt: "08:25" },
  { id: "G-004", workOrderId: "WO-2401-119", outputLotId: "LOT-SRD500-24A07", inputLotId: "LOT-FLR-50331", material: "Bread Flour T65", supplier: "Riyadh Mills", qtyConsumed: 320.0, uom: "kg", recordedAt: "07:02" },
  { id: "G-005", workOrderId: "WO-2401-120", outputLotId: "LOT-CPJ330-24A03", inputLotId: "LOT-ORG-99001", material: "Valencia Oranges", supplier: "Mediterra Farms", qtyConsumed: 1840, uom: "kg", recordedAt: "07:48" },
  { id: "G-006", workOrderId: "WO-2401-121", outputLotId: "LOT-HAL200-24A02", inputLotId: "LOT-MLK-31229", material: "Goat Milk — Pasteurized", supplier: "Dammam Dairy", qtyConsumed: 1200, uom: "L", recordedAt: "06:31" },
];

export interface DowntimeEvent {
  id: string;
  lineId: string;
  lineName: string;
  reasonCode: string;
  category: "equipment_failure" | "changeover" | "material_shortage" | "quality_hold" | "operator_break";
  startedAt: string;
  durationMin: number;
  workOrderId?: string;
  status: "open" | "resolved";
  notes?: string;
}

export const downtime: DowntimeEvent[] = [
  { id: "DT-401", lineId: "L-03", lineName: "Bottling Line C", reasonCode: "Capper jam", category: "equipment_failure", startedAt: "08:42", durationMin: 28, workOrderId: "WO-2401-120", status: "open", notes: "Maintenance dispatched — auto WO created in CMMS" },
  { id: "DT-400", lineId: "L-04", lineName: "Packaging D", reasonCode: "SKU changeover", category: "changeover", startedAt: "08:10", durationMin: 45, status: "open" },
  { id: "DT-399", lineId: "L-02", lineName: "Oven Line B", reasonCode: "Awaiting raw lot", category: "material_shortage", startedAt: "07:30", durationMin: 12, workOrderId: "WO-2401-119", status: "resolved" },
  { id: "DT-398", lineId: "L-01", lineName: "Mixer Line A", reasonCode: "Operator handover", category: "operator_break", startedAt: "06:45", durationMin: 8, status: "resolved" },
  { id: "DT-397", lineId: "L-05", lineName: "Cheese Vat E", reasonCode: "CCP retest", category: "quality_hold", startedAt: "06:12", durationMin: 6, workOrderId: "WO-2401-121", status: "resolved" },
];

export interface QualityHold {
  id: string;
  lotId: string;
  workOrderId: string;
  lineId: string;
  reason: string;
  raisedBy: string;
  raisedAt: string;
  status: "open" | "released" | "rejected";
  severity: "low" | "medium" | "high";
}

export const holds: QualityHold[] = [
  { id: "QH-77", lotId: "LOT-CPJ330-24A03", workOrderId: "WO-2401-120", lineId: "L-03", reason: "Brix out of spec (10.8 vs 11.5 target)", raisedBy: "Omar S.", raisedAt: "08:50", status: "open", severity: "high" },
  { id: "QH-76", lotId: "LOT-SRD500-24A07", workOrderId: "WO-2401-119", lineId: "L-02", reason: "Crust color reading below threshold", raisedBy: "Mariam K.", raisedAt: "08:18", status: "open", severity: "medium" },
  { id: "QH-75", lotId: "LOT-HAL200-24A02", workOrderId: "WO-2401-121", lineId: "L-05", reason: "Routine CCP retest — passed", raisedBy: "Layla M.", raisedAt: "06:12", status: "released", severity: "low" },
  { id: "QH-74", lotId: "LOT-GRA060-24A10", workOrderId: "WO-2401-117", lineId: "L-01", reason: "Foreign object detected — segregated", raisedBy: "Hassan R.", raisedAt: "Yesterday", status: "rejected", severity: "high" },
];

// Time-series mock for sensors and OEE trend
function gen(n: number, base: number, variance: number, seed = 1) {
  const out: { t: string; v: number }[] = [];
  let s = seed;
  for (let i = 0; i < n; i++) {
    s = (s * 9301 + 49297) % 233280;
    const r = s / 233280;
    const v = base + (r - 0.5) * variance + Math.sin(i / 3) * variance * 0.3;
    const totalMin = (i * 2) % (24 * 60);
    const hh = Math.floor(totalMin / 60).toString().padStart(2, "0");
    const mm = (totalMin % 60).toString().padStart(2, "0");
    out.push({ t: `${hh}:${mm}`, v: Math.round(v * 10) / 10 });
  }
  return out;
}

export const sensorSeries = {
  temperature: gen(40, 65, 4, 13),
  pressure: gen(40, 2.4, 0.4, 27),
  speed: gen(40, 142, 18, 41),
  weight: gen(40, 60.1, 1.2, 55),
};

export const oeeTrend = Array.from({ length: 12 }, (_, i) => {
  const seed = i * 17 + 3;
  const av = 80 + ((seed * 31) % 18);
  const pe = 78 + ((seed * 47) % 20);
  const qu = 92 + ((seed * 11) % 8);
  return {
    hour: `${(i + 6).toString().padStart(2, "0")}:00`,
    availability: av,
    performance: pe,
    quality: qu,
    oee: Math.round((av * pe * qu) / 10000),
  };
});

export const downtimeReasons = [
  { name: "Equipment failure", value: 42, color: "var(--color-destructive)" },
  { name: "Changeover", value: 28, color: "var(--color-accent)" },
  { name: "Material shortage", value: 15, color: "var(--color-warning)" },
  { name: "Quality hold", value: 9, color: "var(--color-info)" },
  { name: "Operator break", value: 6, color: "var(--color-muted-foreground)" },
];

export interface AndonAlert {
  id: string;
  level: "info" | "warn" | "critical";
  source: string;
  message: string;
  at: string;
}

export const andonAlerts: AndonAlert[] = [
  { id: "A1", level: "critical", source: "L-03 · Bottling", message: "Capper jam — line stopped 28 min", at: "08:42" },
  { id: "A2", level: "critical", source: "L-03 · Brix sensor", message: "Threshold breached — quality hold raised", at: "08:50" },
  { id: "A3", level: "warn", source: "L-02 · Oven", message: "Zone 3 temperature drift +4°C", at: "08:33" },
  { id: "A4", level: "warn", source: "L-04 · Packaging", message: "Changeover taking longer than standard", at: "08:55" },
  { id: "A5", level: "info", source: "L-01 · Mixer", message: "WO-2401-118 reached 80% of target", at: "08:48" },
  { id: "A6", level: "info", source: "L-05 · Cheese Vat", message: "CCP retest passed", at: "06:12" },
];

export const plantKpis = {
  oee: 76,
  availability: 84,
  performance: 89,
  quality: 96,
  goodUnits: 17570,
  scrap: 312,
  activeLines: 4,
  totalLines: 6,
  openAlerts: 4,
  openHolds: 2,
};
