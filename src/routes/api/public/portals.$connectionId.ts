import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const Body = z.object({ event_type: z.string().min(1).max(80), data: z.record(z.string(), z.unknown()).default({}) });

/** Signed inbound endpoint for the external Maintenance and QA portals. Header x-mes-signature = HMAC-SHA256(body, shared secret). */
export const Route = createFileRoute("/api/public/portals/$connectionId")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        if (!/^[0-9a-f-]{36}$/i.test(params.connectionId)) return new Response("Not found", { status: 404 });
        const raw = await request.text();
        if (raw.length > 100_000) return new Response("Too large", { status: 413 });
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { verify, applyInbound } = await import("@/lib/mes/portals.server");
        const { data: conn } = await (supabaseAdmin as any).from("portal_connections").select("id, organization_id, portal, shared_secret, active").eq("id", params.connectionId).maybeSingle();
        if (!conn || !conn.active) return new Response("Not found", { status: 404 });
        if (!verify(conn.shared_secret, raw, request.headers.get("x-mes-signature") ?? "")) return new Response("Invalid signature", { status: 401 });
        let parsed;
        try { parsed = Body.parse(JSON.parse(raw)); } catch { return Response.json({ ok: false, error: "Invalid body" }, { status: 400 }); }
        const r = await applyInbound(supabaseAdmin, conn, parsed as never);
        return Response.json(r, { status: r.ok ? 200 : 422 });
      },
    },
  },
});
