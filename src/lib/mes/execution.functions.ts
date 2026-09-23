import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";


/**
 * Single server entry point for everything that writes production history.
 * The acting person is always derived from the validated session — never from
 * the client payload — and every call is permission-checked before it writes.
 */

async function actor(context: { supabase: any; userId: string; claims: unknown }) {
  const { data: profile } = await context.supabase
    .from("profiles")
    .select("full_name, email")
    .eq("id", context.userId)
    .maybeSingle();
  const email = (context.claims as { email?: string } | null)?.email ?? null;
  return {
    id: context.userId,
    name: profile?.full_name || profile?.email || email || "Unknown user",
  };
}

async function requireAction(context: { supabase: any; userId: string }, action: string) {
  const { data, error } = await context.supabase.rpc("has_action", {
    _user_id: context.userId,
    _action: action,
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error(`You do not have permission to ${action.replace(".", " ")}`);
}

function newId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

type UnitEventRow = Database["public"]["Tables"]["unit_events"]["Row"];


export type RecordEventInput = {
  unit_uid: string;
  station_id: string;
  station_name?: string;
  line_id?: string | null;
  /** enter/started opens a visit; exit_pass/exit_reject/exit_complete closes it. */
  event: string;
  notes?: string;
  batch_id?: string | null;
  device_id?: string | null;
  correlation_id?: string | null;
};

/** Record a station entry or exit for one unit. */
export const recordUnitEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: RecordEventInput) => {
    if (!d.unit_uid) throw new Error("A unit identifier is required");
    if (!d.station_id) throw new Error("A station is required");
    if (!d.event) throw new Error("An event type is required");
    return d;
  })
  .handler(async ({ data: v, context }) => {
    await requireAction(context, "execution.record");
    const who = await actor(context);
    const supabase = context.supabase;
    const nowIso = new Date().toISOString();
    const isEnter = v.event === "enter" || v.event === "started";
    const isReject = v.event === "exit_reject" || v.event === "rejected";
    const isComplete = v.event === "exit_complete" || v.event === "completed";

    // An open hold on the station blocks all execution.
    const { data: holds } = await supabase
      .from("station_holds")
      .select("id, hold_type, reason")
      .eq("station_id", v.station_id)
      .eq("status", "open")
      .limit(1);
    if (holds && holds.length > 0) {
      throw new Error(
        `Station is on ${holds[0].hold_type} hold (${holds[0].reason}) — execution is blocked until it is cleared`,
      );
    }

    const { data: unit, error: unitErr } = await supabase
      .from("product_units")
      .select("uid, status, current_station_id")
      .eq("uid", v.unit_uid)
      .maybeSingle();
    if (unitErr) throw new Error(unitErr.message);
    if (!unit) throw new Error(`Unit ${v.unit_uid} does not exist`);
    if (unit.status === "scrapped" || unit.status === "rejected") {
      throw new Error(`Unit ${v.unit_uid} is ${unit.status} and cannot be processed`);
    }

    let event: UnitEventRow | null = null;

    if (!isEnter) {
      const { data: open } = await supabase
        .from("unit_events")
        .select("*")
        .eq("unit_uid", v.unit_uid)
        .eq("station_id", v.station_id)
        .is("exited_at", null)
        .not("entered_at", "is", null)
        .order("entered_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (open?.id) {
        const enteredAt = open.entered_at ?? open.at ?? nowIso;
        const dwell = Math.max(
          0,
          Math.round((new Date(nowIso).getTime() - new Date(enteredAt).getTime()) / 1000),
        );
        const { data, error } = await supabase
          .from("unit_events")
          .update({
            exited_at: nowIso,
            dwell_seconds: dwell,
            event: isReject ? "rejected" : isComplete ? "completed" : "processed",
            result: isReject ? "fail" : "pass",
            notes: v.notes ?? open.notes,
          })
          .eq("id", open.id)
          .select()
          .single();
        if (error) throw new Error(error.message);
        event = data;
      }
    }

    if (!event) {
      const { data, error } = await supabase
        .from("unit_events")
        .insert({
          id: newId("UE"),
          unit_uid: v.unit_uid,
          station_id: v.station_id,
          station_name: v.station_name,
          line_id: v.line_id ?? null,
          batch_id: v.batch_id ?? null,
          event: isEnter ? "started" : isReject ? "rejected" : isComplete ? "completed" : "processed",
          result: isReject ? "fail" : isEnter ? null : "pass",
          operator_id: who.id,
          operator_name: who.name,
          actor_user_id: who.id,
          device_id: v.device_id ?? null,
          correlation_id: v.correlation_id ?? null,
          notes: v.notes,
          entered_at: nowIso,
          exited_at: isEnter ? null : nowIso,
          dwell_seconds: isEnter ? null : 0,
        })
        .select()
        .single();
      if (error) throw new Error(error.message);
      event = data;
    }

    const status = isReject ? "rejected" : isComplete ? "completed" : "in_process";
    const { error: e2 } = await supabase
      .from("product_units")
      .update({
        current_station_id: v.station_id,
        current_line_id: v.line_id ?? null,
        status,
        ...(isComplete ? { completed_at: nowIso } : {}),
        ...(isEnter ? { produced_at: nowIso } : {}),
      })
      .eq("uid", v.unit_uid);
    if (e2) throw new Error(e2.message);

    return event;
  });

/** Record captured recipe values for a unit at a station. */
export const recordReading = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      unit_uid: string;
      station_id?: string;
      unit_event_id?: string;
      mode?: string;
      variables: Record<string, unknown>;
      device_id?: string | null;
      correlation_id?: string | null;
    }) => {
      if (!d.unit_uid) throw new Error("A unit identifier is required");
      if (!d.variables || typeof d.variables !== "object") throw new Error("No values to record");
      for (const [k, val] of Object.entries(d.variables)) {
        if (typeof val === "number" && !Number.isFinite(val)) {
          throw new Error(`Value for ${k} is not a valid number`);
        }
      }
      return d;
    },
  )
  .handler(async ({ data: v, context }) => {
    await requireAction(context, "execution.record");
    const who = await actor(context);
    const { data, error } = await context.supabase
      .from("unit_readings")
      .insert({
        unit_uid: v.unit_uid,
        station_id: v.station_id,
        unit_event_id: v.unit_event_id,
        mode: v.mode,
        variables: v.variables as never,
        operator_id: who.id,
        operator_name: who.name,
        actor_user_id: who.id,
        device_id: v.device_id ?? null,
        correlation_id: v.correlation_id ?? null,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  });

/** Scrap a unit with a reason and evidence. */
export const recordWaste = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      unit_uid?: string | null;
      station_id?: string | null;
      station_name?: string;
      line_id?: string | null;
      production_order_id?: string | null;
      lot_number?: string | null;
      reason_code: string;
      reason_label: string;
      reason_category?: string;
      notes?: string;
      evidence_urls?: string[];
      device_id?: string | null;
    }) => {
      if (!d.reason_code) throw new Error("A waste reason is required");
      return d;
    },
  )
  .handler(async ({ data: v, context }) => {
    await requireAction(context, "execution.record");
    const who = await actor(context);
    const supabase = context.supabase;
    const correlationId = newId("WC");

    const { data, error } = await supabase
      .from("waste_events")
      .insert({
        unit_uid: v.unit_uid ?? null,
        station_id: v.station_id ?? null,
        station_name: v.station_name,
        line_id: v.line_id ?? null,
        production_order_id: v.production_order_id ?? null,
        lot_number: v.lot_number ?? null,
        reason_code: v.reason_code,
        reason_label: v.reason_label,
        reason_category: v.reason_category,
        notes: v.notes,
        operator_id: who.id,
        operator_name: who.name,
        actor_user_id: who.id,
        device_id: v.device_id ?? null,
        correlation_id: correlationId,
        evidence_urls: (v.evidence_urls ?? []) as never,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);

    if (v.unit_uid) {
      const { error: e1 } = await supabase
        .from("product_units")
        .update({ status: "scrapped" })
        .eq("uid", v.unit_uid);
      if (e1) throw new Error(`Waste recorded but the unit status failed to update: ${e1.message}`);

      const { error: e2 } = await supabase.from("unit_events").insert({
        id: newId("UE"),
        unit_uid: v.unit_uid,
        station_id: v.station_id,
        station_name: v.station_name,
        line_id: v.line_id ?? null,
        event: "waste",
        result: v.reason_code,
        operator_id: who.id,
        operator_name: who.name,
        actor_user_id: who.id,
        correlation_id: correlationId,
        notes: v.notes,
        entered_at: new Date().toISOString(),
        exited_at: new Date().toISOString(),
        dwell_seconds: 0,
      });
      if (e2) throw new Error(`Waste recorded but its history entry failed: ${e2.message}`);
    }

    return data;
  });

/** Put a station on quality or maintenance hold. */
export const openStationHold = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: { station_id: string; hold_type: string; reason: string; evidence_urls?: string[] }) => {
      if (!d.station_id) throw new Error("A station is required");
      if (!d.reason?.trim()) throw new Error("A reason is required");
      return d;
    },
  )
  .handler(async ({ data: v, context }) => {
    await requireAction(context, "holds.raise");
    const who = await actor(context);
    const { data, error } = await context.supabase
      .from("station_holds")
      .insert({
        station_id: v.station_id,
        hold_type: v.hold_type,
        reason: v.reason,
        opened_by: who.id,
        opened_by_name: who.name,
        opened_by_user_id: who.id,
        evidence_urls: (v.evidence_urls ?? []) as never,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  });

/** Clear a hold. Quality holds require quality-release permission. */
export const closeStationHold = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; resolution_notes?: string; evidence_urls?: string[] }) => {
    if (!d.id) throw new Error("A hold is required");
    return d;
  })
  .handler(async ({ data: v, context }) => {
    const supabase = context.supabase;
    const { data: hold, error: hErr } = await supabase
      .from("station_holds")
      .select("id, hold_type, status, evidence_urls")
      .eq("id", v.id)
      .maybeSingle();
    if (hErr) throw new Error(hErr.message);
    if (!hold) throw new Error("That hold no longer exists");
    if (hold.status !== "open") throw new Error("That hold is already closed");

    if (hold.hold_type === "quality" || hold.hold_type === "qc") {
      await requireAction(context, "holds.release");
    } else {
      const { data: canMaint } = await supabase.rpc("has_action", {
        _user_id: context.userId,
        _action: "maintenance.clear",
      });
      if (!canMaint) await requireAction(context, "holds.release");
    }

    const who = await actor(context);
    const existingEvidence = Array.isArray(hold.evidence_urls) ? (hold.evidence_urls as string[]) : [];
    const patch = {
      status: "closed",
      closed_at: new Date().toISOString(),
      closed_by: who.id,
      closed_by_name: who.name,
      closed_by_user_id: who.id,
      resolution_notes: v.resolution_notes,
      // Original evidence is preserved; resolution evidence is appended.
      ...(v.evidence_urls?.length
        ? { evidence_urls: [...existingEvidence, ...v.evidence_urls] }
        : {}),
    };

    const { data, error } = await supabase
      .from("station_holds")
      .update(patch)
      .eq("id", v.id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  });
