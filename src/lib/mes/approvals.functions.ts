import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const APPROVAL_KINDS = {
  order_release: "Order release",
  scrap_over_limit: "Scrap over limit",
  step_override: "Step override (skip)",
  version_change: "Production version change",
} as const;
export type ApprovalKind = keyof typeof APPROVAL_KINDS;

/** Re-checks the signer's password with a throwaway client (nothing is stored). */
async function verifyPassword(email: string, password: string) {
  const c = createClient(process.env["SUPABASE_URL"]!, process.env["SUPABASE_PUBLISHABLE_KEY"]!, {
    auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
  });
  const { error } = await c.auth.signInWithPassword({ email, password });
  return !error;
}

export const requestApproval = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { organizationId: string; kind: ApprovalKind; refTable: string; refId: string; summary: string; details?: Record<string, unknown> }) => {
    if (!(d.kind in APPROVAL_KINDS)) throw new Error("Unknown approval type");
    if (!d.refId || !d.summary?.trim()) throw new Error("A reference and a summary are required");
    return d;
  })
  .handler(async ({ data, context }) => {
    const { data: prof } = await context.supabase.from("profiles").select("full_name, email").eq("id", context.userId).maybeSingle();
    const { data: row, error } = await context.supabase.from("approval_requests" as never).insert({
      organization_id: data.organizationId, kind: data.kind, ref_table: data.refTable, ref_id: data.refId,
      summary: data.summary.trim().slice(0, 300), details: data.details ?? {},
      requested_by: context.userId, requested_by_name: prof?.full_name ?? prof?.email ?? null,
    } as never).select("id").single();
    if (error) throw new Error(error.message);
    return { id: (row as { id: string }).id };
  });

/** Approve or reject with an electronic signature (password re-entry + reason). */
export const decideApproval = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; approve: boolean; reason: string; password: string }) => {
    if (!d.id) throw new Error("Missing request");
    if (!d.reason?.trim() || d.reason.trim().length < 3) throw new Error("A reason is required to sign");
    if (!d.password) throw new Error("Enter your password to sign");
    return d;
  })
  .handler(async ({ data, context }) => {
    const email = (context.claims as { email?: string }).email;
    if (!email) throw new Error("Your account has no email to sign with");
    if (!(await verifyPassword(email, data.password))) throw new Error("Password is incorrect — signature refused");

    const { data: req } = await context.supabase.from("approval_requests" as never).select("*").eq("id", data.id).maybeSingle();
    const r = req as { id: string; organization_id: string; status: string; kind: string; ref_table: string; ref_id: string } | null;
    if (!r) throw new Error("Request not found");
    if (r.status !== "pending") throw new Error("This request was already decided");

    const [{ data: a }, { data: b }] = await Promise.all([
      context.supabase.rpc("has_action", { _user_id: context.userId, _action: "execution.override" }),
      context.supabase.rpc("has_action", { _user_id: context.userId, _action: "orders.lifecycle" }),
    ]);
    if (!a && !b) throw new Error("You are not allowed to approve");

    const { data: prof } = await context.supabase.from("profiles").select("full_name").eq("id", context.userId).maybeSingle();
    const name = prof?.full_name ?? email;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const now = new Date().toISOString();
    const { error: e1 } = await (supabaseAdmin as any).from("approval_requests").update({
      status: data.approve ? "approved" : "rejected", decided_by: context.userId, decided_by_name: name,
      decided_at: now, decision_reason: data.reason.trim(),
    }).eq("id", r.id).eq("status", "pending");
    if (e1) throw new Error(e1.message);
    const { error: e2 } = await (supabaseAdmin as any).from("e_signatures").insert({
      organization_id: r.organization_id, signer_id: context.userId, signer_name: name, signer_email: email,
      meaning: `${data.approve ? "Approved" : "Rejected"}: ${APPROVAL_KINDS[r.kind as ApprovalKind] ?? r.kind}`,
      ref_table: "approval_requests", ref_id: r.id, reason: data.reason.trim(), signed_at: now,
    });
    if (e2) throw new Error(e2.message);
    return { ok: true };
  });
