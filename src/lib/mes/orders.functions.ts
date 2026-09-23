import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Order and batch lifecycle. Every transition is permission-checked here and
 * validated again by the database triggers, so a client can never move an
 * order through a step that production rules forbid.
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

async function requireAction(context: Ctx, action: string) {
  const { data, error } = await context.supabase.rpc("has_action", {
    _user_id: context.userId,
    _action: action,
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("You do not have permission to change order status");
}

async function audit(
  context: Ctx,
  who: { id: string; name: string },
  entity: string,
  entityId: string,
  action: string,
  summary: string,
  before: unknown,
  after: unknown,
) {
  await context.supabase.from("audit_entries").insert({
    id: `AE-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    actor_id: who.id,
    actor_name: who.name,
    actor_user_id: who.id,
    entity,
    entity_id: entityId,
    action,
    summary,
    before_data: before as never,
    after_data: after as never,
  });
}

export const orderTransitions: Record<string, string[]> = {
  scheduled: ["released", "cancelled"],
  planned: ["released", "cancelled"],
  released: ["running", "scheduled", "cancelled"],
  running: ["paused", "hold", "completed", "cancelled"],
  paused: ["running", "hold", "cancelled"],
  hold: ["running", "paused", "cancelled"],
  completed: ["closed"],
  finished: ["closed"],
  closed: [],
  cancelled: [],
};

/** Allowed next statuses for a current status (used to enable/disable buttons). */
export function nextStatuses(current: string | null | undefined): string[] {
  if (!current) return [];
  return orderTransitions[current] ?? [];
}

type SetStatusInput = { id: string; status: string; reason?: string };

const validate = (d: SetStatusInput) => {
  if (!d.id) throw new Error("An order is required");
  if (!d.status) throw new Error("A new status is required");
  return d;
};

/** Move a production order to a new status. */
export const setOrderStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validate)
  .handler(async ({ data: v, context }) => {
    await requireAction(context as Ctx, "orders.lifecycle");
    const ctx = context as Ctx;
    const who = await actor(ctx);

    const { data: before, error: bErr } = await ctx.supabase
      .from("production_orders")
      .select("*")
      .eq("id", v.id)
      .maybeSingle();
    if (bErr) throw new Error(bErr.message);
    if (!before) throw new Error("That order no longer exists");

    const allowed = orderTransitions[before.status] ?? null;
    if (allowed && !allowed.includes(v.status)) {
      throw new Error(
        `An order at "${before.status}" cannot move to "${v.status}". Allowed: ${allowed.length ? allowed.join(", ") : "none"}`,
      );
    }

    const { data, error } = await ctx.supabase
      .from("production_orders")
      .update({ status: v.status })
      .eq("id", v.id)
      .select()
      .single();
    if (error) throw new Error(error.message);

    await audit(
      ctx,
      who,
      "production_order",
      v.id,
      `status:${v.status}`,
      `Order ${before.number} moved from ${before.status} to ${v.status}${v.reason ? ` — ${v.reason}` : ""}`,
      { status: before.status },
      { status: v.status },
    );
    return data;
  });

/** Move a batch to a new status. */
export const setBatchStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validate)
  .handler(async ({ data: v, context }) => {
    await requireAction(context as Ctx, "orders.lifecycle");
    const ctx = context as Ctx;
    const who = await actor(ctx);

    const { data: before, error: bErr } = await ctx.supabase
      .from("production_batches")
      .select("*")
      .eq("id", v.id)
      .maybeSingle();
    if (bErr) throw new Error(bErr.message);
    if (!before) throw new Error("That batch no longer exists");

    const allowed = orderTransitions[before.status] ?? null;
    if (allowed && !allowed.includes(v.status)) {
      throw new Error(
        `A batch at "${before.status}" cannot move to "${v.status}". Allowed: ${allowed.length ? allowed.join(", ") : "none"}`,
      );
    }

    const { data, error } = await ctx.supabase
      .from("production_batches")
      .update({ status: v.status })
      .eq("id", v.id)
      .select()
      .single();
    if (error) throw new Error(error.message);

    await audit(
      ctx,
      who,
      "production_batch",
      v.id,
      `status:${v.status}`,
      `Batch ${before.number} moved from ${before.status} to ${v.status}${v.reason ? ` — ${v.reason}` : ""}`,
      { status: before.status },
      { status: v.status },
    );
    return data;
  });
