import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Waypoints, Plus } from "lucide-react";
import { useRows, useWrite, errMsg } from "@/lib/execution-db";
import { useMyOrg } from "@/lib/wip-db";
import { useCan } from "@/lib/access";
import { useListControls } from "@/components/list-controls";
import { PageHead, inp, btn, lbl, th, StepNames, ProductSelect } from "@/components/qp-ui";

export const Route = createFileRoute("/_authenticated/routing-rules/")({
  head: () => ({ meta: [
    { title: "Routing Rules · Cortanex MES" },
    { name: "description", content: "Dynamic routing: send to rework, hold or skip steps based on inspection results or product." },
    { property: "og:title", content: "Routing Rules · Cortanex MES" },
    { property: "og:description", content: "Dynamic routing rules." },
  ] }),
  component: RulesPage,
});

export const TRIGGER: Record<string, string> = { inspection_fail: "Inspection fails", value_out_of_range: "Measured value out of range", product_is: "Order is for product" };
export const ACTION: Record<string, string> = { rework_step: "Send the step to rework", hold_step: "Put the step on quality hold", skip_step: "Skip a step" };
export const describe = (r: any, product?: string) =>
  `When ${r.trigger_kind === "product_is" ? `the order is for ${product ?? r.product_id}` : r.trigger_kind === "inspection_fail" ? `an inspection fails at ${r.operation_name ?? "any step"}` : `${r.parameter} is outside ${r.min_value ?? "–"}…${r.max_value ?? "–"} at ${r.operation_name ?? "any step"}`} → ${r.action === "skip_step" ? `skip "${r.target_operation_name}"` : ACTION[r.action].toLowerCase()}`;

function RulesPage() {
  const nav = useNavigate();
  const { data: org } = useMyOrg();
  const canEdit = useCan("masterdata.write");
  const { data: rules = [] } = useRows<any>("routing_rules", { order: "priority", asc: true });
  const { data: hits = [] } = useRows<any>("routing_rule_hits");
  const { data: products = [] } = useRows<any>("products");
  const w = useWrite("routing_rules");
  const blank = { name: "", trigger_kind: "inspection_fail", operation_name: "", product_id: "", parameter: "", min_value: "", max_value: "", action: "rework_step", target_operation_name: "", priority: "100" };
  const [f, setF] = useState(blank);
  const rows = useMemo(() => rules.map((r) => ({ ...r, text: describe(r, products.find((p: any) => p.id === r.product_id)?.name), hits: hits.filter((h) => h.rule_id === r.id).length })), [rules, hits, products]);
  const lc = useListControls(rows, { searchKeys: ["name", "text", "operation_name", "target_operation_name"], dateKey: "created_at", exportName: "routing-rules" });

  const add = async () => {
    if (!f.name.trim()) return toast.error("Give the rule a name");
    if (f.trigger_kind === "product_is" && (!f.product_id || f.action !== "skip_step")) return toast.error("A product rule needs a product and the action \"Skip a step\"");
    if (f.trigger_kind === "value_out_of_range" && (!f.parameter.trim() || (f.min_value === "" && f.max_value === ""))) return toast.error("Enter the check name and a min or max");
    if (f.action === "skip_step" && !f.target_operation_name.trim()) return toast.error("Choose the step to skip");
    try {
      await w.insert.mutateAsync({
        organization_id: org, name: f.name.trim(), trigger_kind: f.trigger_kind, operation_name: f.trigger_kind === "product_is" ? null : f.operation_name.trim() || null,
        product_id: f.product_id || null, parameter: f.parameter.trim() || null, min_value: f.min_value === "" ? null : Number(f.min_value), max_value: f.max_value === "" ? null : Number(f.max_value),
        action: f.action, target_operation_name: f.action === "skip_step" ? f.target_operation_name.trim() : null, priority: Number(f.priority) || 100,
      });
      toast.success("Rule added"); setF(blank);
    } catch (e) { toast.error(errMsg(e)); }
  };

  return (
    <div className="space-y-6">
      <StepNames />
      <PageHead back="/production-orders" backLabel="Production orders" icon={<Waypoints className="h-5 w-5 text-primary" />} title="Routing rules"
        desc="Change an order's path automatically: send a step to rework or hold when an inspection fails or a value is out of range, or skip a step for a certain product (applied when the order is released)." />
      {canEdit && (
        <div className="glass-panel grid gap-3 rounded-2xl p-5 sm:grid-cols-5">
          <label className={lbl}>Rule name<input className={inp} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Wet flour → rework" /></label>
          <label className={lbl}>When<select className={inp} value={f.trigger_kind} onChange={(e) => setF({ ...f, trigger_kind: e.target.value, action: e.target.value === "product_is" ? "skip_step" : f.action })}>{Object.entries(TRIGGER).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
          {f.trigger_kind !== "product_is" && <label className={lbl}>At step<input list="step-names" className={inp} value={f.operation_name} onChange={(e) => setF({ ...f, operation_name: e.target.value })} placeholder="Any step" /></label>}
          <label className={lbl}>Product<ProductSelect value={f.product_id} onChange={(v) => setF({ ...f, product_id: v })} /></label>
          {f.trigger_kind === "value_out_of_range" && <>
            <label className={lbl}>Check name<input className={inp} value={f.parameter} onChange={(e) => setF({ ...f, parameter: e.target.value })} placeholder="moisture" /><span>Same name as in the inspection plan.</span></label>
            <label className={lbl}>Min<input type="number" className={inp} value={f.min_value} onChange={(e) => setF({ ...f, min_value: e.target.value })} /></label>
            <label className={lbl}>Max<input type="number" className={inp} value={f.max_value} onChange={(e) => setF({ ...f, max_value: e.target.value })} /></label>
          </>}
          <label className={lbl}>Then<select className={inp} value={f.action} onChange={(e) => setF({ ...f, action: e.target.value })}>{Object.entries(ACTION).filter(([k]) => f.trigger_kind !== "product_is" || k === "skip_step").map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
          {f.action === "skip_step" && <label className={lbl}>Step to skip<input list="step-names" className={inp} value={f.target_operation_name} onChange={(e) => setF({ ...f, target_operation_name: e.target.value })} /></label>}
          <label className={lbl}>Priority<input type="number" className={inp} value={f.priority} onChange={(e) => setF({ ...f, priority: e.target.value })} /><span>Lower runs first; first match wins.</span></label>
          <div className="pt-5"><button className={btn} onClick={add}><Plus className="h-3.5 w-3.5" />Add rule</button></div>
        </div>
      )}
      <div className="glass-panel rounded-2xl p-5">
        {lc.toolbar}
        <div className="mt-3 overflow-x-auto"><table className="w-full text-xs">
          <thead className="text-[10px] uppercase text-muted-foreground"><tr><th className={th}>Priority</th><th className="text-left">Rule</th><th className="text-left">Behaviour</th><th className="text-right">Times applied</th><th className="text-left">Active</th></tr></thead>
          <tbody>{lc.visible.map((r) => (
            <tr key={r.id} className="cursor-pointer border-t border-border/40 hover:bg-muted/30" onClick={() => nav({ to: "/routing-rules/$ruleId", params: { ruleId: r.id } })}>
              <td className="py-2 font-mono">{r.priority}</td><td className="text-primary">{r.name}</td><td>{r.text}</td><td className="text-right font-mono">{r.hits}</td><td>{r.active ? "Yes" : "No"}</td>
            </tr>))}
            {lc.visible.length === 0 && <tr><td colSpan={5} className="py-6 text-center text-muted-foreground">No routing rules yet.</td></tr>}
          </tbody></table></div>
        <div className="mt-3">{lc.pager}</div>
      </div>
    </div>
  );
}
