import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Step-level execution: start, setup, hold/resume, confirm/complete, approve,
 * block, rework, exceptions, order holds, order modification and release checks.
 * The acting person always comes from the session. Database triggers repeat the
 * sequencing / hold / approval rules so nothing can bypass them.
 */

type Ctx = { supabase: any; userId: string; claims: unknown };
const c = (x: unknown) => x as Ctx;

async function who(ctx: Ctx) {
  const { data } = await ctx.supabase.from("profiles").select("full_name, email").eq("id", ctx.userId).maybeSingle();
  const email = (ctx.claims as { email?: string } | null)?.email ?? null;
  return { id: ctx.userId, name: data?.full_name || data?.email || email || "Unknown user" };
}

async function need(ctx: Ctx, ...actions: string[]) {
  for (const a of actions) {
    const { data, error } = await ctx.supabase.rpc("has_action", { _user_id: ctx.userId, _action: a });
    if (error) throw new Error(error.message);
    if (data) return;
  }
  throw new Error(`You do not have permission for this (${actions.join(" or ")})`);
}

async function audit(ctx: Ctx, w: { id: string; name: string }, entity: string, entityId: string, action: string, summary: string, before: unknown, after: unknown, reason?: string | null) {
  const { error: auditErr } = await ctx.supabase.from("audit_entries").insert({
    id: `AE-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    actor_id: w.id, actor_name: w.name, actor_user_id: w.id,
    entity, entity_id: entityId, action, summary, reason: reason ?? null,
    before_data: before as never, after_data: after as never,
  });
  if (auditErr) console.error("audit write failed", auditErr.message);
}

async function loadOp(ctx: Ctx, id: string) {
  const { data, error } = await ctx.supabase.from("order_operations").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("That operation no longer exists");
  const { data: po } = await ctx.supabase.from("production_orders").select("*").eq("id", data.production_order_id).maybeSingle();
  if (!po) throw new Error("The order of this operation no longer exists");
  return { op: data, po };
}

async function event(ctx: Ctx, w: { id: string; name: string }, op: any, type: string, reason: string | null, payload: Record<string, unknown> = {}) {
  const { error } = await ctx.supabase.from("operation_events").insert({
    organization_id: op.organization_id, production_order_id: op.production_order_id, operation_id: op.id,
    event_type: type, reason, payload, actor_user_id: w.id, actor_name: w.name,
  });
  if (error) throw new Error(error.message);
}

/** Service client for order/step status flips that follow an already-verified permission check (triggers still apply). */
async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

const num = (v: unknown, label: string) => {
  const n = Number(v ?? 0);
  if (!Number.isFinite(n) || n < 0) throw new Error(`${label} must be zero or more`);
  return n;
};
const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

/* ---------------- Readiness ---------------- */

export const getReleaseCheck = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { orderId: string }) => { if (!d?.orderId) throw new Error("An order is required"); return d; })
  .handler(async ({ data, context }) => {
    const { data: r, error } = await c(context).supabase.rpc("order_release_check", { _po_id: data.orderId });
    if (error) throw new Error(error.message);
    return r as { key: string; label: string; ok: boolean; blocking: boolean; detail: string }[];
  });

export const getOperationBlock = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { operationId: string }) => d)
  .handler(async ({ data, context }) => {
    const { data: r, error } = await c(context).supabase.rpc("operation_block_reason", { _op_id: data.operationId, _check_sequence: true });
    if (error) throw new Error(error.message);
    return { reason: (r as string | null) ?? null };
  });

/* ---------------- Start / setup ---------------- */

type StartIn = { operationId: string; inputQty: number; machineId?: string | null; stationId?: string | null; batchId?: string | null; withSetup?: boolean; parameters?: Record<string, string> };

export const startOperation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: StartIn) => {
    if (!d?.operationId) throw new Error("An operation is required");
    num(d.inputQty, "Input quantity");
    return d;
  })
  .handler(async ({ data: v, context }) => {
    const ctx = c(context);
    await need(ctx, "execution.record");
    const w = await who(ctx);
    const { op, po } = await loadOp(ctx, v.operationId);
    if (!["pending", "ready", "rework_required"].includes(op.status)) throw new Error(`Operation "${op.name}" is ${op.status.replace("_", " ")} and cannot be started`);
    const input = Number(v.inputQty);
    if (input <= 0) throw new Error("Enter the input quantity for this operation");

    // Quantity available from the previous step (or the order for the first step)
    const { data: all } = await ctx.supabase.from("order_operations").select("id, sequence, status, qty_yield, qty_input, name").eq("production_order_id", op.production_order_id).order("sequence");
    const prev = (all ?? []).filter((o: any) => o.sequence < op.sequence && !["skipped", "cancelled"].includes(o.status)).at(-1);
    const available = op.status === "rework_required"
      ? Number(op.qty_rejected || op.qty_input || po.qty)
      : prev ? Number(prev.qty_yield) - Number(op.qty_input) : Number(po.qty) - Number(op.qty_input);
    if (input > available + 1e-9) throw new Error(`Only ${Math.max(0, available)} ${po.uom} is available for "${op.name}"${prev ? ` (accepted at "${prev.name}")` : ""}`);

    if (v.machineId) {
      const { data: m } = await ctx.supabase.from("machines").select("id, name, status").eq("id", v.machineId).maybeSingle();
      if (!m) throw new Error("Machine not found");
      if (["fault", "down", "maintenance", "offline"].includes(String(m.status))) throw new Error(`Machine ${m.name} is ${m.status}`);
    }
    const fields: string[] = op.required_fields ?? [];
    if (fields.includes("machine") && !v.machineId) throw new Error("This operation requires a machine");
    if (fields.includes("batch") && !v.batchId) throw new Error("This operation requires a batch / lot");
    if (fields.includes("parameters") && !Object.values(v.parameters ?? {}).some((x) => String(x).trim())) throw new Error("This operation requires execution parameters");

    // Move a released order to running on the first start
    if (po.status === "released") {
      await need(ctx, "orders.lifecycle", "execution.record");
      const { error } = await (await admin()).from("production_orders").update({ status: "running" }).eq("id", po.id);
      if (error) throw new Error(error.message);
      await audit(ctx, w, "production_order", po.id, "status:running", `Order ${po.number} started by first operation "${op.name}"`, { status: "released" }, { status: "running" });
    }

    const now = new Date().toISOString();
    const patch: Record<string, unknown> = {
      status: "running",
      status_reason: op.status === "rework_required" ? "Rework started" : "Operation started",
      qty_input: Number(op.qty_input) + input,
      machine_id: v.machineId || op.machine_id,
      station_id: v.stationId || op.station_id,
      batch_id: v.batchId || op.batch_id,
      parameters: { ...(op.parameters ?? {}), ...(v.parameters ?? {}) },
      started_at: op.started_at ?? now,
      started_by: op.started_by ?? w.name,
      started_by_user_id: op.started_by_user_id ?? w.id,
      hold_category: null,
    };
    if (v.withSetup) { patch.setup_started_at = now; patch.setup_completed_at = null; }
    const { error } = await ctx.supabase.from("order_operations").update(patch).eq("id", op.id);
    if (error) throw new Error(error.message);
    await event(ctx, w, op, "start", null, { input_qty: input, machine_id: patch.machine_id, station_id: patch.station_id, batch_id: patch.batch_id, parameters: v.parameters ?? {}, work_center_id: op.work_center_id, setup: !!v.withSetup });
    if (v.withSetup) await event(ctx, w, op, "setup_start", null, {});
    return { ok: true };
  });

export const finishSetup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { operationId: string }) => d)
  .handler(async ({ data: v, context }) => {
    const ctx = c(context);
    await need(ctx, "execution.record");
    const w = await who(ctx);
    const { op } = await loadOp(ctx, v.operationId);
    if (!op.setup_started_at || op.setup_completed_at) throw new Error("No setup is running for this operation");
    const { error } = await ctx.supabase.from("order_operations").update({ setup_completed_at: new Date().toISOString() }).eq("id", op.id);
    if (error) throw new Error(error.message);
    const mins = Math.round((Date.now() - new Date(op.setup_started_at).getTime()) / 6000) / 10;
    await event(ctx, w, op, "setup_end", null, { setup_min: mins });
    return { ok: true, setup_min: mins };
  });

/* ---------------- Hold / resume / block / rework / skip ---------------- */

type StatusIn = { operationId: string; action: "hold" | "resume" | "block" | "unblock" | "rework" | "skip" | "cancel"; reason?: string; category?: string };

export const changeOperationStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: StatusIn) => {
    if (!d?.operationId || !d.action) throw new Error("Operation and action are required");
    if (d.action !== "resume" && d.action !== "unblock" && !str(d.reason)) throw new Error("A reason is required");
    return d;
  })
  .handler(async ({ data: v, context }) => {
    const ctx = c(context);
    const w = await who(ctx);
    const { op } = await loadOp(ctx, v.operationId);
    let status = op.status as string;
    let extra: Record<string, unknown> = {};
    switch (v.action) {
      case "hold":
        await need(ctx, "execution.record");
        if (!["running", "partially_completed"].includes(op.status)) throw new Error("Only a running operation can be put on hold");
        if (op.setup_started_at && !op.setup_completed_at) extra.setup_completed_at = new Date().toISOString();
        status = "on_hold"; extra.hold_category = v.category || "waiting"; break;
      case "resume":
        await need(ctx, "execution.record");
        if (op.status !== "on_hold") throw new Error("Operation is not on hold");
        status = "running"; extra.hold_category = null; break;
      case "block":
        await need(ctx, "execution.override");
        if (["completed", "cancelled", "skipped"].includes(op.status)) throw new Error("A finished operation cannot be blocked");
        status = "blocked"; break;
      case "unblock":
        await need(ctx, "execution.override");
        if (op.status !== "blocked") throw new Error("Operation is not blocked");
        status = op.started_at ? "on_hold" : "ready"; if (status === "on_hold") extra.hold_category = "waiting"; break;
      case "rework":
        await need(ctx, "execution.rework", "execution.override");
        if (!["completed", "partially_completed", "running"].includes(op.status)) throw new Error("Only a started or completed operation can be sent to rework");
        status = "rework_required"; break;
      case "skip":
        await need(ctx, "execution.override");
        if (!["pending", "ready"].includes(op.status)) throw new Error("Only an operation that has not started can be skipped");
        status = "skipped"; break;
      case "cancel":
        await need(ctx, "execution.override");
        if (["completed", "skipped", "cancelled"].includes(op.status)) throw new Error("This operation is already finished");
        status = "cancelled"; break;
    }
    const { error } = await ctx.supabase.from("order_operations").update({ status, status_reason: str(v.reason) ?? (v.action === "resume" ? "Resumed" : "Unblocked"), ...extra }).eq("id", op.id);
    if (error) throw new Error(error.message);
    await audit(ctx, w, "order_operation", op.id, `operation:${v.action}`, `Operation "${op.name}" ${v.action}${v.reason ? ` — ${v.reason}` : ""}`, { status: op.status }, { status }, v.reason);
    return { ok: true, status };
  });

/* ---------------- Confirm / complete ---------------- */

type ConfirmIn = {
  operationId: string; produced: number; accepted: number; rejected: number; scrap: number;
  scrapReason?: string | null; rejectReason?: string | null; completionReason?: string | null; notes?: string | null;
  final: boolean; batchId?: string | null; postGoodsReceipt?: boolean;
};

export const confirmOperation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: ConfirmIn) => {
    if (!d?.operationId) throw new Error("An operation is required");
    const p = num(d.produced, "Produced"), a = num(d.accepted, "Accepted"), r = num(d.rejected, "Rejected"), s = num(d.scrap, "Scrap");
    if (Math.abs(p - (a + r + s)) > 1e-9) throw new Error(`Produced (${p}) must equal accepted + rejected + scrap (${a + r + s})`);
    if (p <= 0 && !d.final) throw new Error("Enter a produced quantity");
    if (s > 0 && !str(d.scrapReason)) throw new Error("Scrap quantity needs a scrap reason");
    if (r > 0 && !str(d.rejectReason)) throw new Error("Rejected quantity needs a reject reason");
    return d;
  })
  .handler(async ({ data: v, context }) => {
    const ctx = c(context);
    await need(ctx, "execution.record");
    const w = await who(ctx);
    const { op, po } = await loadOp(ctx, v.operationId);
    if (!["running", "partially_completed"].includes(op.status)) throw new Error(`Operation "${op.name}" must be running to confirm quantities (it is ${op.status.replace("_", " ")})`);
    if (op.setup_started_at && !op.setup_completed_at) throw new Error("Finish the setup before confirming quantities");
    const processed = Number(op.qty_processed) + Number(v.produced);
    if (processed > Number(op.qty_input) + 1e-9) throw new Error(`Produced would total ${processed} ${po.uom}, more than the ${op.qty_input} ${po.uom} input to this operation`);

    if (v.final) {
      const fields: string[] = op.required_fields ?? [];
      const missing: string[] = [];
      if (fields.includes("notes") && !str(v.notes)) missing.push("execution notes");
      if (fields.includes("machine") && !op.machine_id) missing.push("machine");
      if (fields.includes("batch") && !(v.batchId || op.batch_id)) missing.push("batch / lot");
      if (fields.includes("completion_reason") && !str(v.completionReason)) missing.push("completion reason");
      if (processed < Number(op.qty_input) - 1e-9 && !str(v.completionReason)) missing.push(`completion reason (only ${processed} of ${op.qty_input} ${po.uom} processed)`);
      if (missing.length) throw new Error(`Before completing, fill in: ${missing.join(", ")}`);
    }

    const { error } = await ctx.supabase.from("production_confirmations").insert({
      organization_id: op.organization_id, production_order_id: op.production_order_id, operation_id: op.id,
      batch_id: v.batchId || op.batch_id || null,
      qty_input: op.qty_input, qty_produced: v.produced, qty_yield: v.accepted, qty_rejected: v.rejected, qty_scrap: v.scrap,
      scrap_reason: str(v.scrapReason), reject_reason: str(v.rejectReason), completion_reason: str(v.completionReason),
      notes: str(v.notes), final: !!v.final, post_goods_receipt: v.postGoodsReceipt ?? true,
      actor_user_id: w.id, actor_name: w.name,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ---------------- Approval ---------------- */

export const approveOperation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { operationId: string; comment?: string }) => d)
  .handler(async ({ data: v, context }) => {
    const ctx = c(context);
    await need(ctx, "execution.override");
    const w = await who(ctx);
    const { op } = await loadOp(ctx, v.operationId);
    if (!op.requires_approval) throw new Error("This operation does not need approval");
    if (op.approved_at) throw new Error("Already approved");
    if (!["completed", "partially_completed"].includes(op.status)) throw new Error("Only a confirmed operation can be approved");
    if (op.started_by_user_id === w.id) {
      const { data: admin } = await ctx.supabase.rpc("has_action", { _user_id: ctx.userId, _action: "platform.admin" });
      if (!admin) throw new Error("The person who ran the operation cannot approve it");
    }
    const { error } = await ctx.supabase.from("order_operations").update({ approved_at: new Date().toISOString(), approved_by_name: w.name, approved_by_user_id: w.id, approval_comment: str(v.comment) }).eq("id", op.id);
    if (error) throw new Error(error.message);
    await event(ctx, w, op, "approved", str(v.comment), {});
    await audit(ctx, w, "order_operation", op.id, "operation:approve", `Operation "${op.name}" approved`, null, { approved_by: w.name }, v.comment);
    return { ok: true };
  });

/* ---------------- Exceptions ---------------- */

type ExIn = {
  exception_type: string; severity?: string; production_order_id?: string | null; operation_id?: string | null;
  line_id?: string | null; station_id?: string | null; machine_id?: string | null; resource?: string | null;
  reason_code?: string | null; description: string; blocks_execution?: boolean; hold_operation?: boolean; started_at?: string | null;
};

export const raiseException = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: ExIn) => {
    if (!d?.exception_type) throw new Error("Exception type is required");
    if (!str(d.description)) throw new Error("A description is required");
    return d;
  })
  .handler(async ({ data: v, context }) => {
    const ctx = c(context);
    await need(ctx, "execution.record", "downtime.record");
    const w = await who(ctx);
    let org = "ORG-01";
    if (v.production_order_id) {
      const { data: po } = await ctx.supabase.from("production_orders").select("organization_id, line_id").eq("id", v.production_order_id).maybeSingle();
      if (!po) throw new Error("Order not found");
      org = po.organization_id; v.line_id = v.line_id || po.line_id;
    } else {
      const { data: orgs } = await ctx.supabase.rpc("user_orgs", { _user_id: ctx.userId });
      org = orgs?.[0]?.organization_id ?? org;
    }
    const { data: ex, error } = await ctx.supabase.from("production_exceptions").insert({
      organization_id: org, exception_type: v.exception_type, severity: v.severity || "medium",
      production_order_id: v.production_order_id || null, operation_id: v.operation_id || null,
      line_id: v.line_id || null, station_id: v.station_id || null, machine_id: v.machine_id || null,
      resource: str(v.resource), reason_code: str(v.reason_code), description: str(v.description),
      blocks_execution: !!v.blocks_execution, operator_name: w.name, operator_user_id: w.id,
      started_at: v.started_at || new Date().toISOString(),
    }).select().single();
    if (error) throw new Error(error.message);
    if (v.hold_operation && v.operation_id) {
      const { op } = await loadOp(ctx, v.operation_id);
      if (["running", "partially_completed"].includes(op.status)) {
        const cat = ["machine_failure", "tool_failure", "resource_unavailable"].includes(v.exception_type) ? "downtime" : v.exception_type === "material_shortage" ? "material" : "waiting";
        const { error: e2 } = await ctx.supabase.from("order_operations").update({ status: "on_hold", hold_category: cat, status_reason: `Exception ${ex.id}: ${v.description}` }).eq("id", op.id);
        if (e2) throw new Error(e2.message);
      }
    }
    await audit(ctx, w, "production_exception", ex.id, "exception:raise", `${v.exception_type.replace(/_/g, " ")} raised${v.production_order_id ? ` on ${v.production_order_id}` : ""}: ${v.description}`, null, ex);
    return ex;
  });

export const resolveException = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; resolution: string; ended_at?: string | null; resume_operation?: boolean }) => {
    if (!d?.id) throw new Error("Exception is required");
    if (!str(d.resolution)) throw new Error("A resolution is required");
    return d;
  })
  .handler(async ({ data: v, context }) => {
    const ctx = c(context);
    await need(ctx, "execution.record", "downtime.record");
    const w = await who(ctx);
    const { data: ex } = await ctx.supabase.from("production_exceptions").select("*").eq("id", v.id).maybeSingle();
    if (!ex) throw new Error("Exception not found");
    const { error } = await ctx.supabase.from("production_exceptions").update({
      status: "resolved", resolution: str(v.resolution), ended_at: v.ended_at || new Date().toISOString(), resolved_by_name: w.name, resolved_by_user_id: w.id,
    }).eq("id", v.id);
    if (error) throw new Error(error.message);
    if (v.resume_operation && ex.operation_id) {
      const { op } = await loadOp(ctx, ex.operation_id);
      if (op.status === "on_hold") {
        const { error: e2 } = await ctx.supabase.from("order_operations").update({ status: "running", hold_category: null, status_reason: `Exception ${ex.id} resolved` }).eq("id", op.id);
        if (e2) throw new Error(e2.message);
      }
    }
    await audit(ctx, w, "production_exception", ex.id, "exception:resolve", `Exception ${ex.id} resolved: ${v.resolution}`, { status: "open" }, { status: "resolved" });
    return { ok: true };
  });

/* ---------------- Order holds ---------------- */

export const placeOrderHold = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { orderId: string; hold_type: string; reason: string; comments?: string }) => {
    if (!d?.orderId) throw new Error("An order is required");
    if (!str(d.reason)) throw new Error("A hold reason is required");
    return d;
  })
  .handler(async ({ data: v, context }) => {
    const ctx = c(context);
    await need(ctx, "holds.raise");
    const w = await who(ctx);
    const { data: po } = await ctx.supabase.from("production_orders").select("*").eq("id", v.orderId).maybeSingle();
    if (!po) throw new Error("Order not found");
    if (!["scheduled", "planned", "released", "running", "paused", "hold"].includes(po.status)) throw new Error(`An order that is ${po.status} cannot be put on hold`);
    const prev = po.status === "hold" ? null : po.status;
    const { data: h, error } = await ctx.supabase.from("order_holds").insert({
      organization_id: po.organization_id, production_order_id: po.id, hold_type: v.hold_type || "other",
      reason: str(v.reason), comments: str(v.comments), prev_status: prev ?? undefined,
      opened_by_user_id: w.id, opened_by_name: w.name,
    }).select().single();
    if (error) throw new Error(error.message);
    if (po.status !== "hold") {
      const { error: e2 } = await (await admin()).from("production_orders").update({ status: "hold" }).eq("id", po.id);
      if (e2) throw new Error(e2.message);
    }
    // Pause running steps so their hold time is counted
    const { data: running } = await ctx.supabase.from("order_operations").select("id").eq("production_order_id", po.id).in("status", ["running", "partially_completed"]);
    for (const r of running ?? []) {
      const { error: e3 } = await (await admin()).from("order_operations").update({ status: "on_hold", hold_category: "waiting", status_reason: `Order hold: ${v.reason}` }).eq("id", r.id);
      if (e3) throw new Error(e3.message);
    }
    await audit(ctx, w, "production_order", po.id, "hold:place", `Order ${po.number} put on hold (${v.hold_type}): ${v.reason}`, { status: po.status }, { status: "hold", hold_id: h.id }, v.reason);
    return h;
  });

export const releaseOrderHold = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { holdId: string; comments: string }) => {
    if (!d?.holdId) throw new Error("A hold is required");
    if (!str(d.comments)) throw new Error("Release comments are required");
    return d;
  })
  .handler(async ({ data: v, context }) => {
    const ctx = c(context);
    await need(ctx, "holds.release", "execution.override");
    const w = await who(ctx);
    const { data: h } = await ctx.supabase.from("order_holds").select("*").eq("id", v.holdId).maybeSingle();
    if (!h) throw new Error("Hold not found");
    if (h.status !== "open") throw new Error("This hold is already released");
    if (h.opened_by_user_id === w.id) {
      const { data: admin } = await ctx.supabase.rpc("has_action", { _user_id: ctx.userId, _action: "platform.admin" });
      if (!admin) throw new Error("The person who placed a hold cannot release it");
    }
    const { error } = await ctx.supabase.from("order_holds").update({ status: "released", release_comments: str(v.comments), released_by_user_id: w.id, released_by_name: w.name }).eq("id", h.id);
    if (error) throw new Error(error.message);
    const { data: others } = await ctx.supabase.from("order_holds").select("id").eq("production_order_id", h.production_order_id).eq("status", "open");
    let back: string | null = null;
    if (!others?.length) {
      const { data: po } = await ctx.supabase.from("production_orders").select("status").eq("id", h.production_order_id).maybeSingle();
      if (po?.status === "hold") {
        const { data: first } = await ctx.supabase.from("order_holds").select("prev_status").eq("production_order_id", h.production_order_id).not("prev_status", "is", null).order("opened_at", { ascending: false }).limit(1);
        back = first?.[0]?.prev_status ?? "released";
        const { error: e2 } = await (await admin()).from("production_orders").update({ status: back }).eq("id", h.production_order_id);
        if (e2) throw new Error(e2.message);
      }
    }
    await audit(ctx, w, "production_order", h.production_order_id, "hold:release", `Hold released: ${v.comments}${back ? ` — order back to ${back}` : ""}`, { hold: "open" }, { hold: "released", status: back }, v.comments);
    return { ok: true, status: back };
  });

/* ---------------- Order modification / cancellation ---------------- */

const EDITABLE = ["qty", "planned_start", "planned_end", "priority", "line_id", "shift", "operator", "notes"] as const;
type ModIn = { id: string; reason: string; patch: Partial<Record<(typeof EDITABLE)[number], unknown>> };

export const modifyOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: ModIn) => {
    if (!d?.id) throw new Error("An order is required");
    if (!str(d.reason)) throw new Error("A reason for the change is required");
    return d;
  })
  .handler(async ({ data: v, context }) => {
    const ctx = c(context);
    await need(ctx, "orders.write");
    const w = await who(ctx);
    const { data: po } = await ctx.supabase.from("production_orders").select("*").eq("id", v.id).maybeSingle();
    if (!po) throw new Error("Order not found");
    if (["completed", "finished", "closed", "cancelled"].includes(po.status)) throw new Error(`A ${po.status} order can no longer be changed`);
    const before: Record<string, unknown> = {}, after: Record<string, unknown> = {};
    for (const k of EDITABLE) {
      if (!(k in (v.patch ?? {}))) continue;
      let nv = (v.patch as any)[k];
      if (nv === "") nv = null;
      if (k === "qty") nv = Number(nv);
      const ov = po[k];
      const same = k === "planned_start" || k === "planned_end" ? (ov ? new Date(ov).getTime() : null) === (nv ? new Date(nv).getTime() : null) : String(ov ?? "") === String(nv ?? "");
      if (!same) { before[k] = ov; after[k] = nv; }
    }
    if (!Object.keys(after).length) throw new Error("Nothing changed");
    if ("qty" in after) {
      const q = Number(after.qty);
      if (!(q > 0)) throw new Error("Quantity must be above zero");
      const { data: confs } = await ctx.supabase.from("production_confirmations").select("qty_yield").eq("production_order_id", po.id);
      const done = (confs ?? []).reduce((s: number, x: any) => s + Number(x.qty_yield), 0);
      if (q < done) throw new Error(`Quantity cannot go below the ${done} ${po.uom} already confirmed`);
      if (!["scheduled", "planned", "released", "hold"].includes(po.status)) {
        await need(ctx, "execution.override");
      }
    }
    if ("line_id" in after && ["running", "paused"].includes(po.status)) throw new Error("The line cannot change while the order is running");
    const s = (after.planned_start ?? po.planned_start) as string | null, e = (after.planned_end ?? po.planned_end) as string | null;
    if (s && e && new Date(e) < new Date(s)) throw new Error("Planned end must be after planned start");
    if ("priority" in after && !["low", "normal", "high", "urgent"].includes(String(after.priority))) throw new Error("Priority must be low, normal, high or urgent");
    const { error } = await ctx.supabase.from("production_orders").update(after).eq("id", po.id);
    if (error) throw new Error(error.message);
    await audit(ctx, w, "production_order", po.id, "modify", `Order ${po.number} changed: ${Object.keys(after).join(", ")} — ${v.reason}`, before, after, v.reason);
    return { ok: true, changed: Object.keys(after) };
  });
