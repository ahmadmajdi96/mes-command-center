/**
 * Protocol drivers for machine connections. Each driver knows how its protocol addresses an endpoint
 * and a data point, and how a read/write looks on the wire. The mock transport answers like a real
 * device would (status codes, register frames, topics), so the whole read/command path can be used
 * before real machines are connected. A real edge box implements the same contract with real I/O.
 */
export type DriverCheck = { ok: boolean; error?: string };
export type WireRead = { raw: string; value: number; quality: string };
export type WireWrite = { raw: string; ack: string };

export type Driver = {
  key: string;
  family: "client-server" | "register" | "pub-sub" | "fieldbus" | "building" | "telecontrol";
  endpoint: RegExp; endpointHelp: string;
  address: RegExp; addressHelp: string;
  read: (address: string, value: number) => WireRead;
  write: (address: string, command: string, value: string | undefined) => WireWrite;
};

const hex = (n: number, w = 4) => (Math.max(0, Math.round(n)) & (16 ** w - 1)).toString(16).toUpperCase().padStart(w, "0");
const f32 = (v: number) => { const b = new DataView(new ArrayBuffer(4)); b.setFloat32(0, v); return Array.from(new Uint8Array(b.buffer), (x) => x.toString(16).padStart(2, "0")).join("").toUpperCase(); };
const crc16 = (s: string) => { let c = 0xffff; for (const ch of s) { c ^= ch.charCodeAt(0); for (let i = 0; i < 8; i++) c = c & 1 ? (c >> 1) ^ 0xa001 : c >> 1; } return hex(c); };
const regOf = (a: string) => Number(a.replace(/\D/g, "")) || 0;
const IP = String.raw`\d{1,3}(\.\d{1,3}){3}`;

export const DRIVERS: Record<string, Driver> = {
  opcua: {
    key: "opcua", family: "client-server",
    endpoint: /^opc\.tcp:\/\/[\w.-]+:\d{2,5}(\/.*)?$/i, endpointHelp: "opc.tcp://host:4840",
    address: /^ns=\d+;[sig]=.+$/i, addressHelp: "ns=2;s=Line1.Filler.Temp",
    read: (a, v) => ({ raw: `ReadResponse{NodeId:${a}, Value:Double(${v}), StatusCode:Good(0x00000000), SourceTimestamp:${new Date().toISOString()}}`, value: v, quality: "Good" }),
    write: (a, c, v) => ({ raw: `CallRequest{ObjectId:${a}, Method:${c}, Args:[${v ?? ""}]}`, ack: "StatusCode Good (0x00000000)" }),
  },
  modbus_tcp: {
    key: "modbus_tcp", family: "register",
    endpoint: new RegExp(`^${IP}:\\d{1,5}( unit \\d+)?$`), endpointHelp: "10.0.0.20:502 unit 1",
    address: /^(HR|IR|CO|DI)?4?\d{1,5}$/i, addressHelp: "HR40001",
    read: (a, v) => { const r = regOf(a) % 10000; return { raw: `MBAP 0001 0000 0007 01 | FC03 addr=${hex(r)} → 03 04 ${f32(v)}`, value: v, quality: "OK" }; },
    write: (a, _c, v) => ({ raw: `MBAP 0002 0000 0006 01 | FC06 addr=${hex(regOf(a) % 10000)} val=${hex(Number(v ?? 1))}`, ack: "FC06 echo OK" }),
  },
  modbus_rtu: {
    key: "modbus_rtu", family: "register",
    endpoint: /^(\/dev\/\S+|COM\d+) \d{3,6} [78][NEO][12]( unit \d+)?$/i, endpointHelp: "/dev/ttyUSB0 9600 8N1 unit 1",
    address: /^(HR|IR|CO|DI)?4?\d{1,5}$/i, addressHelp: "HR40001",
    read: (a, v) => { const f = `01 03 04 ${f32(v)}`; return { raw: `${f} CRC=${crc16(f + a)}`, value: v, quality: "CRC OK" }; },
    write: (a, _c, v) => { const f = `01 06 ${hex(regOf(a) % 10000)} ${hex(Number(v ?? 1))}`; return { raw: `${f} CRC=${crc16(f)}`, ack: "echo OK" }; },
  },
  mqtt: {
    key: "mqtt", family: "pub-sub",
    endpoint: /^mqtts?:\/\/[\w.-]+(:\d{2,5})?$/i, endpointHelp: "mqtt://broker:1883",
    address: /^[\w\-/+#]+$/, addressHelp: "plant/line1/filler/temp",
    read: (a, v) => ({ raw: `PUBLISH topic=spBv1.0/${a} qos=1 payload={"metrics":[{"name":"value","value":${v},"timestamp":${Date.now()}}]}`, value: v, quality: "QoS1 delivered" }),
    write: (a, c, v) => ({ raw: `PUBLISH topic=spBv1.0/${a}/DCMD qos=1 payload={"metrics":[{"name":"${c}","value":${JSON.stringify(v ?? true)}}]}`, ack: "PUBACK" }),
  },
  profinet: {
    key: "profinet", family: "fieldbus",
    endpoint: /^device name [\w.-]+$/i, endpointHelp: "device name filler-01",
    address: /^slot \d+ \/ subslot \d+ \/ byte \d+$/i, addressHelp: "slot 1 / subslot 1 / byte 0",
    read: (a, v) => ({ raw: `RT cyclic IOCR frame, ${a}, data=${f32(v)} IOPS=GOOD`, value: v, quality: "IOPS GOOD" }),
    write: (a, c, v) => ({ raw: `Acyclic Write Record ${a} idx=0x${hex(c.length)} data=${hex(Number(v ?? 1))}`, ack: "Write.res OK" }),
  },
  ethernet_ip: {
    key: "ethernet_ip", family: "client-server",
    endpoint: new RegExp(`^${IP}( slot \\d+)?$`), endpointHelp: "10.0.0.30 slot 0",
    address: /^[\w:.[\]]+$/, addressHelp: "Program:Main.Temp",
    read: (a, v) => ({ raw: `CIP Read Tag Service 0x4C '${a}' → 0xCC REAL ${f32(v)}`, value: v, quality: "General Status 0x00" }),
    write: (a, _c, v) => ({ raw: `CIP Write Tag Service 0x4D '${a}' = ${v ?? 1}`, ack: "General Status 0x00" }),
  },
  ethercat: {
    key: "ethercat", family: "fieldbus",
    endpoint: /^master \w+, slave \d+$/i, endpointHelp: "master eth1, slave 3",
    address: /^0x[0-9a-f]{4}:[0-9a-f]{2}$/i, addressHelp: "0x6000:01",
    read: (a, v) => ({ raw: `CoE SDO Upload ${a} → ${f32(v)} WKC=1`, value: v, quality: "WKC 1" }),
    write: (a, _c, v) => ({ raw: `CoE SDO Download ${a} ← ${hex(Number(v ?? 1), 8)}`, ack: "WKC 1" }),
  },
  s7: {
    key: "s7", family: "client-server",
    endpoint: new RegExp(`^${IP} rack \\d+ slot \\d+$`), endpointHelp: "10.0.0.40 rack 0 slot 1",
    address: /^(DB\d+\.DB[XBWD]\d+(\.\d)?|[MIQ][BWD]?\d+(\.\d)?)$/i, addressHelp: "DB10.DBD4",
    read: (a, v) => ({ raw: `S7comm ReadVar ${a} → ReturnCode 0xFF (Success) data=${f32(v)}`, value: v, quality: "0xFF Success" }),
    write: (a, _c, v) => ({ raw: `S7comm WriteVar ${a} ← ${v ?? 1}`, ack: "ReturnCode 0xFF" }),
  },
  bacnet: {
    key: "bacnet", family: "building",
    endpoint: new RegExp(`^${IP}( device \\d+)?$`), endpointHelp: "10.0.0.50 device 1001",
    address: /^(analog|binary|multi-state)-(input|output|value):\d+$/i, addressHelp: "analog-input:1",
    read: (a, v) => ({ raw: `ReadProperty ${a} presentValue → ${v} statusFlags={0,0,0,0}`, value: v, quality: "normal" }),
    write: (a, _c, v) => ({ raw: `WriteProperty ${a} presentValue=${v ?? 1} priority=8`, ack: "SimpleACK" }),
  },
  dnp3: {
    key: "dnp3", family: "telecontrol",
    endpoint: new RegExp(`^${IP}:\\d{1,5}( outstation \\d+)?$`), endpointHelp: "10.0.0.60:20000 outstation 10",
    address: /^(AI|AO|BI|BO|CI) \d+$/i, addressHelp: "AI 0",
    read: (a, v) => ({ raw: `Class 0 poll → Group30Var5 ${a} = ${v} flags=ONLINE`, value: v, quality: "ONLINE" }),
    write: (a, _c, v) => ({ raw: `SELECT/OPERATE Group41Var1 ${a} = ${v ?? 1}`, ack: "Status SUCCESS" }),
  },
  cclink: {
    key: "cclink", family: "fieldbus",
    endpoint: /^network \d+ station \d+$/i, endpointHelp: "network 1 station 2",
    address: /^(RWr|RWw|RX|RY)[0-9a-f]+$/i, addressHelp: "RWr0",
    read: (a, v) => ({ raw: `Cyclic ${a} = ${hex(v * 10)} (x0.1)`, value: v, quality: "Link OK" }),
    write: (a, _c, v) => ({ raw: `Cyclic RWw${a.replace(/\D/g, "")} = ${hex(Number(v ?? 1))}`, ack: "Link OK" }),
  },
};

export function checkEndpoint(protocol: string, endpoint: string | null): DriverCheck {
  const d = DRIVERS[protocol];
  if (!d) return { ok: false, error: `No driver for protocol "${protocol}"` };
  if (!endpoint?.trim()) return { ok: false, error: `Machine address missing (e.g. ${d.endpointHelp})` };
  return d.endpoint.test(endpoint.trim()) ? { ok: true } : { ok: false, error: `Address "${endpoint}" is not valid for this protocol (e.g. ${d.endpointHelp})` };
}

export function checkAddress(protocol: string, address: string | undefined): DriverCheck {
  const d = DRIVERS[protocol];
  if (!d) return { ok: false, error: `No driver for protocol "${protocol}"` };
  if (!address?.trim()) return { ok: false, error: `Data point address missing (e.g. ${d.addressHelp})` };
  return d.address.test(address.trim()) ? { ok: true } : { ok: false, error: `"${address}" is not a valid data point (e.g. ${d.addressHelp})` };
}
