import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { FileCheck2, Printer, Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useRows } from "@/lib/execution-db";
import { inp, ghost } from "@/components/qp-ui";

export const Route = createFileRoute("/_authenticated/reports")({
  head: () => ({
    meta: [
      { title: "Reports & Compliance · Cortanex MES" },
      { name: "description", content: "Batch records, signed order and lot reports and audit exports — printable and downloadable." },
      { property: "og:title", content: "Reports & Compliance · Cortanex MES" },
      { property: "og:description", content: "Printable batch records, signed reports and audit exports." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ReportsPage,
});

type Row = Record<string, unknown>;
const cell = (v: unknown) => (v == null ? "" : typeof v === "object" ? JSON.stringify(v) : /^\d{4}-\d{2}-\d{2}T/.test(String(v)) ? new Date(String(v)).toLocaleString() : String(v));
const label = (k: string) => k.replace(/_/g, " ");

function download(name: string, text: string, type: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name; a.click(); URL.revokeObjectURL(a.href);
}
function toCsv(rows: Row[], cols?: string[]) {
  const c = cols ?? Array.from(new Set(rows.flatMap((r) => Object.keys(r))));
  const esc = (v: unknown) => `"${String(v == null ? "" : typeof v === "object" ? JSON.stringify(v) : v).replace(/"/g, '""')}"`;
  return [c.join(","), ...rows.map((r) => c.map((k) => esc(r[k])).join(","))].join("\n");
}

async function sel(table: string, col: string, val: string, order = "created_at") {
  const { data, error } = await supabase.from(table as never).select("*").eq(col, val).order(order, { ascending: true }).limit(2000);
  if (error) throw error;
  return (data ?? []) as Row[];
}

type Section = { title: string; rows: Row[]; cols: string[] };

function ReportsPage() {
  const [tab, setTab] = useState<"batch" | "lot" | "audit">("batch");
  const t = (k: typeof tab, l: string) => <button className={`h-8 rounded-lg px-3 text-xs ${tab === k ? "bg-primary text-primary-foreground" : "border border-border/60"}`} onClick={() => setTab(k)}>{l}</button>;
  return (
    <div className="space-y-5">
      <div className="print:hidden">
        <h1 className="flex items-center gap-2 font-display text-2xl font-semibold"><FileCheck2 className="h-5 w-5 text-primary" />Reports &amp; Compliance</h1>
        <p className="text-sm text-muted-foreground">Built from recorded order, lot and step data. Print, save as PDF, or download.</p>
        <div className="mt-3 flex gap-2">{t("batch", "Batch record")}{t("lot", "Lot report")}{t("audit", "Audit export")}</div>
      </div>
      {tab === "batch" && <BatchRecord />}
      {tab === "lot" && <LotReport />}
      {tab === "audit" && <AuditExport />}
    </div>
  );
}

function Report({ title, subtitle, header, sections, fileBase }: { title: string; subtitle: string; header: Row; sections: Section[]; fileBase: string }) {
  const sigs = sections.find((s) => s.title === "Electronic signatures")?.rows ?? [];
  return (
    <div className="space-y-4">
      <div className="flex gap-2 print:hidden">
        <button className={ghost} onClick={() => window.print()}><Printer className="h-3.5 w-3.5" />Print / PDF</button>
        <button className={ghost} onClick={() => download(`${fileBase}.json`, JSON.stringify({ header, sections: Object.fromEntries(sections.map((s) => [s.title, s.rows])), generated_at: new Date().toISOString() }, null, 2), "application/json")}><Download className="h-3.5 w-3.5" />Download JSON</button>
        <button className={ghost} onClick={() => download(`${fileBase}.csv`, sections.map((s) => `# ${s.title}\n${toCsv(s.rows, s.cols)}`).join("\n\n"), "text/csv")}><Download className="h-3.5 w-3.5" />Download CSV</button>
      </div>
      <div className="glass-panel space-y-4 rounded-2xl p-6 print:border-0 print:bg-transparent print:shadow-none" data-testid="report">
        <div className="border-b border-border/40 pb-3">
          <h2 className="text-xl font-semibold">{title}</h2>
          <p className="text-xs text-muted-foreground">{subtitle} · Generated {new Date().toLocaleString()}</p>
          <p className={`mt-1 text-xs ${sigs.length ? "text-success" : "text-warning"}`}>{sigs.length ? `Signed electronically ${sigs.length} time(s)` : "No electronic signatures on this record"}</p>
        </div>
        <div className="grid gap-2 text-xs sm:grid-cols-3">{Object.entries(header).map(([k, v]) => <div key={k}><span className="uppercase text-muted-foreground">{label(k)}: </span>{cell(v) || "—"}</div>)}</div>
        {sections.map((s) => (
          <div key={s.title} className="break-inside-avoid">
            <h3 className="mb-1 text-sm font-semibold">{s.title} ({s.rows.length})</h3>
            {s.rows.length === 0 ? <p className="text-xs text-muted-foreground">None recorded.</p> : (
              <div className="overflow-x-auto"><table className="w-full text-[11px]">
                <thead className="text-[10px] uppercase text-muted-foreground"><tr>{s.cols.map((c) => <th key={c} className="py-1 pr-2 text-left">{label(c)}</th>)}</tr></thead>
                <tbody>{s.rows.map((r, i) => <tr key={i} className="border-t border-border/40">{s.cols.map((c) => <td key={c} className="py-1 pr-2">{cell(r[c])}</td>)}</tr>)}</tbody>
              </table></div>)}
          </div>
        ))}
        <div className="grid gap-6 pt-6 text-xs sm:grid-cols-2">
          <div className="border-t border-border pt-1">Reviewed by (name, date)</div>
          <div className="border-t border-border pt-1">Approved for release (name, date)</div>
        </div>
      </div>
    </div>
  );
}

function BatchRecord() {
  const { data: orders = [] } = useRows<any>("production_orders");
  const [id, setId] = useState("");
  const q = useQuery({
    queryKey: ["batch-record", id], enabled: !!id,
    queryFn: async () => {
      const [ops, batches, cons, rec, waste, events, holds] = await Promise.all([
        sel("order_operations", "production_order_id", id, "sequence"), sel("production_batches", "production_order_id", id, "sequence"),
        sel("material_consumptions", "production_order_id", id), sel("goods_receipts", "production_order_id", id),
        sel("waste_events", "production_order_id", id), sel("operation_events", "production_order_id", id), sel("order_holds", "production_order_id", id),
      ]);
      const refs = [id, ...ops.map((o) => String(o.id))];
      const { data: sigs } = await supabase.from("e_signatures" as never).select("*").in("ref_id", refs).order("signed_at");
      const { data: aud } = await supabase.from("audit_entries" as never).select("*").in("entity_id", refs).order("at");
      const s: Section[] = [
        { title: "Steps", rows: ops, cols: ["sequence", "name", "status", "started_at", "completed_at", "qty_input", "qty_yield", "qty_rejected", "qty_scrap", "actual_duration_min", "approved_by_name"] },
        { title: "Batches", rows: batches, cols: ["id", "lot_number", "qty", "qty_good", "qty_rework", "qty_scrap", "status"] },
        { title: "Materials consumed", rows: cons, cols: ["created_at", "component_sku", "component_name", "planned_qty", "qty", "uom", "input_lot", "actor_name"] },
        { title: "Output received", rows: rec, cols: ["created_at", "receipt_type", "sku", "qty", "uom", "lot_number", "storage_location"] },
        { title: "Waste", rows: waste, cols: ["created_at", "station_name", "reason_label", "notes", "operator_name"] },
        { title: "Holds", rows: holds, cols: ["created_at", "status", "reason"] },
        { title: "Step events", rows: events, cols: ["created_at", "event_type", "reason", "actor_name"] },
        { title: "Electronic signatures", rows: (sigs ?? []) as Row[], cols: ["signed_at", "signer_name", "signer_email", "meaning", "reason"] },
        { title: "Change history", rows: (aud ?? []) as Row[], cols: ["at", "actor_name", "action", "summary", "reason"] },
      ];
      return s;
    },
  });
  const o = orders.find((x) => x.id === id);
  return (
    <div className="space-y-4">
      <select aria-label="Order" className={`${inp} max-w-md print:hidden`} value={id} onChange={(e) => setId(e.target.value)}>
        <option value="">Choose an order…</option>{orders.map((x) => <option key={x.id} value={x.id}>{x.id} · {x.product_name} · {x.status}</option>)}
      </select>
      {q.isLoading && <p className="text-sm text-muted-foreground">Building the record…</p>}
      {q.error && <p className="text-sm text-destructive">{String((q.error as Error).message)}</p>}
      {o && q.data && <Report title={`Batch record · ${o.id}`} subtitle={`${o.product_name} (${o.sku})`} fileBase={`batch-record-${o.id}`}
        header={{ order: o.id, product: o.product_name, lot: o.lot_number, line: o.line_id, planned_qty: `${o.qty} ${o.uom}`, good: o.qty_good, scrap: o.qty_scrap, rework: o.qty_rework, status: o.status, version: o.production_version_id, planned_start: o.planned_start, planned_end: o.planned_end }}
        sections={q.data} />}
    </div>
  );
}

function LotReport() {
  const [lot, setLot] = useState("");
  const { data: lots = [] } = useRows<any>("material_lots");
  const q = useQuery({
    queryKey: ["lot-report", lot], enabled: !!lot,
    queryFn: async () => {
      const l = lots.find((x) => x.lot_number === lot || x.id === lot);
      const [cons, rec, units, gen] = await Promise.all([
        sel("material_consumptions", "input_lot", lot), sel("goods_receipts", "lot_number", lot), sel("product_units", "lot_number", lot),
        l ? supabase.from("genealogy_records" as never).select("*").or(`input_lot_id.eq.${l.id},output_lot_id.eq.${l.id}`).then((r) => (r.data ?? []) as Row[]) : Promise.resolve([] as Row[]),
      ]);
      const { data: sigs } = await supabase.from("e_signatures" as never).select("*").in("ref_id", [lot, l?.id ?? lot]);
      return { l, s: [
        { title: "Where it was used", rows: cons, cols: ["created_at", "production_order_id", "component_sku", "qty", "uom", "actor_name"] },
        { title: "Where it was produced", rows: rec, cols: ["created_at", "production_order_id", "sku", "qty", "uom", "receipt_type"] },
        { title: "Items in this lot", rows: units, cols: ["uid", "serial", "production_order_id", "status"] },
        { title: "Genealogy", rows: gen, cols: ["recorded_at", "input_lot_id", "output_lot_id", "material", "qty_consumed", "uom"] },
        { title: "Electronic signatures", rows: (sigs ?? []) as Row[], cols: ["signed_at", "signer_name", "meaning", "reason"] },
      ] as Section[] };
    },
  });
  return (
    <div className="space-y-4">
      <input list="lot-list" aria-label="Lot" className={`${inp} max-w-md print:hidden`} placeholder="Lot number…" value={lot} onChange={(e) => setLot(e.target.value.trim())} />
      <datalist id="lot-list">{lots.map((l) => <option key={l.id} value={l.lot_number ?? l.id} />)}</datalist>
      {q.data && <Report title={`Lot report · ${lot}`} subtitle={q.data.l ? `${q.data.l.name ?? q.data.l.sku ?? ""}` : "Lot"} fileBase={`lot-report-${lot}`}
        header={q.data.l ? Object.fromEntries(Object.entries(q.data.l).filter(([k]) => !["organization_id"].includes(k)).slice(0, 12)) : { lot }} sections={q.data.s} />}
    </div>
  );
}

function AuditExport() {
  const [from, setFrom] = useState(() => new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10));
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [entity, setEntity] = useState("");
  const q = useQuery({
    queryKey: ["audit-export", from, to, entity],
    queryFn: async () => {
      let r = supabase.from("audit_entries" as never).select("*").gte("at", from).lte("at", `${to}T23:59:59`).order("at", { ascending: false }).limit(5000);
      if (entity) r = r.eq("entity", entity);
      const { data, error } = await r; if (error) throw error;
      const { data: sigs } = await supabase.from("e_signatures" as never).select("*").gte("signed_at", from).lte("signed_at", `${to}T23:59:59`).order("signed_at");
      return { aud: (data ?? []) as Row[], sigs: (sigs ?? []) as Row[] };
    },
  });
  const cols = ["at", "actor_name", "entity", "entity_id", "action", "summary", "reason", "device_id", "correlation_id"];
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 text-[11px] text-muted-foreground print:hidden">
        <label>From<input type="date" className={inp} value={from} onChange={(e) => setFrom(e.target.value)} /></label>
        <label>To<input type="date" className={inp} value={to} onChange={(e) => setTo(e.target.value)} /></label>
        <label>Entity<input className={inp} placeholder="all" value={entity} onChange={(e) => setEntity(e.target.value.trim())} /></label>
      </div>
      {q.data && <Report title="Audit trail export" subtitle={`${from} → ${to}${entity ? ` · ${entity}` : ""}`} fileBase={`audit-${from}-${to}`}
        header={{ period: `${from} → ${to}`, entries: q.data.aud.length, signatures: q.data.sigs.length }}
        sections={[{ title: "Audit entries", rows: q.data.aud, cols }, { title: "Electronic signatures", rows: q.data.sigs, cols: ["signed_at", "signer_name", "signer_email", "meaning", "ref_table", "ref_id", "reason"] }]} />}
    </div>
  );
}
