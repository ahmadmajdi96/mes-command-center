import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Manual ERP import from the app (paste JSON or CSV). Same rules as the ERP API. */
export const importErpData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { entity: string; format: "json" | "csv"; text: string; organization_id?: string }) => {
    if (!d.entity || !d.text?.trim()) throw new Error("Choose a data type and paste some data");
    if (d.text.length > 2_000_000) throw new Error("Data too large (max 2 MB)");
    return d;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: ok } = await supabase.rpc("has_action", { _user_id: userId, _action: "masterdata.write" });
    const { data: admin } = await supabase.rpc("is_platform_admin", { _user_id: userId });
    if (!ok && !admin) throw new Error("You don't have permission to change master data");
    const { data: orgs } = await supabase.rpc("user_orgs", { _user_id: userId });
    const mine = ((orgs ?? []) as { organization_id: string }[]).map((o) => o.organization_id);
    const org = data.organization_id || mine[0] || "ORG-01";
    if (!admin && !mine.includes(org)) throw new Error("You can only import into your own company");
    const { ingestErp, parseCsv } = await import("./erp-ingest.server");
    let records: any[];
    if (data.format === "csv") records = parseCsv(data.text);
    else {
      let parsed: any;
      try { parsed = JSON.parse(data.text); } catch { throw new Error("That isn't valid JSON"); }
      records = Array.isArray(parsed) ? parsed : parsed?.records ?? [parsed];
    }
    if (!records.length) throw new Error("No records found");
    if (records.length > 500) throw new Error("Max 500 records per import");
    const results = await ingestErp(data.entity, records, org, "manual");
    return { results, failed: results.filter((r) => r.status === "error").length };
  });
