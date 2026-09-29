import { createFileRoute } from "@tanstack/react-router";

/**
 * Stand-in for an external Maintenance / QA portal, used while the real portals are in development.
 * It behaves like a real receiver: checks the x-mes-signature (HMAC-SHA256 of the raw body with the
 * connection's shared secret), stores what it received in its inbox and answers 202.
 * Point a connection's "Portal address" at this URL; later swap it for the real portal URL — nothing else changes.
 */
export const Route = createFileRoute("/api/public/mock-portal/$connectionId")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        if (!/^[0-9a-f-]{36}$/i.test(params.connectionId)) return new Response("Not found", { status: 404 });
        const raw = await request.text();
        if (raw.length > 200_000) return new Response("Too large", { status: 413 });
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { verify } = await import("@/lib/mes/portals.server");
        const admin = supabaseAdmin as any;
        const { data: conn } = await admin.from("portal_connections").select("id, organization_id, portal, shared_secret").eq("id", params.connectionId).maybeSingle();
        if (!conn) return new Response("Not found", { status: 404 });
        const ok = verify(conn.shared_secret, raw, request.headers.get("x-mes-signature") ?? "");
        if (!ok) return new Response("Invalid signature", { status: 401 });
        let msg: any;
        try { msg = JSON.parse(raw); } catch { return new Response("Invalid JSON", { status: 400 }); }
        if (typeof msg?.event_type !== "string") return new Response("event_type missing", { status: 400 });
        const { error } = await admin.from("mock_portal_inbox").insert({
          organization_id: conn.organization_id, connection_id: conn.id, portal: conn.portal,
          event_id: typeof msg.id === "string" && /^[0-9a-f-]{36}$/i.test(msg.id) ? msg.id : null,
          event_type: msg.event_type.slice(0, 80), payload: msg.data ?? {}, signature_ok: true,
        });
        if (error) return new Response(error.message, { status: 500 });
        return Response.json({ received: true, ticket: `${conn.portal.toUpperCase()}-${Date.now().toString(36).toUpperCase()}` }, { status: 202 });
      },
    },
  },
});
