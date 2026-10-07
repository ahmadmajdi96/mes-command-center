import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";

const MAX_FAILS = 5;
const LOCK_MIN = 15;

/** Sign in on the server so failed attempts can be counted and the account locked for a while. */
export const signInWithLockout = createServerFn({ method: "POST" })
  .inputValidator((d: { email: string; password: string }) => {
    const email = String(d?.email ?? "").trim().toLowerCase();
    if (!email || !d?.password) throw new Error("Enter your email and password");
    if (email.length > 255 || String(d.password).length > 200) throw new Error("Invalid input");
    return { email, password: String(d.password) };
  })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const since = new Date(Date.now() - LOCK_MIN * 60_000).toISOString();
    const { data: recent } = await (supabaseAdmin as any)
      .from("auth_login_attempts").select("success, created_at").eq("email", data.email)
      .gte("created_at", since).order("created_at", { ascending: false }).limit(MAX_FAILS);
    const rows = (recent ?? []) as { success: boolean; created_at: string }[];
    const firstOk = rows.findIndex((r) => r.success);
    const fails = firstOk === -1 ? rows.length : firstOk;
    if (fails >= MAX_FAILS) {
      const unlock = new Date(new Date(rows[MAX_FAILS - 1].created_at).getTime() + LOCK_MIN * 60_000);
      const mins = Math.max(1, Math.ceil((unlock.getTime() - Date.now()) / 60_000));
      return { ok: false as const, locked: true, error: `Too many failed attempts. Try again in ${mins} minute${mins === 1 ? "" : "s"} or reset your password.` };
    }
    const c = createClient(process.env["SUPABASE_URL"]!, process.env["SUPABASE_PUBLISHABLE_KEY"]!, {
      auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
    });
    const { data: res, error } = await c.auth.signInWithPassword({ email: data.email, password: data.password });
    await (supabaseAdmin as any).from("auth_login_attempts").insert({ email: data.email, success: !error });
    if (error || !res.session) {
      const left = MAX_FAILS - fails - 1;
      return { ok: false as const, locked: left <= 0, error: left > 0 ? `Email or password is incorrect. ${left} attempt${left === 1 ? "" : "s"} left before a ${LOCK_MIN}-minute lock.` : `Too many failed attempts. Try again in ${LOCK_MIN} minutes or reset your password.` };
    }
    return { ok: true as const, access_token: res.session.access_token, refresh_token: res.session.refresh_token };
  });
