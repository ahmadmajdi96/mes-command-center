import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** SHA-256 hash of salt + PIN, using Web Crypto so it runs on the edge runtime. */
async function hashPin(salt: string, pin: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${salt}:${pin}`));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

const validPin = (p: unknown) => typeof p === "string" && /^\d{4,8}$/.test(p);

/** Companies a person belongs to. Reads role grants directly (privileged) so it works for any user. */
async function orgsOf(userId: string): Promise<string[]> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await (supabaseAdmin as any)
    .from("user_role_grants")
    .select("scope_kind, scope_id")
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
  const orgs = new Set<string>();
  let global = false;
  for (const g of data ?? []) {
    if (g.scope_kind === "org" && g.scope_id) orgs.add(g.scope_id);
    if (g.scope_kind === "global") global = true;
  }
  if (global || (orgs.size === 0 && (data ?? []).length > 0)) {
    // Global or sub-org grants: fall back to the org list (single-company deployments) / ancestor lookup.
    const { data: allOrgs } = await (supabaseAdmin as any).from("organizations").select("id");
    for (const o of allOrgs ?? []) orgs.add(o.id);
  }
  return [...orgs];
}

/** Set or replace the signed-in person's own quick-switch PIN. */
export const setOperatorPin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { pin: string }) => {
    if (!validPin(d?.pin)) throw new Error("PIN must be 4–8 digits");
    return { pin: d.pin };
  })
  .handler(async ({ data, context }) => {
    const { userId } = context as { userId: string };
    const orgs = await orgsOf(userId);
    if (!orgs[0]) throw new Error("No company membership found");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const pin_hash = await hashPin(userId, data.pin);
    const { error } = await (supabaseAdmin as any).from("operator_pins").upsert({ user_id: userId, organization_id: orgs[0], pin_hash });
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

/** Verify a PIN for another person on a shared station. Returns their name on success — never the PIN. */
export const verifyOperatorPin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { user_id: string; pin: string }) => {
    if (!d?.user_id || !validPin(d?.pin)) throw new Error("Pick a person and enter their PIN");
    return { user_id: String(d.user_id), pin: d.pin };
  })
  .handler(async ({ data, context }) => {
    const { userId } = context as { userId: string };
    const mine = new Set(await orgsOf(userId));
    const theirs = await orgsOf(data.user_id);
    if (!theirs.some((o) => mine.has(o))) throw new Error("That person is not in your company");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await (supabaseAdmin as any).from("operator_pins").select("pin_hash").eq("user_id", data.user_id).maybeSingle();
    if (!row) return { ok: false as const, error: "This person has no PIN set yet — they can set one on their Profile page." };
    const hash = await hashPin(data.user_id, data.pin);
    if (hash !== row.pin_hash) return { ok: false as const, error: "Wrong PIN" };
    const { data: prof } = await (supabaseAdmin as any).from("profiles").select("full_name, email").eq("id", data.user_id).maybeSingle();
    return { ok: true as const, name: prof?.full_name || prof?.email || "Operator" };
  });
