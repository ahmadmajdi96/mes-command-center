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
    if (conn.portal === "qa" && msg.event_type === "inspection_result" && d["operation_id"]) {
      const opId = String(d["operation_id"]), planId = String(d["plan_id"] ?? "");
      const result = String(d["result"] ?? "");
      if (!["pass", "fail"].includes(result)) return log("rejected", "result must be pass or fail", "order_operations", opId);
      const { data: op } = await admin.from("order_operations").select("id, organization_id, production_order_id, batch_id, status").eq("id", opId).maybeSingle();
      if (!op || op.organization_id !== conn.organization_id) return log("rejected", "Operation not found", "order_operations", opId);
      const { data: plan } = await admin.from("inspection_plans").select("id, organization_id, performed_by").eq("id", planId).maybeSingle();
      if (!plan || plan.organization_id !== conn.organization_id || plan.performed_by !== "qa_portal") return log("rejected", "Inspection plan not found or not done by the QA portal", "order_operations", opId);
      const { count } = await admin.from("inspection_results").select("id", { count: "exact", head: true }).eq("operation_id", opId).eq("plan_id", planId);
      const failed = Array.isArray(d["failed_checks"]) ? (d["failed_checks"] as unknown[]).map(String) : result === "fail" ? ["QA portal: failed"] : [];
      const { error } = await admin.from("inspection_results").insert({
        organization_id: op.organization_id, plan_id: planId, operation_id: opId, production_order_id: op.production_order_id, batch_id: op.batch_id,
        sample_no: (count ?? 0) + 1, values: (d["values"] as object) ?? {}, failed_checks: failed, result, source: "qa_portal",
        notes: d["notes"] ? String(d["notes"]) : null, inspector_name: who,
      });
      if (error) return log("rejected", error.message, "order_operations", opId);
      return log("applied", `Inspection ${result} recorded for the step`, "order_operations", opId);
    }
    if (conn.portal === "qa" && msg.event_type === "inspection_result") {
      const id = String(d["rework_task_id"] ?? "");
      const result = String(d["result"] ?? "");
      if (!["pass", "fail"].includes(result)) return log("rejected", "result must be pass or fail", "rework_tasks", id);
      const { data: t } = await admin.from("rework_tasks").select("id, organization_id, status").eq("id", id).maybeSingle();
      if (!t || t.organization_id !== conn.organization_id) return log("rejected", "Rework task not found", "rework_tasks", id);
      if (t.status !== "awaiting_inspection") return log("rejected", `Rework task is ${t.status.replace("_", " ")}, not awaiting re-inspection`, "rework_tasks", id);
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
      const ref = String(d["reference"] ?? d["nonconformance_id"] ?? "");
      const decision = String(d["decision"] ?? "");
      if (!["use_as_is", "rework", "scrap", "return_to_supplier"].includes(decision)) return log("rejected", "decision must be use_as_is, rework, scrap or return_to_supplier", "nonconformances", ref);
      const { data: nc } = await admin.from("nonconformances").select("*").eq("id", ref).maybeSingle();
      if (!nc) {
        // Older quality issues (exceptions) have no NC record — acknowledge only.
        const { data: ex } = await admin.from("production_exceptions").select("id, organization_id").eq("id", ref).maybeSingle();
        if (ex && ex.organization_id === conn.organization_id) return log("applied", `Decision recorded: ${decision}`, "production_exceptions", ref);
        return log("rejected", "Nonconformance not found", "nonconformances", ref);
      }
      if (nc.organization_id !== conn.organization_id) return log("rejected", "Nonconformance not found", "nonconformances", ref);
      if (nc.status !== "open") return log("rejected", `Nonconformance already ${nc.status} (${nc.decision})`, "nonconformances", ref);
      let reworkId: string | null = null;
      if (decision === "rework") {
        let qty = Number(nc.qty) || 0;
        if (qty <= 0 && nc.operation_id) {
          const { data: op } = await admin.from("order_operations").select("qty_input").eq("id", nc.operation_id).maybeSingle();
          qty = Number(op?.qty_input) || 0;
        }
        if (qty <= 0) return log("rejected", "Rework needs a quantity; the nonconformance has none", "nonconformances", ref);
        const { data: t, error: te } = await admin.from("rework_tasks").insert({
          organization_id: nc.organization_id, production_order_id: nc.production_order_id, operation_id: nc.operation_id, batch_id: nc.batch_id,
          qty, uom: nc.uom, reason: `QA decision on ${nc.id}: ${nc.description}`, created_by_name: who,
        }).select("id").single();
        if (te) return log("rejected", te.message, "nonconformances", ref);
        reworkId = t.id;
      }
      const { error } = await admin.from("nonconformances").update({
        status: decision === "use_as_is" ? "closed" : "decided", decision, decision_notes: d["notes"] ? String(d["notes"]) : null,
        decided_by_name: who, decided_at: new Date().toISOString(), decision_source: "qa_portal", rework_task_id: reworkId,
      }).eq("id", ref);
      if (error) return log("rejected", error.message, "nonconformances", ref);
      return log("applied", `Decision "${decision.replace(/_/g, " ")}" applied${reworkId ? " — rework task created" : ""}`, "nonconformances", ref);
    }
    return log("rejected", `Unknown event "${msg.event_type}" for the ${conn.portal} portal`);
  } catch (e) {
    return log("rejected", e instanceof Error ? e.message : String(e));
  }
}
