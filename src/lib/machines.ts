export const PROTOCOLS = [
  { key: "opcua", name: "OPC UA", hint: "opc.tcp://10.0.0.10:4840", addr: "ns=2;s=Line1.Filler.Temp" },
  { key: "modbus_tcp", name: "Modbus TCP", hint: "10.0.0.20:502 unit 1", addr: "HR40001" },
  { key: "modbus_rtu", name: "Modbus RTU", hint: "/dev/ttyUSB0 9600 8N1 unit 1", addr: "HR40001" },
  { key: "mqtt", name: "MQTT / Sparkplug B", hint: "mqtt://broker:1883", addr: "plant/line1/filler/temp" },
  { key: "profinet", name: "PROFINET", hint: "device name filler-01", addr: "slot 1 / subslot 1 / byte 0" },
  { key: "ethernet_ip", name: "EtherNet/IP (CIP)", hint: "10.0.0.30 slot 0", addr: "Program:Main.Temp" },
  { key: "ethercat", name: "EtherCAT", hint: "master eth1, slave 3", addr: "0x6000:01" },
  { key: "s7", name: "Siemens S7", hint: "10.0.0.40 rack 0 slot 1", addr: "DB10.DBD4" },
  { key: "bacnet", name: "BACnet/IP", hint: "10.0.0.50 device 1001", addr: "analog-input:1" },
  { key: "dnp3", name: "DNP3", hint: "10.0.0.60:20000 outstation 10", addr: "AI 0" },
  { key: "cclink", name: "CC-Link IE", hint: "network 1 station 2", addr: "RWr0" },
] as const;

export const protocolName = (k: string) => PROTOCOLS.find((p) => p.key === k)?.name ?? k;

export type MachineTag = { name: string; address?: string; unit?: string; min?: number | null; max?: number | null; hold_on_breach?: boolean };
export type MachineCommand = { name: string; address?: string; params?: string; safety?: boolean };
export type Machine = {
  id: string; organization_id: string; station_id: string | null; name: string; vendor: string | null; model: string | null;
  protocol: string; endpoint: string | null; connection_mode: "simulated" | "manual" | "edge"; tags: MachineTag[]; commands: MachineCommand[];
  status: string; last_seen_at: string | null; notes: string | null; created_at: string;
};
