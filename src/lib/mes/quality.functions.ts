import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Phase B quality handoff: inspection results recorded at the step, nonconformances raised here
 * (decided by the external QA portal), and the operator-qualification check.
 * Routing-rule effects and NC creation on failure happen in DB triggers.
 */
type Ctx = { supabase: any; userId: string; claims: unknown };
const c = (x: unknown) => x as Ctx;

export type Characteristic = { name: string; type: "numeric" | "pass_fail"; min?: number | null; max?: number | null; unit?: string | null };

async function who(ctx: Ctx) {
  const { data } = await ctx.supabase.from("profiles").select("full_name, email").eq("id", ctx.userId).maybeSingle();
  return data?.full_name || data?.email || (ctx.claims as { email?: string } | null)?.email || "Unknown user";
}

/** Plans that apply to one step (matched by step name and, optionally, product). */
export async function plansForOperation(sb: any, op: { organization_id: string; name: string }, productId: string | null) {
  const { data } = await sb.from("inspection_plans").select("*").eq("organization_id", op.organization_id).eq("active", true);
  return (data ?? []).filter((p: any) => p.operation_name.toLowerCase() === op.name.toLowerCase() && (!p.product_id || p.product_id === productId));
}

export function requiredSamples(plan: any, processed: number) {
  if (plan.sampling === "every_qty" && Number(plan.sample_every) > 0) return Math.max(1, Math.ceil(processed / Number(plan.sample_every)));
  return 1;
}

/** Evaluate values against the plan's checks; returns the failed check names. */
export function evaluate(chars: Characteristic[], values: Record<string, unknown>) {
  const failed: string[] = [];
  const missing: string[] = [];
  for (const ch of chars) {
    const raw = values[ch.name];
    if (raw === undefined || raw === null || String(raw).trim() === "") { missing.push(ch.name); continue; }
    if (ch.type === "pass_fail") { if (!["pass", "ok", "true", "yes"].includes(String(raw).toLowerCase())) failed.push(ch.name); continue; }
    const n = Number(raw);
    if (!Number.isFinite(n)) { failed.push(`${ch.name} (not a number)`); continue; }
    if ((ch.min != null && n < Number(ch.min)) || (ch.max != null && n > Number(ch.max))) failed.push(`${ch.name} = ${n}${ch.unit ? ` ${ch.unit}` : ""} (limit ${ch.min ?? "–"}…${ch.max ?? "–"})`);
  }
  return { failed, missing };
}

export const getOperationQuality = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { operationId: string }) => { if (!d?.operationId) throw new Error("An operation is required"); return d; })
  .handler(async ({ data, context }) => {
    const ctx = c(context);
    const { data: op } = await ctx.supabase.from("order_operations").select("*").eq("id", data.operationId).maybeSingle();
    if (!op) throw new Error("Operation not found");
    const { data: po } = await ctx.supabase.from("production_orders").select("product_id").eq("id", op.production_order_id).maybeSingle();
    const plans = await plansForOperation(ctx.supabase, op, po?.product_id ?? null);
    const { data: results } = await ctx.supabase.from("inspection_results").select("*").eq("operation_id", op.id).order("created_at");
    const { data: ncs } = await ctx.supabase.from("nonconformances").select("id, status, decision, description, severity, created_at").eq("operation_id", op.id).order("created_at");
    const { data: missing } = await ctx.supabase.rpc("operation_missing_skills", { _op_id: op.id, _user_id: ctx.userId });
    const { data: reqs } = await ctx.supabase.from("skill_requirements").select("operation_name, product_id, skills(name, code)").eq("organization_id", op.organization_id);
    const requiredSkills = (reqs ?? []).filter((r: any) => r.operation_name.toLowerCase() === op.name.toLowerCase() && (!r.product_id || r.product_id === po?.product_id)).map((r: any) => r.skills?.name).filter(Boolean);
    return {
      plans: plans.map((p: any) => ({ ...p, required: requiredSamples(p, Number(op.qty_processed)), recorded: (results ?? []).filter((r: any) => r.plan_id === p.id).length })),
      results: results ?? [],
      nonconformances: ncs ?? [],
      requiredSkills: Array.from(new Set(requiredSkills)) as string[],
      missingSkills: (missing as string[] | null) ?? [],
    };
  });

export const recordInspection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { operationId: string; planId: string; values: Record<string, unknown>; notes?: string }) => {
    if (!d?.operationId || !d.planId) throw new Error("Operation and inspection plan are required");
    return d;
  })
  .handler(async ({ data, context }) => {
    const ctx = c(context);
    const { data: op } = await ctx.supabase.from("order_operations").select("*").eq("id", data.operationId).maybeSingle();
    if (!op) throw new Error("Operation not found");
    if (!["running", "partially_completed", "on_hold"].includes(op.status)) throw new Error("Inspection can only be recorded while the step is in progress");
    const { data: plan } = await ctx.supabase.from("inspection_plans").select("*").eq("id", data.planId).maybeSingle();
    if (!plan || plan.organization_id !== op.organization_id) throw new Error("Inspection plan not found");
    if (plan.performed_by === "qa_portal") throw new Error("This inspection is done by the QA portal; its result arrives automatically");
    const { failed, missing } = evaluate(plan.characteristics ?? [], data.values ?? {});
    if (missing.length) throw new Error(`Enter a value for: ${missing.join(", ")}`);
    const { count } = await ctx.supabase.from("inspection_results").select("id", { count: "exact", head: true }).eq("operation_id", op.id).eq("plan_id", plan.id);
    const name = await who(ctx);
    const result = failed.length ? "fail" : "pass";
    const { error } = await ctx.supabase.from("inspection_results").insert({
      organization_id: op.organization_id, plan_id: plan.id, operation_id: op.id, production_order_id: op.production_order_id,
      batch_id: op.batch_id, sample_no: (count ?? 0) + 1, values: data.values, failed_checks: failed, result, source: "local",
      notes: data.notes?.trim() || null, inspector_name: name, actor_user_id: ctx.userId,
    });
    if (error) throw new Error(error.message);
    return { result, failed };
  });

export const raiseNonconformance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { operationId: string; qty: number; severity: string; description: string }) => {
    if (!d?.operationId) throw new Error("An operation is required");
    if (!d.description?.trim()) throw new Error("Describe the nonconformance");
    if (!["minor", "major", "critical"].includes(d.severity)) throw new Error("Choose a severity");
    if (!(Number(d.qty) >= 0)) throw new Error("Quantity must be zero or more");
    return d;
  })
  .handler(async ({ data, context }) => {
    const ctx = c(context);
    const { data: op } = await ctx.supabase.from("order_operations").select("*").eq("id", data.operationId).maybeSingle();
    if (!op) throw new Error("Operation not found");
    const { data: po } = await ctx.supabase.from("production_orders").select("uom").eq("id", op.production_order_id).maybeSingle();
    const { data: row, error } = await ctx.supabase.from("nonconformances").insert({
      organization_id: op.organization_id, production_order_id: op.production_order_id, operation_id: op.id, batch_id: op.batch_id,
      qty: Number(data.qty), uom: po?.uom ?? null, severity: data.severity, description: data.description.trim(),
      raised_by_name: await who(ctx), raised_by_user_id: ctx.userId,
    }).select("id").single();
    if (error) throw new Error(error.message);
    return { id: row.id as string };
  });
