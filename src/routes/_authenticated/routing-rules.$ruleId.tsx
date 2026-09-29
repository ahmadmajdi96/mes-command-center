import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Waypoints } from "lucide-react";
import { useRows, useWrite, errMsg } from "@/lib/execution-db";
import { useCan } from "@/lib/access";
import { useListControls } from "@/components/list-controls";
import { PageHead, Field, ghost, th, fmt } from "@/components/qp-ui";
import { TRIGGER, ACTION, describe } from "./routing-rules.index";

export const Route = createFileRoute("/_authenticated/routing-rules/$ruleId")({
  head: () => ({ meta: [
    { title: "Routing rule · Cortanex MES" },
    { name: "description", content: "One routing rule and every time it changed an order's path." },
    { property: "og:title", content: "Routing rule · Cortanex MES" },
    { property: "og:description", content: "Routing rule detail." },
  ] }),
  component: RuleDetail,
});

function RuleDetail() {
  const { ruleId } = Route.useParams();
  const nav = useNavigate();
  const canEdit = useCan("masterdata.write");
  const { data: rules = [] } = useRows<any>("routing_rules", { eq: { id: ruleId } });
  const { data: hits = [] } = useRows<any>("routing_rule_hits", { eq: { rule_id: ruleId } });
  const { data: products = [] } = useRows<any>("products");
  const w = useWrite("routing_rules");
  const lc = useListControls(hits, { searchKeys: ["production_order_id", "action", "detail"], dateKey: "created_at", exportName: "routing-rule-hits" });
  const r = rules[0];
  if (!r) return <div className="text-sm text-muted-foreground">Loading… <Link to="/routing-rules" className="text-primary">Back</Link></div>;
  const product = products.find((p: any) => p.id === r.product_id)?.name;
  return (
    <div className="space-y-6">
      <PageHead back="/routing-rules" backLabel="Routing rules" icon={<Waypoints className="h-5 w-5 text-primary" />} title={r.name} desc={describe(r, product)}>
        {canEdit && <div className="flex gap-2">
          <button className={ghost} onClick={() => w.update.mutateAsync({ id: r.id, patch: { active: !r.active } }).then(() => toast.success(r.active ? "Rule switched off" : "Rule switched on"), (e) => toast.error(errMsg(e)))}>{r.active ? "Switch off" : "Switch on"}</button>
          <button className={ghost} onClick={() => { if (confirm("Delete this rule and its history?")) w.remove.mutateAsync(r.id).then(() => { toast.success("Rule deleted"); nav({ to: "/routing-rules" }); }, (e) => toast.error(errMsg(e))); }}>Delete</button>
        </div>}
      </PageHead>
      <div className="grid gap-2 sm:grid-cols-4">
        <Field l="When" v={TRIGGER[r.trigger_kind]} /><Field l="At step" v={r.operation_name ?? (r.trigger_kind === "product_is" ? "—" : "Any step")} />
        <Field l="Product" v={product ?? "Any"} /><Field l="Then" v={ACTION[r.action]} />
        <Field l="Check" v={r.parameter ? `${r.parameter}: ${r.min_value ?? "–"}…${r.max_value ?? "–"}` : "—"} /><Field l="Step to skip" v={r.target_operation_name} />
        <Field l="Priority" v={r.priority} /><Field l="Active" v={r.active ? "Yes" : "No"} />
      </div>
      <div className="glass-panel rounded-2xl p-5">
        <h2 className="mb-2 font-semibold">Times applied</h2>
        {lc.toolbar}
        <table className="mt-3 w-full text-xs"><thead className="text-[10px] uppercase text-muted-foreground"><tr><th className={th}>When</th><th className="text-left">Order</th><th className="text-left">Action</th><th className="text-left">Detail</th></tr></thead>
          <tbody>{lc.visible.map((h) => (
            <tr key={h.id} className="border-t border-border/40"><td className="py-2">{fmt(h.created_at)}</td>
              <td><Link to="/production-orders/$poId" params={{ poId: h.production_order_id }} className="font-mono text-primary">{h.production_order_id}</Link></td>
              <td>{ACTION[h.action]}</td><td>{h.detail}</td></tr>))}
            {lc.visible.length === 0 && <tr><td colSpan={4} className="py-4 text-center text-muted-foreground">Not applied yet.</td></tr>}
          </tbody></table>
        <div className="mt-3">{lc.pager}</div>
      </div>
    </div>
  );
}
