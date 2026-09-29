import { createHmac, timingSafeEqual } from "crypto";

export function sign(secret: string, body: string) {
  return createHmac("sha256", secret).update(body).digest("hex");
}

export function verify(secret: string, body: string, signature: string) {
  const a = Buffer.from(sign(secret, body));
  const b = Buffer.from(signature || "");
  return a.length === b.length && timingSafeEqual(a, b);
}

type Conn = { id: string; organization_id: string; portal: "maintenance" | "qa" };
export type Inbound = { event_type: string; data: Record<string, unknown> };

/** Applies a message coming back from the Maintenance or QA portal. Returns a short outcome text. */
export async function applyInbound(admin: any, conn: Conn, msg: Inbound): Promise<{ ok: boolean; outcome: string }> {
  const d = msg.data ?? {};
  const who = String(d["by"] ?? (conn.portal === "qa" ? "QA portal" : "Maintenance portal"));
  const log = async (status: "applied" | "rejected", outcome: string, refTable?: string, refId?: string) => {
    await admin.from("portal_events").insert({
      organization_id: conn.organization_id, direction: "in", portal: conn.portal, event_type: msg.event_type,
      ref_table: refTable ?? null, ref_id: refId ?? null, payload: msg, status, last_error: status === "rejected" ? outcome : null,
      connection_id: conn.id, processed_at: new Date().toISOString(),
    });
    await admin.from("portal_connections").update({ last_received_at: new Date().toISOString() }).eq("id", conn.id);
    return { ok: status === "applied", outcome };
  };

  try {
    if (conn.portal === "qa" && msg.event_type === "inspection_result") {
      const id = String(d["rework_task_id"] ?? "");
      const result = String(d["result"] ?? "");
      if (!["pass", "fail"].includes(result)) return log("rejected", "result must be pass or fail", "rework_tasks", id);
      const { data: t } = await admin.from("rework_tasks").select("id, organization_id, status").eq("id", id).maybeSingle();
      if (!t || t.organization_id !== conn.organization_id) return log("rejected", "Rework task not found", "rework_tasks", id);
      const { error } = await admin.from("rework_tasks").update({
        status: result === "pass" ? "passed" : "failed", inspection_source: "qa_portal",
        inspection_notes: String(d["notes"] ?? (result === "pass" ? "Passed in QA portal" : "")), inspector_name: who,
      }).eq("id", id);
      if (error) return log("rejected", error.message, "rework_tasks", id);
      return log("applied", `Rework task marked ${result === "pass" ? "passed" : "failed"}`, "rework_tasks", id);
    }
    if (msg.event_type === "hold_released" || (conn.portal === "maintenance" && msg.event_type === "work_order_closed")) {
      const holdId = d["station_hold_id"] ? String(d["station_hold_id"]) : null;
      let q = admin.from("station_holds").select("id, organization_id, station_id, status, hold_type").eq("status", "open");
      q = holdId ? q.eq("id", holdId) : q.eq("station_id", String(d["station_id"] ?? ""));
      const { data: holds } = await q;
      const mine = (holds ?? []).filter((h: any) => h.organization_id === conn.organization_id &&
        (conn.portal === "qa" ? h.hold_type === "qc" : h.hold_type === "maintenance"));
      if (!mine.length) return log("rejected", "No matching open hold for this portal", "station_holds", holdId ?? undefined);
      const notes = String(d["notes"] ?? d["comments"] ?? `Closed by ${conn.portal} portal`);
      for (const h of mine) {
        await admin.from("station_holds").update({ status: "closed", closed_at: new Date().toISOString(), closed_by_name: who, resolution_notes: notes }).eq("id", h.id);
      }
      if (conn.portal === "maintenance" && d["machine_id"]) {
        await admin.from("machines").update({ status: "online" }).eq("id", String(d["machine_id"])).eq("organization_id", conn.organization_id);
      }
      return log("applied", `${mine.length} hold(s) released`, "station_holds", mine[0].id);
    }
    if (conn.portal === "qa" && msg.event_type === "nonconformance_decision") {
      return log("applied", `Decision recorded: ${String(d["decision"] ?? "unknown")}`, "nonconformance", String(d["reference"] ?? ""));
    }
    return log("rejected", `Unknown event "${msg.event_type}" for the ${conn.portal} portal`);
  } catch (e) {
    return log("rejected", e instanceof Error ? e.message : String(e));
  }
}
