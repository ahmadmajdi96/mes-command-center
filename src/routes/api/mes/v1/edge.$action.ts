import { createFileRoute } from "@tanstack/react-router";
import { authorizeApi, corsHeaders, serviceClient } from "@/lib/mes/api-guard.server";

/**
 * Edge box contract (key in x-api-key).
 * GET  /api/mes/v1/edge/machines                     — machines + tags/commands to poll
 * GET  /api/mes/v1/edge/commands?machine_id=…        — queued commands (marked "sent" when fetched)
 * POST /api/mes/v1/edge/readings  [{machine_id, tag, value|text_value}]
 * POST /api/mes/v1/edge/acks      [{id, status: acknowledged|rejected|failed, result}]
 */
export const Route = createFileRoute("/api/mes/v1/edge/$action")({
  server: {
    handlers: {
      OPTIONS: async ({ request }) => new Response(null, { status: 204, headers: corsHeaders(request) }),
      GET: async ({ request, params }) => {
        const auth = await authorizeApi(request);
        if ("denied" in auth) return auth.denied;
        const headers = corsHeaders(request);
        const db = serviceClient();
        const org = auth.caller.organizationId;
        if (params.action === "machines") {
          let q = db.from("machines" as never).select("*").eq("connection_mode", "edge");
          if (org) q = q.eq("organization_id", org);
          const { data, error } = await q;
          return error ? Response.json({ error: error.message }, { status: 500, headers }) : Response.json({ records: data }, { headers });
        }
        if (params.action === "commands") {
          const mid = new URL(request.url).searchParams.get("machine_id");
          let q = db.from("machine_commands" as never).select("*").eq("status", "queued").order("created_at");
          if (org) q = q.eq("organization_id", org);
          if (mid) q = q.eq("machine_id", mid);
          const { data, error } = await q;
          if (error) return Response.json({ error: error.message }, { status: 500, headers });
          const ids = ((data ?? []) as { id: string }[]).map((d) => d.id);
          if (ids.length) await db.from("machine_commands" as never).update({ status: "sent" } as never).in("id", ids);
          return Response.json({ records: data }, { headers });
        }
        return Response.json({ error: "Unknown action" }, { status: 404, headers });
      },
      POST: async ({ request, params }) => {
        const auth = await authorizeApi(request);
        if ("denied" in auth) return auth.denied;
        const headers = corsHeaders(request);
        const db = serviceClient();
        const org = auth.caller.organizationId;
        let body: any;
        try { body = await request.json(); } catch { return Response.json({ error: "Body must be JSON" }, { status: 400, headers }); }
        const recs: any[] = Array.isArray(body) ? body : body?.records ?? [];
        if (!recs.length || recs.length > 1000) return Response.json({ error: "Send 1–1000 records" }, { status: 400, headers });
        const mids = [...new Set(recs.map((r) => String(r.machine_id ?? "")))];
        if (params.action === "readings") {
          let q = db.from("machines" as never).select("id, organization_id").in("id", mids);
          if (org) q = q.eq("organization_id", org);
          const { data: ms } = await q;
          const ok = new Map(((ms ?? []) as { id: string; organization_id: string }[]).map((m) => [m.id, m.organization_id]));
          const rows = recs.filter((r) => ok.has(String(r.machine_id))).map((r) => ({
            machine_id: String(r.machine_id), organization_id: ok.get(String(r.machine_id)), tag: String(r.tag),
            value: typeof r.value === "number" ? r.value : null, text_value: r.text_value ?? null, source: "edge", actor_name: "Edge box",
          }));
          if (rows.length) { const { error } = await db.from("machine_readings" as never).insert(rows as never); if (error) return Response.json({ error: error.message }, { status: 422, headers }); }
          return Response.json({ accepted: rows.length, rejected: recs.length - rows.length }, { headers });
        }
        if (params.action === "acks") {
          let n = 0;
          for (const r of recs) {
            if (!["acknowledged", "rejected", "failed"].includes(r.status)) continue;
            let q = db.from("machine_commands" as never).update({ status: r.status, result: r.result ?? null, completed_at: new Date().toISOString() } as never).eq("id", r.id);
            if (org) q = q.eq("organization_id", org);
            const { error } = await q; if (!error) n++;
          }
          return Response.json({ updated: n }, { headers });
        }
        return Response.json({ error: "Unknown action" }, { status: 404, headers });
      },
    },
  },
});
