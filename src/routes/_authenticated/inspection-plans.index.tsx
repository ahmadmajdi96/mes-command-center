import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ClipboardCheck, Plus } from "lucide-react";
import { useRows, useWrite, errMsg } from "@/lib/execution-db";
import { useMyOrg } from "@/lib/wip-db";
import { useCan } from "@/lib/access";
import { useListControls } from "@/components/list-controls";
import { PageHead, inp, btn, lbl, th, StepNames, ProductSelect } from "@/components/qp-ui";

export const Route = createFileRoute("/_authenticated/inspection-plans/")({
  head: () => ({ meta: [
    { title: "Inspection Plans · Cortanex MES" },
    { name: "description", content: "What to check at each step, how often, and whether QA or the line records it." },
    { property: "og:title", content: "Inspection Plans · Cortanex MES" },
    { property: "og:description", content: "Step inspection plans and sampling." },
  ] }),
  component: PlansPage,
});

function PlansPage() {
  const nav = useNavigate();
  const { data: org } = useMyOrg();
  const canEdit = useCan("masterdata.write");
  const { data: plans = [] } = useRows<any>("inspection_plans");
  const { data: results = [] } = useRows<any>("inspection_results");
  const { data: products = [] } = useRows<any>("products");
  const w = useWrite("inspection_plans");
  const [f, setF] = useState({ name: "", operation_name: "", product_id: "", sampling: "per_operation", sample_every: "", performed_by: "local" });
  const rows = useMemo(() => plans.map((p) => {
    const r = results.filter((x) => x.plan_id === p.id);
    return { ...p, product: products.find((x: any) => x.id === p.product_id)?.name ?? "Any", checks: (p.characteristics ?? []).length, samples: r.length, fails: r.filter((x) => x.result === "fail").length };
  }), [plans, results, products]);
  const lc = useListControls(rows, { searchKeys: ["name", "operation_name", "product", "performed_by", "sampling"], dateKey: "created_at", exportName: "inspection-plans" });

  const add = async () => {
    if (!f.name.trim() || !f.operation_name.trim()) return toast.error("Name and step are required");
    if (f.sampling === "every_qty" && !(Number(f.sample_every) > 0)) return toast.error("Enter how often to sample");
    try {
      const d = await w.insert.mutateAsync({ organization_id: org, name: f.name.trim(), operation_name: f.operation_name.trim(), product_id: f.product_id || null, sampling: f.sampling, sample_every: f.sampling === "every_qty" ? Number(f.sample_every) : null, performed_by: f.performed_by, characteristics: [] });
      toast.success("Plan created — now add the checks");
      nav({ to: "/inspection-plans/$planId", params: { planId: (d as any[])[0].id } });
    } catch (e) { toast.error(errMsg(e)); }
  };

  return (
    <div className="space-y-6">
      <StepNames />
      <PageHead back="/quality" backLabel="Quality" icon={<ClipboardCheck className="h-5 w-5 text-primary" />} title="Inspection plans"
        desc="Checks per step with sampling frequency. A step cannot be completed until its samples are recorded. A failed sample creates a nonconformance and sends it to QA." />
      {canEdit && (
        <div className="glass-panel grid gap-3 rounded-2xl p-5 sm:grid-cols-7">
          <label className={lbl}>Plan name<input className={inp} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Flour moisture check" /></label>
          <label className={lbl}>Step<input list="step-names" className={inp} value={f.operation_name} onChange={(e) => setF({ ...f, operation_name: e.target.value })} /><span>Step name it applies to.</span></label>
          <label className={lbl}>Product<ProductSelect value={f.product_id} onChange={(v) => setF({ ...f, product_id: v })} /></label>
          <label className={lbl}>Sampling<select className={inp} value={f.sampling} onChange={(e) => setF({ ...f, sampling: e.target.value })}><option value="per_operation">Once per step</option><option value="every_qty">Every N quantity</option></select></label>
          <label className={lbl}>Every (qty)<input type="number" className={inp} disabled={f.sampling !== "every_qty"} value={f.sample_every} onChange={(e) => setF({ ...f, sample_every: e.target.value })} placeholder="250" /></label>
          <label className={lbl}>Done by<select className={inp} value={f.performed_by} onChange={(e) => setF({ ...f, performed_by: e.target.value })}><option value="local">Operator at the line</option><option value="qa_portal">QA portal</option></select></label>
          <div className="pt-5"><button className={btn} onClick={add}><Plus className="h-3.5 w-3.5" />Create plan</button></div>
        </div>
      )}
      <div className="glass-panel rounded-2xl p-5">
        {lc.toolbar}
        <div className="mt-3 overflow-x-auto"><table className="w-full text-xs">
          <thead className="text-[10px] uppercase text-muted-foreground"><tr><th className={th}>Plan</th><th className="text-left">Step</th><th className="text-left">Product</th><th className="text-left">Sampling</th><th className="text-left">Done by</th><th className="text-right">Checks</th><th className="text-right">Samples</th><th className="text-right">Fails</th><th className="text-left">Active</th></tr></thead>
          <tbody>{lc.visible.map((p) => (
            <tr key={p.id} className="cursor-pointer border-t border-border/40 hover:bg-muted/30" onClick={() => nav({ to: "/inspection-plans/$planId", params: { planId: p.id } })}>
              <td className="py-2 text-primary">{p.name}</td><td>{p.operation_name}</td><td>{p.product}</td>
              <td>{p.sampling === "every_qty" ? `Every ${p.sample_every}` : "Once per step"}</td><td>{p.performed_by === "qa_portal" ? "QA portal" : "Line"}</td>
              <td className="text-right font-mono">{p.checks}</td><td className="text-right font-mono">{p.samples}</td><td className={`text-right font-mono ${p.fails ? "text-destructive" : ""}`}>{p.fails}</td><td>{p.active ? "Yes" : "No"}</td>
            </tr>))}
            {lc.visible.length === 0 && <tr><td colSpan={9} className="py-6 text-center text-muted-foreground">No inspection plans yet.</td></tr>}
          </tbody></table></div>
        <div className="mt-3">{lc.pager}</div>
      </div>
    </div>
  );
}
