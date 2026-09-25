import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

/**
 * Single server entry point for everything that writes production history.
 * The acting person is always derived from the validated session — never from
 * the client payload — and every call is permission-checked and rule-checked
 * before it writes.
 */

type Ctx = { supabase: any; userId: string; claims: unknown };

async function actor(context: Ctx) {
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

/** Offline replays resend the same correlation id; skip writes already stored. */
async function alreadyRecorded(context: Ctx, table: string, correlationId?: string | null) {
  if (!correlationId) return false;
  const { data } = await context.supabase
    .from(table)
    .select("id")
    .eq("correlation_id", correlationId)
    .limit(1);
  return !!data?.length;
}


async function requireAction(context: Ctx, action: string) {
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

const BLOCKING_STATUSES = ["hold", "cancelled", "completed", "finished", "closed"];
const RECORDABLE_STATUSES = ["released", "running", "scheduled", "planned"];

/** An open hold on the station blocks all execution there. */
async function assertStationNotHeld(supabase: any, stationId: string) {
  const { data: holds } = await supabase
    .from("station_holds")
    .select("id, hold_type, reason")
    .eq("station_id", stationId)
    .eq("status", "open")
    .limit(1);
  if (holds && holds.length > 0) {
    throw new Error(
      `Station is on ${holds[0].hold_type} hold (${holds[0].reason}) — execution is blocked until it is cleared`,
    );
  }
}

/** Batch and order must be in a state where recording is meaningful. */
async function assertParentsRecordable(
  supabase: any,
  batchId?: string | null,
  orderId?: string | null,
) {
  if (batchId) {
    const { data: batch } = await supabase
      .from("production_batches")
      .select("id, number, status")
      .eq("id", batchId)
      .maybeSingle();
    if (batch) {
      if (BLOCKING_STATUSES.includes(batch.status)) {
        throw new Error(`Batch ${batch.number} is ${batch.status} — nothing can be recorded against it`);
      }
      if (!RECORDABLE_STATUSES.includes(batch.status) && batch.status !== "paused") {
        throw new Error(`Batch ${batch.number} is ${batch.status} and is not open for recording`);
      }
    }
  }
  if (orderId) {
    const { data: order } = await supabase
      .from("production_orders")
      .select("id, number, status")
      .eq("id", orderId)
      .maybeSingle();
    if (order && BLOCKING_STATUSES.includes(order.status)) {
      throw new Error(`Order ${order.number} is ${order.status} — nothing can be recorded against it`);
    }
  }
}

type StationContext = {
  station: { id: string; line_id: string | null; sequence: number | null; name?: string | null } | null;
  line: { id: string; tracking_mode: string; enforce_route: boolean } | null;
};

async function loadStationContext(supabase: any, stationId: string): Promise<StationContext> {
  const { data: station } = await supabase
    .from("stations")
    .select("id, name, line_id, sequence")
    .eq("id", stationId)
    .maybeSingle();
  let line = null;
  if (station?.line_id) {
    const { data } = await supabase
      .from("lines")
      .select("id, tracking_mode, enforce_route")
      .eq("id", station.line_id)
      .maybeSingle();
    line = data;
  }
  return { station, line };
}

/**
 * Enforces the route order and the recipe rules for one unit at one station.
 * Returns nothing; throws with the exact rule that blocked the move.
 */
async function validateStationMove(
  supabase: any,
  args: {
    unit: { uid: string; status: string; product_id: string | null; batch_id: string | null };
    stationId: string;
    ctx: StationContext;
    isEnter: boolean;
    isExit: boolean;
  },
) {
  const { unit, stationId, ctx, isEnter, isExit } = args;

  if (ctx.line?.tracking_mode === "lot") {
    throw new Error(
      "This line records quantities as lots, not individual items — use the lot quantity panel instead",
    );
  }

  // Route order: every earlier station on the line must already be completed.
  if (isEnter && ctx.line?.enforce_route && ctx.station?.line_id && ctx.station.sequence != null) {
    const { data: earlier } = await supabase
      .from("stations")
      .select("id, name, sequence")
      .eq("line_id", ctx.station.line_id)
      .lt("sequence", ctx.station.sequence)
      .order("sequence", { ascending: true });
    if (earlier && earlier.length) {
      const { data: done } = await supabase
        .from("unit_events")
        .select("station_id, exited_at")
        .eq("unit_uid", unit.uid)
        .not("exited_at", "is", null);
      const doneIds = new Set((done ?? []).map((e: { station_id: string | null }) => e.station_id));
      const missing = earlier.find((s: { id: string }) => !doneIds.has(s.id));
      if (missing) {
        throw new Error(
          `Out of route order: ${missing.name ?? missing.id} (step ${missing.sequence}) has not been completed for ${unit.uid}`,
        );
      }
    }
  }

  // Recipe rules on exit: critical steps and required readings.
  if (isExit && unit.product_id) {
    const { data: recipe } = await supabase
      .from("product_station_recipes")
      .select("variables, is_ccp, blocks_on_fail, requires_reading")
      .eq("product_id", unit.product_id)
      .eq("station_id", stationId)
      .maybeSingle();

    if (recipe && (recipe.requires_reading || recipe.is_ccp)) {
      const { data: readings } = await supabase
        .from("unit_readings")
        .select("variables, created_at")
        .eq("unit_uid", unit.uid)
        .eq("station_id", stationId)
        .order("created_at", { ascending: false })
        .limit(1);
      const latest = readings?.[0]?.variables as Record<string, unknown> | undefined;
      if (!latest || Object.keys(latest).length === 0) {
        throw new Error(
          recipe.is_ccp
            ? "This is a critical control point — the required values must be recorded before the item can leave the station"
            : "The required values must be recorded before the item can leave the station",
        );
      }
      const vars = Array.isArray(recipe.variables) ? (recipe.variables as any[]) : [];
      const problems: string[] = [];
      for (const v of vars) {
        if (!v?.key) continue;
        const value = latest[v.key];
        if (v.required && (value === undefined || value === null || value === "")) {
          problems.push(`${v.label ?? v.key} is missing`);
          continue;
        }
        if (typeof value === "number") {
          if (typeof v.min === "number" && value < v.min) {
            problems.push(`${v.label ?? v.key} ${value}${v.unit ?? ""} is below the minimum ${v.min}`);
          }
          if (typeof v.max === "number" && value > v.max) {
            problems.push(`${v.label ?? v.key} ${value}${v.unit ?? ""} is above the maximum ${v.max}`);
          }
        }
      }
      if (problems.length && (recipe.blocks_on_fail || recipe.is_ccp)) {
        throw new Error(`Cannot pass this step: ${problems.join("; ")}`);
      }
    }
  }
}

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
    const ctx = context as Ctx;
    await requireAction(ctx, "execution.record");
    if (await alreadyRecorded(ctx, "unit_events", v.correlation_id)) return { duplicate: true } as never;
    const who = await actor(ctx);
    const supabase = ctx.supabase;
    const nowIso = new Date().toISOString();
    const isEnter = v.event === "enter" || v.event === "started";
    const isReject = v.event === "exit_reject" || v.event === "rejected";
    const isComplete = v.event === "exit_complete" || v.event === "completed";

    await assertStationNotHeld(supabase, v.station_id);

    const { data: unit, error: unitErr } = await supabase
      .from("product_units")
      .select("uid, status, current_station_id, product_id, batch_id, production_order_id, organization_id")
      .eq("uid", v.unit_uid)
      .maybeSingle();
    if (unitErr) throw new Error(unitErr.message);
    if (!unit) throw new Error(`Unit ${v.unit_uid} does not exist`);
    if (unit.status === "scrapped" || unit.status === "rejected") {
      throw new Error(
        `Unit ${v.unit_uid} is ${unit.status} and cannot be processed — send it to rework first if it can be recovered`,
      );
    }

    await assertParentsRecordable(supabase, unit.batch_id, unit.production_order_id);

    const stationCtx = await loadStationContext(supabase, v.station_id);
    await validateStationMove(supabase, {
      unit,
      stationId: v.station_id,
      ctx: stationCtx,
      isEnter,
      isExit: !isEnter,
    });

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
          station_name: v.station_name ?? stationCtx.station?.name ?? null,
          line_id: v.line_id ?? stationCtx.station?.line_id ?? null,
          batch_id: v.batch_id ?? unit.batch_id ?? null,
          organization_id: unit.organization_id,
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
        current_line_id: v.line_id ?? stationCtx.station?.line_id ?? null,
        status,
        ...(isComplete ? { completed_at: nowIso } : {}),
        ...(isEnter ? { produced_at: nowIso } : {}),
      })
      .eq("uid", v.unit_uid);
    if (e2) throw new Error(e2.message);

    return event;
  });

/** Record good / rework / scrap quantities for a lot-tracked line. */
export const recordLotProgress = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      batch_id: string;
      station_id: string;
      qty_in?: number;
      qty_good?: number;
      qty_rework?: number;
      qty_scrap?: number;
      scrap_reason_code?: string | null;
      notes?: string;
      device_id?: string | null;
      correlation_id?: string | null;
    }) => {
      if (!d.batch_id) throw new Error("A batch is required");
      if (!d.station_id) throw new Error("A station is required");
      const nums = [d.qty_in, d.qty_good, d.qty_rework, d.qty_scrap];
      for (const n of nums) {
        if (n !== undefined && (!Number.isFinite(n) || (n as number) < 0)) {
          throw new Error("Quantities must be zero or more");
        }
      }
      const total = (d.qty_good ?? 0) + (d.qty_rework ?? 0) + (d.qty_scrap ?? 0);
      if (total <= 0) throw new Error("Record at least one quantity");
      if ((d.qty_scrap ?? 0) > 0 && !d.scrap_reason_code) {
        throw new Error("Scrapped quantity needs a reason");
      }
      return d;
    },
  )
  .handler(async ({ data: v, context }) => {
    const ctx = context as Ctx;
    await requireAction(ctx, "execution.record");
    if (await alreadyRecorded(ctx, "batch_station_progress", v.correlation_id)) return { duplicate: true } as never;
    const who = await actor(ctx);
    const supabase = ctx.supabase;

    await assertStationNotHeld(supabase, v.station_id);

    const { data: batch, error: bErr } = await supabase
      .from("production_batches")
      .select("id, number, qty, status, production_order_id, line_id, organization_id")
      .eq("id", v.batch_id)
      .maybeSingle();
    if (bErr) throw new Error(bErr.message);
    if (!batch) throw new Error("That batch no longer exists");
    await assertParentsRecordable(supabase, batch.id, batch.production_order_id);

    const stationCtx = await loadStationContext(supabase, v.station_id);
    if (stationCtx.line && stationCtx.line.tracking_mode !== "lot") {
      throw new Error("This line tracks individual items — scan the item instead of entering quantities");
    }

    // Quantities recorded at this station must not exceed the batch quantity.
    const { data: prior } = await supabase
      .from("batch_station_progress")
      .select("qty_good, qty_rework, qty_scrap")
      .eq("batch_id", v.batch_id)
      .eq("station_id", v.station_id);
    const already = (prior ?? []).reduce(
      (sum: number, r: { qty_good: number; qty_rework: number; qty_scrap: number }) =>
        sum + Number(r.qty_good) + Number(r.qty_rework) + Number(r.qty_scrap),
      0,
    );
    const adding = (v.qty_good ?? 0) + (v.qty_rework ?? 0) + (v.qty_scrap ?? 0);
    if (already + adding > Number(batch.qty)) {
      throw new Error(
        `Batch ${batch.number} is ${batch.qty} units; ${already} are already recorded at this station, so ${adding} more does not fit`,
      );
    }

    const { data, error } = await supabase
      .from("batch_station_progress")
      .insert({
        batch_id: v.batch_id,
        production_order_id: batch.production_order_id,
        organization_id: batch.organization_id,
        station_id: v.station_id,
        station_name: stationCtx.station?.name ?? null,
        line_id: stationCtx.station?.line_id ?? batch.line_id ?? null,
        qty_in: v.qty_in ?? adding,
        qty_good: v.qty_good ?? 0,
        qty_rework: v.qty_rework ?? 0,
        qty_scrap: v.qty_scrap ?? 0,
        scrap_reason_code: v.scrap_reason_code ?? null,
        notes: v.notes ?? null,
        operator_id: who.id,
        operator_name: who.name,
        actor_user_id: who.id,
        device_id: v.device_id ?? null,
        correlation_id: v.correlation_id ?? newId("LP"),
        closed_at: new Date().toISOString(),
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  });

/** Send a rejected item back into the route for rework. */
export const sendToRework = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { unit_uid: string; reason: string; station_id?: string | null }) => {
    if (!d.unit_uid) throw new Error("A unit identifier is required");
    if (!d.reason?.trim()) throw new Error("A reason is required");
    return d;
  })
  .handler(async ({ data: v, context }) => {
    const ctx = context as Ctx;
    await requireAction(ctx, "execution.rework");
    const who = await actor(ctx);
    const supabase = ctx.supabase;

    const { data: unit, error } = await supabase
      .from("product_units")
      .select("uid, status, current_station_id, current_line_id, batch_id, organization_id")
      .eq("uid", v.unit_uid)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!unit) throw new Error(`Unit ${v.unit_uid} does not exist`);
    if (unit.status === "scrapped") throw new Error("A scrapped item cannot be reworked");
    if (unit.status !== "rejected") throw new Error("Only a rejected item can be sent to rework");

    const nowIso = new Date().toISOString();
    const { error: e1 } = await supabase.from("unit_events").insert({
      id: newId("UE"),
      unit_uid: v.unit_uid,
      station_id: v.station_id ?? unit.current_station_id,
      line_id: unit.current_line_id,
      batch_id: unit.batch_id,
      organization_id: unit.organization_id,
      event: "rework",
      result: "rework",
      operator_id: who.id,
      operator_name: who.name,
      actor_user_id: who.id,
      notes: v.reason,
      correction_reason: v.reason,
      entered_at: nowIso,
      exited_at: nowIso,
      dwell_seconds: 0,
    });
    if (e1) throw new Error(e1.message);

    const { data, error: e2 } = await supabase
      .from("product_units")
      .update({ status: "rework" })
      .eq("uid", v.unit_uid)
      .select()
      .single();
    if (e2) throw new Error(e2.message);
    return data;
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
    const ctx = context as Ctx;
    await requireAction(ctx, "execution.record");
    if (await alreadyRecorded(ctx, "unit_readings", v.correlation_id)) return { duplicate: true } as never;
    const who = await actor(ctx);
    const { data: unit } = await ctx.supabase
      .from("product_units")
      .select("organization_id")
      .eq("uid", v.unit_uid)
      .maybeSingle();
    const { data, error } = await ctx.supabase
      .from("unit_readings")
      .insert({
        unit_uid: v.unit_uid,
        station_id: v.station_id,
        unit_event_id: v.unit_event_id,
        mode: v.mode,
        organization_id: unit?.organization_id ?? undefined,
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
      correlation_id?: string | null;
    }) => {
      if (!d.reason_code) throw new Error("A waste reason is required");
      return d;
    },
  )
  .handler(async ({ data: v, context }) => {
    const ctx = context as Ctx;
    await requireAction(ctx, "execution.record");
    if (await alreadyRecorded(ctx, "waste_events", v.correlation_id)) return { duplicate: true } as never;
    const who = await actor(ctx);
    const supabase = ctx.supabase;
    const correlationId = v.correlation_id ?? newId("WC");

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
    const ctx = context as Ctx;
    await requireAction(ctx, "holds.raise");
    const who = await actor(ctx);
    const { data, error } = await ctx.supabase
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
    const ctx = context as Ctx;
    const supabase = ctx.supabase;
    const { data: hold, error: hErr } = await supabase
      .from("station_holds")
      .select("id, hold_type, status, evidence_urls")
      .eq("id", v.id)
      .maybeSingle();
    if (hErr) throw new Error(hErr.message);
    if (!hold) throw new Error("That hold no longer exists");
    if (hold.status !== "open") throw new Error("That hold is already closed");

    if (hold.hold_type === "quality" || hold.hold_type === "qc") {
      await requireAction(ctx, "holds.release");
    } else {
      const { data: canMaint } = await supabase.rpc("has_action", {
        _user_id: ctx.userId,
        _action: "maintenance.clear",
      });
      if (!canMaint) await requireAction(ctx, "holds.release");
    }

    const who = await actor(ctx);
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
