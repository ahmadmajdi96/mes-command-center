import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { useRows } from "@/lib/execution-db";
import { useListControls } from "@/components/list-controls";
import { PageHead, th, fmt } from "@/components/qp-ui";

export const Route = createFileRoute("/_authenticated/nonconformance/")({
  head: () => ({ meta: [
    { title: "Nonconformance · Cortanex MES" },
    { name: "description", content: "Nonconformances raised at the line, sent to the QA portal, with the decision that came back." },
    { property: "og:title", content: "Nonconformance · Cortanex MES" },
    { property: "og:description", content: "Nonconformance records and QA decisions." },
  ] }),
  component: NcPage,
});

export const DECISION: Record<string, string> = { use_as_is: "Use as is", rework: "Rework", scrap: "Scrap", return_to_supplier: "Return to supplier" };

function NcPage() {
  const nav = useNavigate();
  const { data: ncs = [] } = useRows<any>("nonconformances");
  const [status, setStatus] = useState("");
  const rows = useMemo(() => ncs.filter((n) => !status || n.status === status).map((n) => ({ ...n, decision_label: n.decision ? DECISION[n.decision] : "" })), [ncs, status]);
  const lc = useListControls(rows, { searchKeys: ["id", "production_order_id", "description", "severity", "decision_label", "raised_by_name", "decided_by_name"], dateKey: "created_at", exportName: "nonconformances" });
  return (
    <div className="space-y-6">
      <PageHead back="/quality" backLabel="Quality" icon={<AlertTriangle className="h-5 w-5 text-primary" />} title="Nonconformance"
        desc="Raised here (by hand or from a failed inspection) and sent to the QA portal. The QA decision — use as is, rework or scrap — comes back automatically. A step cannot complete while its nonconformance waits for a decision." />
      <div className="grid gap-3 sm:grid-cols-3">{[["open", "Waiting for QA"], ["decided", "Decided"], ["closed", "Closed"]].map(([s, l]) => (
        <button key={s} onClick={() => setStatus(status === s ? "" : s)} className={`glass-panel rounded-xl p-4 text-left ${status === s ? "ring-1 ring-primary" : ""}`}><div className="text-[10px] uppercase text-muted-foreground">{l}</div><div className="mt-1 font-mono text-xl">{ncs.filter((n) => n.status === s).length}</div></button>
      ))}</div>
      <div className="glass-panel rounded-2xl p-5">
        {lc.toolbar}
        <div className="mt-3 overflow-x-auto"><table className="w-full text-xs">
          <thead className="text-[10px] uppercase text-muted-foreground"><tr><th className={th}>NC</th><th className="text-left">Raised</th><th className="text-left">Order</th><th className="text-left">Description</th><th className="text-left">Severity</th><th className="text-right">Qty</th><th className="text-left">Status</th><th className="text-left">QA decision</th></tr></thead>
          <tbody>{lc.visible.map((n) => (
            <tr key={n.id} className="cursor-pointer border-t border-border/40 align-top hover:bg-muted/30" onClick={() => nav({ to: "/nonconformance/$ncId", params: { ncId: n.id } })}>
              <td className="py-2 font-mono text-primary">{n.id}</td><td>{fmt(n.created_at)}</td>
              <td onClick={(e) => e.stopPropagation()}><Link to="/production-orders/$poId" params={{ poId: n.production_order_id }} className="font-mono text-primary">{n.production_order_id}</Link></td>
              <td>{n.description}</td><td className={n.severity === "critical" ? "text-destructive" : n.severity === "major" ? "text-warning" : ""}>{n.severity}</td>
              <td className="text-right font-mono">{Number(n.qty)} {n.uom}</td><td>{n.status === "open" ? "Waiting for QA" : n.status}</td><td>{n.decision_label || "—"}{n.decided_by_name ? ` · ${n.decided_by_name}` : ""}</td>
            </tr>))}
            {lc.visible.length === 0 && <tr><td colSpan={8} className="py-6 text-center text-muted-foreground">No nonconformances match.</td></tr>}
          </tbody></table></div>
        <div className="mt-3">{lc.pager}</div>
      </div>
    </div>
  );
}
