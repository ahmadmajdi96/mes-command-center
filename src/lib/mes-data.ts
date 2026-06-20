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

// ============ Stations & Machines ============
export type StationType = "manual" | "automatic";
export type StationStatus = "running" | "idle" | "down" | "maintenance";
export type CommProtocol = "OPC-UA" | "MQTT" | "Modbus-TCP" | "EtherNet/IP" | "Profinet" | "REST";

export type OutputKind = "text" | "file" | "none";

export interface Machine {
  model: string;
  vendor: string;
  ipAddress: string;
  port: number;
  protocol: CommProtocol;
  receivedDataTypes: string;   // comma-separated tag list ingested from the machine
  sentDataTypes: string;       // comma-separated commands/setpoints written to the machine
  firmware?: string;
  /** What this station emits as output of the step */
  outputKind?: OutputKind;
  /** Filename pattern or text label of the output payload */
  outputLabel?: string;
  /** Protocol used to deliver accept/reject decisions back to the machine */
  outputProtocol?: CommProtocol;
  /** Command string sent on ACCEPT decision (e.g. "ACK", "PASS") */
  acceptCommand?: string;
  /** Command string sent on REJECT decision (e.g. "NAK", "REJ") */
  rejectCommand?: string;
}

export interface Station {
  id: string;
  lineId: string;
  name: string;
  sequence: number;
  type: StationType;
  status: StationStatus;
  cycleTimeSec: number;
  currentStep?: string;
  currentValue?: string;
  target?: string;
  oee?: number;
  machine?: Machine;
  /** Step templates applied to this station (must contain at least one on creation) */
  templateIds?: string[];
  /** Timestamp of last live telemetry tick — drives the "live" badge */
  lastTickAt?: string;
}

export const stations: Station[] = [
  // L-01 Mixer Line A
  { id: "ST-101", lineId: "L-01", name: "Raw Intake", sequence: 1, type: "manual", status: "running", cycleTimeSec: 90, currentStep: "Scan oat lot LOT-OAT-88112", currentValue: "240.2 kg", target: "240 kg", oee: 94 },
  { id: "ST-102", lineId: "L-01", name: "Mixing Vessel M1", sequence: 2, type: "automatic", status: "running", cycleTimeSec: 480, currentStep: "Mix @ speed 3", currentValue: "5:42", target: "8:00", oee: 91,
    machine: { model: "Vortex-X9", vendor: "Bühler", ipAddress: "10.21.4.12", port: 4840, protocol: "OPC-UA",
      receivedDataTypes: "temp_c,pressure_bar,rpm,torque_nm,vibration", sentDataTypes: "setpoint_rpm,recipe_id,start,stop", firmware: "v3.18.2" } },
  { id: "ST-103", lineId: "L-01", name: "Extruder E2", sequence: 3, type: "automatic", status: "running", cycleTimeSec: 25, currentStep: "Extrude bar form", currentValue: "60.1 g", target: "60.0 g ±1", oee: 88,
    machine: { model: "EX-2200", vendor: "Reading Bakery", ipAddress: "10.21.4.13", port: 1883, protocol: "MQTT",
      receivedDataTypes: "die_pressure,output_weight,blade_speed", sentDataTypes: "speed_pct,cut_length_mm", firmware: "v2.4.1" } },
  { id: "ST-104", lineId: "L-01", name: "Metal Detector (CCP)", sequence: 4, type: "automatic", status: "running", cycleTimeSec: 1, currentStep: "Inline scan", currentValue: "PASS", target: "PASS", oee: 99,
    machine: { model: "Safeline IQ4", vendor: "Mettler-Toledo", ipAddress: "10.21.4.14", port: 502, protocol: "Modbus-TCP",
      receivedDataTypes: "ferrous_mv,non_ferrous_mv,reject_count", sentDataTypes: "test_signal,reset" } },
  { id: "ST-105", lineId: "L-01", name: "Wrap & Seal", sequence: 5, type: "automatic", status: "idle", cycleTimeSec: 4, currentStep: "Awaiting product", currentValue: "148°C", target: "148°C ±3", oee: 86,
    machine: { model: "FlowPack FP-9", vendor: "Bosch", ipAddress: "10.21.4.15", port: 44818, protocol: "EtherNet/IP",
      receivedDataTypes: "jaw_temp,film_tension,seal_count", sentDataTypes: "jaw_setpoint,film_speed" } },
  { id: "ST-106", lineId: "L-01", name: "Case Pack & Palletize", sequence: 6, type: "manual", status: "running", cycleTimeSec: 28, currentStep: "24 units / case", currentValue: "342 cases", target: "420 cases", oee: 82 },

  // L-02 Oven Line B
  { id: "ST-201", lineId: "L-02", name: "Dough Mixer", sequence: 1, type: "automatic", status: "running", cycleTimeSec: 600, currentStep: "Knead cycle", currentValue: "12.4 kWh", target: "—", oee: 90,
    machine: { model: "Spiral-X 240", vendor: "Diosna", ipAddress: "10.22.4.21", port: 4840, protocol: "OPC-UA",
      receivedDataTypes: "torque,dough_temp,hook_speed", sentDataTypes: "speed_setpoint,timer" } },
  { id: "ST-202", lineId: "L-02", name: "Proofer", sequence: 2, type: "automatic", status: "running", cycleTimeSec: 1800, currentStep: "Proof 30 min", currentValue: "32°C / 78% RH", target: "32°C / 80% RH", oee: 93,
    machine: { model: "ClimaProof CP-6", vendor: "Koenig", ipAddress: "10.22.4.22", port: 1883, protocol: "MQTT",
      receivedDataTypes: "temp,humidity,co2", sentDataTypes: "temp_setpoint,humidity_setpoint" } },
  { id: "ST-203", lineId: "L-02", name: "Tunnel Oven", sequence: 3, type: "automatic", status: "running", cycleTimeSec: 1080, currentStep: "Bake 18 min", currentValue: "Z1 210 / Z2 220 / Z3 196°C", target: "Z3 200°C ±4", oee: 87,
    machine: { model: "Mecatherm M-Tunnel", vendor: "Mecatherm", ipAddress: "10.22.4.23", port: 4840, protocol: "OPC-UA",
      receivedDataTypes: "zone1_t,zone2_t,zone3_t,belt_speed,steam_flow", sentDataTypes: "zone_setpoint,belt_setpoint,steam_cmd", firmware: "v5.2.0" } },
  { id: "ST-204", lineId: "L-02", name: "Cooler & Slicer", sequence: 4, type: "automatic", status: "running", cycleTimeSec: 240, currentStep: "Slice 14 mm", currentValue: "13.9 mm", target: "14 mm ±0.5", oee: 89,
    machine: { model: "JAC SelfBoy", vendor: "JAC", ipAddress: "10.22.4.24", port: 502, protocol: "Modbus-TCP",
      receivedDataTypes: "blade_pos,blade_count,jam_flag", sentDataTypes: "slice_mm,start_stop" } },
  { id: "ST-205", lineId: "L-02", name: "Bagger", sequence: 5, type: "manual", status: "running", cycleTimeSec: 6, currentStep: "Hand-bag 500g", currentValue: "486 bags", target: "600 bags", oee: 81 },

  // L-03 Bottling Line C
  { id: "ST-301", lineId: "L-03", name: "Press Room", sequence: 1, type: "automatic", status: "running", cycleTimeSec: 60, currentStep: "Press oranges", currentValue: "182 L/h", target: "200 L/h", oee: 84,
    machine: { model: "HPP-300", vendor: "Hiperbaric", ipAddress: "10.23.4.31", port: 4840, protocol: "OPC-UA",
      receivedDataTypes: "press_bar,flow_lph,brix", sentDataTypes: "press_setpoint,batch_id" } },
  { id: "ST-302", lineId: "L-03", name: "Filler", sequence: 2, type: "automatic", status: "down", cycleTimeSec: 2, currentStep: "Awaiting capper", currentValue: "—", target: "330 ml ±2", oee: 0,
    machine: { model: "Krones VarioFill", vendor: "Krones", ipAddress: "10.23.4.32", port: 44818, protocol: "EtherNet/IP",
      receivedDataTypes: "fill_volume,nozzle_count,foam_alarm", sentDataTypes: "fill_setpoint,start_stop" } },
  { id: "ST-303", lineId: "L-03", name: "Capper (FAULT)", sequence: 3, type: "automatic", status: "down", cycleTimeSec: 2, currentStep: "Capper jam — maintenance dispatched", currentValue: "ERR-44", target: "—", oee: 0,
    machine: { model: "AromaSeal AS-12", vendor: "GEA", ipAddress: "10.23.4.33", port: 502, protocol: "Modbus-TCP",
      receivedDataTypes: "torque,head_pos,fault_code", sentDataTypes: "reset,jog_cw,jog_ccw" } },
  { id: "ST-304", lineId: "L-03", name: "Labeler", sequence: 4, type: "automatic", status: "idle", cycleTimeSec: 1, currentStep: "Idle (upstream stopped)", currentValue: "—", target: "—", oee: 0,
    machine: { model: "Sleever C-9", vendor: "Sleever", ipAddress: "10.23.4.34", port: 1883, protocol: "MQTT",
      receivedDataTypes: "label_count,reel_diameter", sentDataTypes: "shrink_temp,start_stop" } },

  // L-05 Cheese Vat E
  { id: "ST-501", lineId: "L-05", name: "Pasteurizer", sequence: 1, type: "automatic", status: "running", cycleTimeSec: 900, currentStep: "HTST 72°C / 15s", currentValue: "72.4°C", target: "72°C ±0.5", oee: 95,
    machine: { model: "Tetra Therm Aseptic", vendor: "Tetra Pak", ipAddress: "10.25.4.51", port: 4840, protocol: "OPC-UA",
      receivedDataTypes: "in_temp,out_temp,hold_time,flow_lph", sentDataTypes: "temp_setpoint,divert_cmd", firmware: "v4.7.1" } },
  { id: "ST-502", lineId: "L-05", name: "Curd Vat", sequence: 2, type: "manual", status: "running", cycleTimeSec: 2400, currentStep: "Cut curd", currentValue: "pH 6.42", target: "pH 6.4 ±0.05", oee: 92 },
  { id: "ST-503", lineId: "L-05", name: "Brining Tank", sequence: 3, type: "automatic", status: "running", cycleTimeSec: 1200, currentStep: "Brine soak", currentValue: "18.1% NaCl", target: "18% ±0.5", oee: 96,
    machine: { model: "BrineCtrl 200", vendor: "Alfa Laval", ipAddress: "10.25.4.53", port: 502, protocol: "Modbus-TCP",
      receivedDataTypes: "salinity,temp,level", sentDataTypes: "agitate_cmd,refill_cmd" } },
  { id: "ST-504", lineId: "L-05", name: "Vacuum Pack", sequence: 4, type: "manual", status: "running", cycleTimeSec: 20, currentStep: "Pack 200g", currentValue: "91 units", target: "100 units", oee: 88 },
];

// ============ Step Templates ============
/** A reusable step definition that can be applied to one or more (typically automatic) stations. */
export interface StepTemplate {
  id: string;
  name: string;
  category: "process" | "ccp" | "quality_check" | "changeover" | "cleaning";
  /** Default target value (e.g. "72°C", "PASS", "240 kg") */
  defaultTarget: string;
  /** Default tolerance (e.g. "±2°C", "±0.5 kg") */
  defaultTolerance: string;
  /** Critical control point — failure blocks the line */
  isCCP: boolean;
  /** Auto-raise a quality hold when the captured value is out of tolerance */
  holdOnFailure: boolean;
  /** Comma-separated machine tag names this step should read from */
  sensorBindings: string;
  /** Operator-facing instruction shown in the operator console */
  instruction: string;
  /** Recommended station type for this template */
  appliesTo: "automatic" | "manual" | "both";
}

export const stepTemplates: StepTemplate[] = [
  { id: "TPL-01", name: "HTST Pasteurization", category: "ccp", defaultTarget: "72°C", defaultTolerance: "±0.5°C", isCCP: true, holdOnFailure: true, sensorBindings: "in_temp,out_temp,hold_time", instruction: "Verify pasteurizer holds product at 72°C for ≥15s. Divert on any deviation.", appliesTo: "automatic" },
  { id: "TPL-02", name: "Inline Metal Detection", category: "ccp", defaultTarget: "PASS", defaultTolerance: "—", isCCP: true, holdOnFailure: true, sensorBindings: "ferrous_mv,non_ferrous_mv,reject_count", instruction: "Confirm 3-wand test passes (Fe/NFe/SS). Auto-reject must engage.", appliesTo: "automatic" },
  { id: "TPL-03", name: "Heat Seal Verification", category: "quality_check", defaultTarget: "148°C", defaultTolerance: "±3°C", isCCP: false, holdOnFailure: true, sensorBindings: "jaw_temp,seal_count", instruction: "Confirm seal jaws are within tolerance and seal sample passes peel test.", appliesTo: "automatic" },
  { id: "TPL-04", name: "Mixer Cycle (Standard)", category: "process", defaultTarget: "8:00", defaultTolerance: "±00:10", isCCP: false, holdOnFailure: false, sensorBindings: "rpm,torque_nm,temp_c", instruction: "Run mixer at speed 3 for 8 minutes; log torque and temperature.", appliesTo: "automatic" },
  { id: "TPL-05", name: "Sanitation Wash (CIP)", category: "cleaning", defaultTarget: "85°C / 20 min", defaultTolerance: "±2°C", isCCP: false, holdOnFailure: false, sensorBindings: "cip_temp,cip_flow,caustic_conc", instruction: "Run CIP cycle: pre-rinse → caustic → rinse → sanitize. Verify endpoint conductivity.", appliesTo: "automatic" },
  { id: "TPL-06", name: "Lot Scan & Weigh-In", category: "process", defaultTarget: "as per BOM", defaultTolerance: "±0.5 kg", isCCP: false, holdOnFailure: true, sensorBindings: "scale_weight", instruction: "Scan inbound raw lot, weigh against BOM target, capture batch number.", appliesTo: "both" },
  { id: "TPL-07", name: "Brix / Refractometer Check", category: "quality_check", defaultTarget: "11.5 °Bx", defaultTolerance: "±0.3 °Bx", isCCP: false, holdOnFailure: true, sensorBindings: "brix", instruction: "Sample product and read Brix. Hold batch if out of spec.", appliesTo: "both" },
];

// ============ Audit Log ============
export type AuditAction = "create" | "update" | "delete" | "activate" | "deactivate";
export type AuditEntity =
  | "line" | "station" | "user" | "team" | "assignment"
  | "work_order" | "downtime" | "hold" | "genealogy" | "step" | "step_template";

export interface AuditEntry {
  id: string;
  at: string;          // ISO timestamp
  actorId: string;     // user id
  actorName: string;
  entity: AuditEntity;
  entityId: string;
  action: AuditAction;
  before?: Record<string, any> | null;
  after?: Record<string, any> | null;
  summary: string;
}
export const auditEntries: AuditEntry[] = [];

// ============ Users ============
export type UserRole = "operator" | "supervisor" | "team_lead";
export type UserStatus = "active" | "off-shift" | "on-break" | "inactive";

export interface MesUser {
  id: string;
  name: string;
  mobile: string;
  email: string;
  role: UserRole;
  shift: "A" | "B" | "C";
  status: UserStatus;
  skills?: string;
}

export const users: MesUser[] = [
  { id: "U-001", name: "Faisal Al-Mutairi",  mobile: "+966 50 112 3344", email: "faisal.m@cortanex.io",  role: "supervisor", shift: "A", status: "active",    skills: "OEE coach, line balancing" },
  { id: "U-002", name: "Mariam Khalid",      mobile: "+966 55 220 9981", email: "mariam.k@cortanex.io",  role: "operator",   shift: "A", status: "active",    skills: "Oven, proofer" },
  { id: "U-003", name: "Omar Al-Saleh",      mobile: "+966 53 401 7710", email: "omar.s@cortanex.io",    role: "operator",   shift: "A", status: "active",    skills: "Filler, capper" },
  { id: "U-004", name: "Layla Al-Maliki",    mobile: "+966 56 778 0142", email: "layla.m@cortanex.io",   role: "team_lead",  shift: "A", status: "active",    skills: "Dairy CCP" },
  { id: "U-005", name: "Hassan Rashed",      mobile: "+966 50 998 2204", email: "hassan.r@cortanex.io",  role: "operator",   shift: "C", status: "off-shift", skills: "Mixer, extruder" },
  { id: "U-006", name: "Noura Al-Harbi",     mobile: "+966 54 663 0098", email: "noura.h@cortanex.io",   role: "operator",   shift: "B", status: "off-shift", skills: "Bagger, palletizer" },
  { id: "U-007", name: "Khalid Al-Otaibi",   mobile: "+966 53 220 5511", email: "khalid.o@cortanex.io",  role: "team_lead",  shift: "B", status: "off-shift", skills: "Packaging" },
  { id: "U-008", name: "Sara Bin-Zayed",     mobile: "+966 55 119 7702", email: "sara.b@cortanex.io",    role: "operator",   shift: "A", status: "on-break",  skills: "QA, brix, CCP" },
];

// ============ Teams ============
export interface Team {
  id: string;
  name: string;
  shift: "A" | "B" | "C";
  leadId: string;
  memberIds: string[];
  area: string;
}

export const teams: Team[] = [
  { id: "T-01", name: "Mixer Crew Alpha",    shift: "A", leadId: "U-001", memberIds: ["U-002", "U-008"], area: "L-01 · Mixer Line A" },
  { id: "T-02", name: "Dairy Crew",          shift: "A", leadId: "U-004", memberIds: ["U-003"],          area: "L-05 · Cheese Vat E" },
  { id: "T-03", name: "Night Packaging",     shift: "C", leadId: "U-007", memberIds: ["U-005", "U-006"], area: "L-04 · Packaging D" },
];

// ============ Assignments ============
export type AssignmentTarget = "station" | "team";
export interface Assignment {
  id: string;
  userId: string;
  targetType: AssignmentTarget;
  targetId: string;           // stationId or teamId
  shift: "A" | "B" | "C";
  startedAt: string;
  endsAt?: string;
  active: boolean;
}

export const assignments: Assignment[] = [
  { id: "AS-001", userId: "U-002", targetType: "station", targetId: "ST-102", shift: "A", startedAt: "06:00", endsAt: "14:00", active: true },
  { id: "AS-002", userId: "U-008", targetType: "station", targetId: "ST-104", shift: "A", startedAt: "06:00", endsAt: "14:00", active: true },
  { id: "AS-003", userId: "U-001", targetType: "team",    targetId: "T-01",   shift: "A", startedAt: "06:00", endsAt: "14:00", active: true },
  { id: "AS-004", userId: "U-003", targetType: "station", targetId: "ST-302", shift: "A", startedAt: "07:10", endsAt: "15:10", active: true },
  { id: "AS-005", userId: "U-004", targetType: "team",    targetId: "T-02",   shift: "A", startedAt: "05:50", endsAt: "13:50", active: true },
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
  /** Station where the stoppage originated (optional for line-wide events) */
  stationId?: string;
  /** Active assignment that was on station when the event was raised */
  assignmentId?: string;
  /** Operator on station at the time, captured for traceability */
  operatorId?: string;
  operatorName?: string;
  reasonCode: string;
  category: "equipment_failure" | "changeover" | "material_shortage" | "quality_hold" | "operator_break";
  startedAt: string;
  durationMin: number;
  workOrderId?: string;
  status: "open" | "resolved";
  notes?: string;
}

export const downtime: DowntimeEvent[] = [
  { id: "DT-401", lineId: "L-03", lineName: "Bottling Line C", stationId: "ST-303", operatorId: "U-003", operatorName: "Omar Al-Saleh", reasonCode: "Capper jam", category: "equipment_failure", startedAt: "08:42", durationMin: 28, workOrderId: "WO-2401-120", status: "open", notes: "Maintenance dispatched — auto WO created in CMMS" },
  { id: "DT-400", lineId: "L-04", lineName: "Packaging D", reasonCode: "SKU changeover", category: "changeover", startedAt: "08:10", durationMin: 45, status: "open" },
  { id: "DT-399", lineId: "L-02", lineName: "Oven Line B", stationId: "ST-203", reasonCode: "Awaiting raw lot", category: "material_shortage", startedAt: "07:30", durationMin: 12, workOrderId: "WO-2401-119", status: "resolved" },
  { id: "DT-398", lineId: "L-01", lineName: "Mixer Line A", stationId: "ST-102", operatorId: "U-002", operatorName: "Mariam Khalid", reasonCode: "Operator handover", category: "operator_break", startedAt: "06:45", durationMin: 8, status: "resolved" },
  { id: "DT-397", lineId: "L-05", lineName: "Cheese Vat E", stationId: "ST-501", reasonCode: "CCP retest", category: "quality_hold", startedAt: "06:12", durationMin: 6, workOrderId: "WO-2401-121", status: "resolved" },
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
