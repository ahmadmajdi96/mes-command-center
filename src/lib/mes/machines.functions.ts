import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { DRIVERS, checkAddress, checkEndpoint } from "./machine-drivers";

async function loadMachine(supabase: any, id: string) {
  const { data, error } = await supabase.from("machines").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Machine not found");
  return data as { id: string; organization_id: string; name: string; protocol: string; endpoint: string | null; connection_mode: string; tags: any[]; commands: any[] };
}

/** Checks the machine address and every tag/command address against the protocol driver. */
export const testMachineConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ machineId: z.string().min(1).max(100) }).parse(d))
  .handler(async ({ data, context }) => {
    const m = await loadMachine(context.supabase, data.machineId);
    const checks = [
      { item: "Machine address", ...checkEndpoint(m.protocol, m.endpoint) },
      ...(m.tags ?? []).filter((t) => t.name).map((t) => ({ item: `Tag ${t.name}`, ...checkAddress(m.protocol, t.address) })),
      ...(m.commands ?? []).filter((c) => c.name).map((c) => ({ item: `Command ${c.name}`, ...checkAddress(m.protocol, c.address) })),
    ];
    const ok = checks.every((c) => c.ok);
    const d = DRIVERS[m.protocol];
    return { ok, driver: d ? `${m.protocol} (${d.family})` : m.protocol, transport: m.connection_mode === "edge" ? "edge box" : m.connection_mode === "manual" ? "manual entry" : "mock device", checks,
      handshake: ok && m.connection_mode === "simulated" ? `Mock ${m.protocol} session opened to ${m.endpoint}` : null };
  });

/** Reads every tag once through the protocol driver (mock device when the machine is in simulated mode). */
export const pollMachine = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ machineId: z.string().min(1).max(100), forceOutOfLimits: z.boolean().optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const m = await loadMachine(context.supabase, data.machineId);
    if (m.connection_mode !== "simulated") throw new Error("Only machines in simulated mode are read by the mock driver; edge machines are read by the edge box");
    const ep = checkEndpoint(m.protocol, m.endpoint);
    if (!ep.ok) throw new Error(ep.error);
    const d = DRIVERS[m.protocol]!;
    const frames: { tag: string; raw: string; value: number; quality: string }[] = [];
    const rows: any[] = [];
    for (const t of (m.tags ?? []).filter((x) => x.name)) {
      const a = checkAddress(m.protocol, t.address);
      if (!a.ok) { frames.push({ tag: t.name, raw: a.error!, value: NaN, quality: "Bad address" }); continue; }
      const lo = t.min ?? 0, hi = t.max ?? 100, span = hi - lo || 1;
      const v = Math.round((data.forceOutOfLimits ? hi + span * 0.1 : lo + span * (0.15 + Math.random() * 0.7)) * 100) / 100;
      const w = d.read(t.address, v);
      frames.push({ tag: t.name, ...w });
      rows.push({ machine_id: m.id, organization_id: m.organization_id, tag: t.name, value: w.value, source: "simulated", actor_user_id: context.userId, actor_name: `Mock ${m.protocol} driver` });
    }
    if (rows.length) {
      const { error } = await context.supabase.from("machine_readings").insert(rows);
      if (error) throw new Error(error.message);
    }
    return { recorded: rows.length, frames };
  });

/** Sends a command through the protocol driver; the mock device acknowledges it, edge machines queue it. */
export const sendMachineCommand = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ machineId: z.string().min(1).max(100), command: z.string().min(1).max(80), value: z.string().max(100).optional(), reason: z.string().max(500).optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const m = await loadMachine(context.supabase, data.machineId);
    const def = (m.commands ?? []).find((c) => c.name === data.command);
    if (!def) throw new Error(`"${data.command}" is not a configured command for ${m.name}`);
    if (def.safety && !data.reason?.trim()) throw new Error("This command is safety-relevant: give a reason");
    if (m.connection_mode !== "manual") {
      const a = checkAddress(m.protocol, def.address);
      if (!a.ok) throw new Error(`Cannot send: ${a.error}`);
    }
    const { data: row, error } = await context.supabase.from("machine_commands").insert({
      machine_id: m.id, organization_id: m.organization_id, command: data.command, params: data.value ? { value: data.value } : {}, reason: data.reason || null,
      actor_user_id: context.userId,
    }).select("id").single();
    if (error) throw new Error(error.message);
    if (m.connection_mode !== "simulated") return { id: row.id, status: "queued", raw: null, ack: null };
    const w = DRIVERS[m.protocol]!.write(def.address, data.command, data.value);
    const { error: e2 } = await context.supabase.from("machine_commands").update({ status: "acknowledged", result: `${w.ack} · ${w.raw}`, completed_at: new Date().toISOString() }).eq("id", row.id);
    if (e2) throw new Error(e2.message);
    return { id: row.id, status: "acknowledged", ...w };
  });
