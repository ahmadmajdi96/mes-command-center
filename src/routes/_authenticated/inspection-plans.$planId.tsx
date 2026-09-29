import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { ClipboardCheck, Plus, Trash2 } from "lucide-react";
import { useRows, useWrite, errMsg } from "@/lib/execution-db";
import { useCan } from "@/lib/access";
import { useListControls } from "@/components/list-controls";
import { PageHead, inp, btn, ghost, lbl, th, Field, fmt } from "@/components/qp-ui";

export const Route = createFileRoute("/_authenticated/inspection-plans/$planId")({
  head: () => ({ meta: [
    { title: "Inspection plan · Cortanex MES" },
    { name: "description", content: "Checks, limits and recorded results for one inspection plan." },
    { property: "og:title", content: "Inspection plan · Cortanex MES" },
    { property: "og:description", content: "Inspection checks and results." },
  ] }),
  component: PlanDetail,
});

function PlanDetail() {
  const { planId } = Route.useParams();
  const canEdit = useCan("masterdata.write");
  const { data: plans = [] } = useRows<any>("inspection_plans", { eq: { id: planId } });
  const plan = plans[0];
  const { data: results = [] } = useRows<any>("inspection_results", { eq: { plan_id: planId } });
  const w = useWrite("inspection_plans");
  const [ch, setCh] = useState({ name: "", type: "numeric", min: "", max: "", unit: "" });
  const lc = useListControls(results, { searchKeys: ["production_order_id", "result", "inspector_name", "source", "notes"], dateKey: "created_at", exportName: "inspection-results" });
  if (!plan) return <div className="text-sm text-muted-foreground">Loading plan… <Link to="/inspection-plans" className="text-primary">Back</Link></div>;
  const chars: any[] = plan.characteristics ?? [];
  const save = async (next: any[], ok: string) => { try { await w.update.mutateAsync({ id: plan.id, patch: { characteristics: next } }); toast.success(ok); } catch (e) { toast.error(errMsg(e)); } };

  return (
    <div className="space-y-6">
      <PageHead back="/inspection-plans" backLabel="Inspection plans" icon={<ClipboardCheck className="h-5 w-5 text-primary" />} title={plan.name} desc={`Applies to step "${plan.operation_name}".`}>
        {canEdit && <button className={ghost} onClick={() => w.update.mutateAsync({ id: plan.id, patch: { active: !plan.active } }).then(() => toast.success(plan.active ? "Plan switched off" : "Plan switched on"), (e) => toast.error(errMsg(e)))}>{plan.active ? "Switch off" : "Switch on"}</button>}
      </PageHead>
      <div className="grid gap-2 sm:grid-cols-5">
        <Field l="Step" v={plan.operation_name} /><Field l="Sampling" v={plan.sampling === "every_qty" ? `Every ${plan.sample_every}` : "Once per step"} />
        <Field l="Done by" v={plan.performed_by === "qa_portal" ? "QA portal" : "Operator at the line"} /><Field l="Samples" v={results.length} />
        <Field l="Failed" v={results.filter((r) => r.result === "fail").length} />
      </div>
      <div className="glass-panel space-y-3 rounded-2xl p-5">
        <h2 className="font-semibold">Checks</h2>
        {canEdit && (
          <div className="grid gap-2 sm:grid-cols-6">
            <label className={lbl}>Check name<input className={inp} value={ch.name} onChange={(e) => setCh({ ...ch, name: e.target.value })} placeholder="moisture" /></label>
            <label className={lbl}>Type<select className={inp} value={ch.type} onChange={(e) => setCh({ ...ch, type: e.target.value })}><option value="numeric">Measured value</option><option value="pass_fail">Pass / fail</option></select></label>
            <label className={lbl}>Min<input type="number" className={inp} disabled={ch.type !== "numeric"} value={ch.min} onChange={(e) => setCh({ ...ch, min: e.target.value })} /></label>
            <label className={lbl}>Max<input type="number" className={inp} disabled={ch.type !== "numeric"} value={ch.max} onChange={(e) => setCh({ ...ch, max: e.target.value })} /></label>
            <label className={lbl}>Unit<input className={inp} disabled={ch.type !== "numeric"} value={ch.unit} onChange={(e) => setCh({ ...ch, unit: e.target.value })} placeholder="%" /></label>
            <div className="pt-5"><button className={btn} onClick={() => {
              const name = ch.name.trim();
              if (!name) return toast.error("Enter a check name");
              if (chars.some((x) => x.name === name)) return toast.error("That check already exists");
              if (ch.type === "numeric" && ch.min === "" && ch.max === "") return toast.error("Enter a min or max limit");
              save([...chars, { name, type: ch.type, min: ch.min === "" ? null : Number(ch.min), max: ch.max === "" ? null : Number(ch.max), unit: ch.unit || null }], "Check added").then(() => setCh({ name: "", type: "numeric", min: "", max: "", unit: "" }));
            }}><Plus className="h-3.5 w-3.5" />Add check</button></div>
          </div>
        )}
        <ul className="space-y-1 text-xs">{chars.map((x) => (
          <li key={x.name} className="flex items-center justify-between rounded-lg border border-border/40 px-2 py-1.5">
            <span><b>{x.name}</b> · {x.type === "pass_fail" ? "pass / fail" : `${x.min ?? "–"} … ${x.max ?? "–"} ${x.unit ?? ""}`}</span>
            {canEdit && <button className={ghost} aria-label={`Remove ${x.name}`} onClick={() => save(chars.filter((y) => y.name !== x.name), "Check removed")}><Trash2 className="h-3 w-3" /></button>}
          </li>))}
          {chars.length === 0 && <li className="text-warning">No checks yet — add at least one.</li>}
        </ul>
      </div>
      <div className="glass-panel rounded-2xl p-5">
        <h2 className="mb-2 font-semibold">Results</h2>
        {lc.toolbar}
        <div className="mt-3 overflow-x-auto"><table className="w-full text-xs">
          <thead className="text-[10px] uppercase text-muted-foreground"><tr><th className={th}>When</th><th className="text-left">Order</th><th className="text-left">Sample</th><th className="text-left">Values</th><th className="text-left">Result</th><th className="text-left">By</th></tr></thead>
          <tbody>{lc.visible.map((r) => (
            <tr key={r.id} className="border-t border-border/40">
              <td className="py-2">{fmt(r.created_at)}</td>
              <td><Link to="/production-orders/$poId" params={{ poId: r.production_order_id }} className="font-mono text-primary">{r.production_order_id}</Link></td>
              <td>#{r.sample_no}</td><td>{Object.entries(r.values ?? {}).map(([k, v]) => `${k}=${v}`).join(", ") || "—"}{r.failed_checks?.length ? <div className="text-destructive">{r.failed_checks.join("; ")}</div> : null}</td>
              <td className={r.result === "pass" ? "text-success" : "text-destructive"}>{r.result.toUpperCase()}</td>
              <td>{r.inspector_name} · {r.source === "qa_portal" ? "QA portal" : "line"}</td>
            </tr>))}
            {lc.visible.length === 0 && <tr><td colSpan={6} className="py-6 text-center text-muted-foreground">No results yet.</td></tr>}
          </tbody></table></div>
        <div className="mt-3">{lc.pager}</div>
      </div>
    </div>
  );
}
