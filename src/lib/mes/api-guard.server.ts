import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

/**
 * Shared guard for the versioned MES integration API. Callers must present a
 * service key; there is no anonymous access to operational datasets.
 */
export function corsHeaders(request: Request) {
  const allowed = (process.env['MES_API_ALLOWED_ORIGINS'] ?? "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
  const origin = request.headers.get("origin");
  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": "GET,OPTIONS",
    "Access-Control-Allow-Headers": "content-type,authorization",
    Vary: "Origin",
    "Cache-Control": "no-store",
  };
  if (origin && allowed.includes(origin)) headers["Access-Control-Allow-Origin"] = origin;
  return headers;
}

function constantTimeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function presentedKey(request: Request) {
  const auth = request.headers.get("authorization") ?? "";
  return auth.toLowerCase().startsWith("bearer ")
    ? auth.slice(7).trim()
    : (request.headers.get("x-api-key") ?? "").trim();
}

async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export type ApiCaller = { organizationId: string | null; label: string };

/**
 * Resolves the calling integration to one customer company. Per-tenant keys are
 * stored hashed in `api_keys`; the platform-wide MES_API_KEY sees every company.
 */
export async function authorizeApi(
  request: Request,
): Promise<{ denied: Response } | { caller: ApiCaller }> {
  const headers = corsHeaders(request);
  const presented = presentedKey(request);
  const platformKey = process.env['MES_API_KEY'];

  if (!presented) {
    return { denied: Response.json({ error: "Unauthorized" }, { status: 401, headers }) };
  }

  if (platformKey && constantTimeEqual(presented, platformKey)) {
    return { caller: { organizationId: null, label: "platform" } };
  }

  const hash = await sha256Hex(presented);
  const { data, error } = await serviceClient()
    .from("api_keys")
    .select("id, organization_id, label, active")
    .eq("key_hash", hash)
    .eq("active", true)
    .maybeSingle();

  if (error || !data) {
    return { denied: Response.json({ error: "Unauthorized" }, { status: 401, headers }) };
  }

  await serviceClient()
    .from("api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", data.id);

  return { caller: { organizationId: data.organization_id, label: data.label } };
}

/** Back-compat guard: returns a Response when the caller is not authorized. */
export async function requireApiKey(request: Request): Promise<Response | null> {
  const result = await authorizeApi(request);
  return "denied" in result ? result.denied : null;
}


export function serviceClient() {
  return createClient<Database>(
    process.env['SUPABASE_URL']!,
    process.env['SUPABASE_SERVICE_ROLE_KEY']!,
    { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
  );
}

export function page(request: Request, defaultLimit = 200, maxLimit = 1000) {
  const url = new URL(request.url);
  const limit = Math.min(maxLimit, Math.max(1, Number(url.searchParams.get("limit") ?? defaultLimit)));
  const offset = Math.max(0, Number(url.searchParams.get("offset") ?? 0));
  return { url, limit, offset, from: offset, to: offset + limit - 1 };
}
