import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertTriangle } from "lucide-react";
import { useRows } from "@/lib/execution-db";
import { PageHead, Field, fmt, th } from "@/components/qp-ui";
import { DECISION } from "./nonconformance.index";

export const Route = createFileRoute("/_authenticated/nonconformance/$ncId")({
  head: () => ({ meta: [
    { title: "Nonconformance detail · Cortanex MES" },
    { name: "description", content: "One nonconformance: source, QA portal messages and decision." },
    { property: "og:title", content: "Nonconformance detail · Cortanex MES" },
    { property: "og:description", content: "Nonconformance and QA decision." },
  ] }),
  component: NcDetail,
});

function NcDetail() {
  const { ncId } = Route.useParams();
  const { data: ncs = [] } = useRows<any>("nonconformances", { eq: { id: ncId } });
  const nc = ncs[0];
  const { data: ops = [] } = useRows<any>("order_operations", { eq: { id: nc?.operation_id }, enabled: !!nc?.operation_id });
  const { data: res = [] } = useRows<any>("inspection_results", { eq: { id: nc?.inspection_result_id }, enabled: !!nc?.inspection_result_id });
  const { data: msgs = [] } = useRows<any>("portal_events", { eq: { ref_id: ncId }, order: "created_at", asc: true });
  if (!nc) return <div className="text-sm text-muted-foreground">Loading… <Link to="/nonconformance" className="text-primary">Back</Link></div>;
  const r = res[0];
  return (
    <div className="space-y-6">
      <PageHead back="/nonconformance" backLabel="Nonconformance" icon={<AlertTriangle className="h-5 w-5 text-primary" />} title={nc.id} desc={nc.description} />
      <div className="grid gap-2 sm:grid-cols-4">
        <Field l="Status" v={nc.status === "open" ? "Waiting for QA decision" : nc.status} />
        <Field l="Severity" v={nc.severity} />
        <Field l="Quantity" v={`${Number(nc.qty)} ${nc.uom ?? ""}`} />
        <Field l="Order" v={<Link to="/production-orders/$poId" params={{ poId: nc.production_order_id }} className="font-mono text-primary">{nc.production_order_id}</Link>} />
        <Field l="Step" v={ops[0] ? `${ops[0].sequence} · ${ops[0].name}` : "—"} />
        <Field l="Batch" v={nc.batch_id} />
        <Field l="Raised" v={`${fmt(nc.created_at)} · ${nc.raised_by_name ?? ""}`} />
        <Field l="Source" v={r ? `Failed inspection, sample ${r.sample_no}` : "Raised by hand"} />
        <Field l="QA decision" v={nc.decision ? DECISION[nc.decision] : "—"} />
        <Field l="Decided" v={nc.decided_at ? `${fmt(nc.decided_at)} · ${nc.decided_by_name}` : "—"} />
        <Field l="Decision notes" v={nc.decision_notes} />
        <Field l="Rework task" v={nc.rework_task_id ? <Link to="/rework" className="text-primary">Open rework tasks</Link> : "—"} />
      </div>
      {r && <div className="glass-panel rounded-2xl p-5 text-xs"><h2 className="mb-2 text-sm font-semibold">Inspection that failed</h2>
        {Object.entries(r.values ?? {}).map(([k, v]) => `${k} = ${v}`).join(" · ") || "No values"}<div className="text-destructive">{(r.failed_checks ?? []).join("; ")}</div></div>}
      <div className="glass-panel rounded-2xl p-5">
        <h2 className="mb-2 text-sm font-semibold">QA portal messages</h2>
        <table className="w-full text-xs"><thead className="text-[10px] uppercase text-muted-foreground"><tr><th className={th}>When</th><th className="text-left">Direction</th><th className="text-left">Message</th><th className="text-left">Status</th><th className="text-left">Note</th></tr></thead>
          <tbody>{msgs.map((m) => (
            <tr key={m.id} className="border-t border-border/40"><td className="py-2">{fmt(m.created_at)}</td><td>{m.direction === "out" ? "Sent to QA" : "From QA"}</td><td>{m.event_type}</td><td>{m.status}</td><td>{m.last_error ?? ""}</td></tr>))}
            {msgs.length === 0 && <tr><td colSpan={5} className="py-4 text-center text-muted-foreground">No messages yet.</td></tr>}
          </tbody></table>
        <Link to="/integrations" className="mt-2 inline-block text-xs text-primary">Open Maintenance & QA portals</Link>
      </div>
    </div>
  );
}
