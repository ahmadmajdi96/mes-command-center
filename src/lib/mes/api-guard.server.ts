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

/** Returns a Response when the caller is not authorized, otherwise null. */
export function requireApiKey(request: Request): Response | null {
  const expected = process.env['MES_API_KEY'];
  const headers = corsHeaders(request);
  if (!expected) {
    return Response.json(
      { error: "Integration API is not configured" },
      { status: 503, headers },
    );
  }
  const auth = request.headers.get("authorization") ?? "";
  const presented = auth.toLowerCase().startsWith("bearer ")
    ? auth.slice(7).trim()
    : (request.headers.get("x-api-key") ?? "").trim();
  if (!presented || presented.length !== expected.length) {
    return Response.json({ error: "Unauthorized" }, { status: 401, headers });
  }
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= presented.charCodeAt(i) ^ expected.charCodeAt(i);
  if (diff !== 0) return Response.json({ error: "Unauthorized" }, { status: 401, headers });
  return null;
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
