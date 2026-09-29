import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(ctx: { supabase: any; userId: string }) {
  const [a, b] = await Promise.all([
    ctx.supabase.rpc("has_action", { _user_id: ctx.userId, _action: "users.admin" }),
    ctx.supabase.rpc("has_action", { _user_id: ctx.userId, _action: "platform.admin" }),
  ]);
  if (!a.data && !b.data) throw new Error("Only administrators can manage portal connections");
}

/** Sends queued events to the Maintenance / QA portals (signed with each connection's shared secret). */
export const dispatchPortalEvents = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    // Companies this person may see: from their grants, plus any whose portal connections they can read (platform admins).
    const [{ data: orgs }, { data: visible }] = await Promise.all([
      context.supabase.rpc("user_orgs", { _user_id: context.userId }),
      context.supabase.from("portal_connections").select("organization_id"),
    ]);
    const orgIds = Array.from(new Set([...((orgs ?? []) as { organization_id: string }[]).map((o) => o.organization_id), ...((visible ?? []) as { organization_id: string }[]).map((o) => o.organization_id)]));
    if (!orgIds.length) return { sent: 0, failed: 0, total: 0 };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { sign } = await import("./portals.server");
    const admin = supabaseAdmin as any;
    const { data: conns } = await admin.from("portal_connections").select("*").in("organization_id", orgIds).eq("active", true);
    const { data: events } = await admin.from("portal_events").select("*").eq("direction", "out").in("status", ["pending", "failed"])
      .in("organization_id", orgIds).lt("attempts", 10).order("created_at").limit(100);
    let sent = 0, failed = 0;
    for (const ev of events ?? []) {
      const conn = (conns ?? []).find((c: any) => c.organization_id === ev.organization_id && c.portal === ev.portal && c.outbound_url);
      if (!conn) {
        await admin.from("portal_events").update({ status: "failed", attempts: ev.attempts + 1, last_error: `No active ${ev.portal} portal connection with a URL` }).eq("id", ev.id);
        failed++; continue;
      }
      const body = JSON.stringify({ id: ev.id, event_type: ev.event_type, portal: ev.portal, organization_id: ev.organization_id, created_at: ev.created_at, data: ev.payload });
      try {
        const res = await fetch(conn.outbound_url, {
          method: "POST",
          headers: { "content-type": "application/json", "x-mes-signature": sign(conn.shared_secret, body), "x-mes-event": ev.event_type, "x-mes-connection": conn.id, "idempotency-key": ev.id },
          body, signal: AbortSignal.timeout(10_000),
        });
        if (!res.ok) throw new Error(`Portal answered ${res.status}`);
        await admin.from("portal_events").update({ status: "sent", attempts: ev.attempts + 1, last_error: null, connection_id: conn.id, processed_at: new Date().toISOString() }).eq("id", ev.id);
        await admin.from("portal_connections").update({ last_sent_at: new Date().toISOString() }).eq("id", conn.id);
        sent++;
      } catch (e) {
        await admin.from("portal_events").update({ status: "failed", attempts: ev.attempts + 1, last_error: e instanceof Error ? e.message : String(e), connection_id: conn.id }).eq("id", ev.id);
        failed++;
      }
    }
    return { sent, failed, total: (events ?? []).length };
  });

/** Lets an admin try a portal reply from inside the app (same handling as a real signed request). */
export const simulatePortalReply = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ connectionId: z.string().uuid(), event_type: z.string().min(1).max(80), data: z.record(z.string(), z.unknown()) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { data: conn } = await context.supabase.from("portal_connections").select("id, organization_id, portal").eq("id", data.connectionId).maybeSingle();
    if (!conn) throw new Error("Connection not found");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { applyInbound } = await import("./portals.server");
    return applyInbound(supabaseAdmin, conn as never, { event_type: data.event_type, data: data.data });
  });

/** Points a connection at the built-in mock portal (for use until the real portal is live). */
export const useMockPortal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ connectionId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { getRequest } = await import("@tanstack/react-start/server");
    const origin = new URL(getRequest().url).origin;
    const url = `${origin}/api/public/mock-portal/${data.connectionId}`;
    const { error } = await context.supabase.from("portal_connections").update({ outbound_url: url }).eq("id", data.connectionId);
    if (error) throw new Error(error.message);
    return { url };
  });

/**
 * The mock portal answers a message it received: builds the reply a real portal would send,
 * signs it with the shared secret and POSTs it over HTTP to this system's public portal endpoint.
 */
export const mockPortalRespond = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ inboxId: z.string().uuid(), event_type: z.string().min(1).max(80), data: z.record(z.string(), z.unknown()) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { data: item } = await context.supabase.from("mock_portal_inbox").select("id, connection_id, status").eq("id", data.inboxId).maybeSingle();
    if (!item) throw new Error("Message not found");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { sign } = await import("./portals.server");
    const admin = supabaseAdmin as any;
    const { data: conn } = await admin.from("portal_connections").select("id, shared_secret").eq("id", item.connection_id).maybeSingle();
    if (!conn) throw new Error("Connection not found");
    const { getRequest } = await import("@tanstack/react-start/server");
    const origin = new URL(getRequest().url).origin;
    const body = JSON.stringify({ event_type: data.event_type, data: data.data });
    const res = await fetch(`${origin}/api/public/portals/${conn.id}`, {
      method: "POST", headers: { "content-type": "application/json", "x-mes-signature": sign(conn.shared_secret, body) }, body, signal: AbortSignal.timeout(15_000),
    });
    const txt = await res.text();
    let out: { ok: boolean; outcome: string };
    try { out = JSON.parse(txt); } catch { out = { ok: false, outcome: `${res.status}: ${txt.slice(0, 200)}` }; }
    await admin.from("mock_portal_inbox").update({ status: out.ok ? "replied" : "reply_rejected", reply_event: data.event_type, reply_outcome: out.outcome, replied_at: new Date().toISOString() }).eq("id", item.id);
    return { ok: !!out.ok, outcome: out.outcome, http: res.status };
  });
