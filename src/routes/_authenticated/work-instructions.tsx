import { createFileRoute } from "@tanstack/react-router";
import { RecLink } from "@/components/rec-link";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, CopyPlus, ListChecks, Plus, Trash2 } from "lucide-react";
import { useRows, useWrite, errMsg } from "@/lib/execution-db";
import { useMyOrg } from "@/lib/wip-db";
import { useCan } from "@/lib/access";
import { useListControls } from "@/components/list-controls";
import { PageHead, StepNames, ProductSelect, inp, btn, ghost, lbl, th } from "@/components/qp-ui";

export const Route = createFileRoute("/_authenticated/work-instructions")({
  head: () => ({ meta: [
    { title: "Work Instructions · Cortanex MES" },
    { name: "description", content: "Step-by-step work instructions that operators confirm before completing a production step." },
    { property: "og:title", content: "Work Instructions · Cortanex MES" },
    { property: "og:description", content: "Numbered instructions per production step, confirmed by operators." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: InstructionsPage,
});

const STATUS_STYLE: Record<string, string> = {
  approved: "bg-emerald-500/15 text-emerald-400",
  draft: "bg-amber-500/15 text-amber-400",
  retired: "bg-muted text-muted-foreground",
};

function InstructionsPage() {
  const { data: org } = useMyOrg();
  const canEdit = useCan("masterdata.write");
  const { data: steps = [] } = useRows<any>("instruction_steps", { order: "step_no", asc: true });
  const { data: products = [] } = useRows<any>("products");
  const w = useWrite("instruction_steps");
  const [f, setF] = useState({ operation_name: "", product_id: "", step_no: "1", title: "", body: "", image_url: "", requires_ack: true });

  const rows = useMemo(() => [...steps].sort((a, b) => a.operation_name.localeCompare(b.operation_name) || a.step_no - b.step_no || (b.version ?? 1) - (a.version ?? 1))
    .map((s) => ({ ...s, product: products.find((p) => p.id === s.product_id)?.name ?? "Any product" })), [steps, products]);
  const l = useListControls(rows, { searchKeys: ["operation_name", "product", "title", "body", "status"], dateKey: "created_at", exportName: "work-instructions" });

  const add = async () => {
    if (!f.operation_name.trim() || !f.title.trim()) return toast.error("Step name and instruction title are required");
    try {
      await w.insert.mutateAsync({ organization_id: org, operation_name: f.operation_name.trim(), product_id: f.product_id || null, step_no: Number(f.step_no) || 1,
        title: f.title.trim(), body: f.body.trim() || null, image_url: f.image_url.trim() || null, requires_ack: f.requires_ack, status: "draft", version: 1 });
      toast.success("Draft instruction added — activate it to make it visible to operators"); setF({ ...f, step_no: String((Number(f.step_no) || 1) + 1), title: "", body: "", image_url: "" });
    } catch (e) { toast.error(errMsg(e)); }
  };

  const newVersion = async (s: any) => {
    const siblings = steps.filter((x: any) => x.operation_name === s.operation_name && x.step_no === s.step_no && (x.product_id ?? null) === (s.product_id ?? null));
    const nextVer = Math.max(...siblings.map((x: any) => x.version ?? 1)) + 1;
    try {
      await w.insert.mutateAsync({ organization_id: s.organization_id, operation_name: s.operation_name, product_id: s.product_id, step_no: s.step_no,
        title: s.title, body: s.body, image_url: s.image_url, requires_ack: s.requires_ack, status: "draft", version: nextVer, supersedes: s.id });
      toast.success(`Draft version ${nextVer} created — edit it, then activate`);
    } catch (e) { toast.error(errMsg(e)); }
  };

  const activate = async (s: any) => {
    try {
      await w.update.mutateAsync({ id: s.id, patch: { status: "approved" } });
      toast.success(`Version ${s.version ?? 1} is now the approved version operators see`);
    } catch (e) { toast.error(errMsg(e)); }
  };

  return (
    <div className="space-y-6">
      <PageHead back="/step-templates" backLabel="Step templates" icon={<ListChecks className="h-5 w-5 text-primary" />} title="Work instructions"
        desc="Numbered instructions for each production step. Operators only see the approved version and must confirm each required one before the step can be completed. Changing an approved instruction means creating a new version." />
      <StepNames />
      {canEdit && (
        <div className="glass-panel grid gap-3 rounded-2xl p-5 sm:grid-cols-4">
          <label className={lbl}>Production step<input className={inp} list="step-names" value={f.operation_name} onChange={(e) => setF({ ...f, operation_name: e.target.value })} placeholder="Milling" /><span>Matches the step name on orders.</span></label>
          <label className={lbl}>Product<ProductSelect value={f.product_id} onChange={(v) => setF({ ...f, product_id: v })} /><span>Only for this product, or any.</span></label>
          <label className={lbl}>No.<input className={inp} type="number" value={f.step_no} onChange={(e) => setF({ ...f, step_no: e.target.value })} /><span>Order shown to the operator.</span></label>
          <label className={lbl}>Title<input className={inp} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="Check roll gap" /><span>Short action.</span></label>
          <label className={lbl + " sm:col-span-2"}>Details<textarea className={inp + " h-16 py-1"} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} /><span>How to do it, safety notes.</span></label>
          <label className={lbl}>Picture link<input className={inp} value={f.image_url} onChange={(e) => setF({ ...f, image_url: e.target.value })} placeholder="https://…" /><span>Optional image.</span></label>
          <div className="flex flex-col gap-2 pt-5">
            <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={f.requires_ack} onChange={(e) => setF({ ...f, requires_ack: e.target.checked })} />Operator must confirm</label>
            <button className={btn} onClick={add}><Plus className="h-3.5 w-3.5" />Add draft instruction</button>
          </div>
        </div>)}
      <div className="glass-panel rounded-2xl p-5">
        {l.toolbar}
        <div className="mt-3 overflow-x-auto"><table className="w-full text-xs">
          <thead className="text-[10px] uppercase text-muted-foreground"><tr><th className={th}>Step</th><th className="text-left">Product</th><th className="text-right">No.</th><th className="text-left">Instruction</th><th className="text-left">Version</th><th className="text-left">Confirm</th><th /></tr></thead>
          <tbody>{l.visible.map((s) => (
            <tr key={s.id} className="border-t border-border/40 align-top">
              <td className="py-2 font-medium"><RecLink kind="instruction" id={s.id}>{s.operation_name}</RecLink></td><td>{s.product}</td><td className="text-right">{s.step_no}</td>
              <td><div className="font-medium">{s.title}</div>{s.body && <div className="whitespace-pre-wrap text-muted-foreground">{s.body}</div>}{s.image_url && <a className="text-primary underline" href={s.image_url} target="_blank" rel="noreferrer">Picture</a>}</td>
              <td><span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${STATUS_STYLE[s.status] ?? STATUS_STYLE.draft}`}>v{s.version ?? 1} · {s.status ?? "approved"}</span></td>
              <td>{s.requires_ack ? "Required" : "Info only"}</td>
              <td className="text-right">{canEdit && (
                <span className="flex justify-end gap-1">
                  {s.status === "draft" && <button className={ghost} title="Activate this version" onClick={() => activate(s)}><CheckCircle2 className="h-3 w-3 text-emerald-400" /></button>}
                  {s.status === "approved" && <button className={ghost} title="Create a new draft version" onClick={() => newVersion(s)}><CopyPlus className="h-3 w-3" /></button>}
                  {s.status !== "approved" && <button className={ghost} title="Delete" onClick={async () => { try { await w.remove.mutateAsync(s.id); toast.success("Removed"); } catch (e) { toast.error(errMsg(e)); } }}><Trash2 className="h-3 w-3" /></button>}
                </span>)}</td>
            </tr>))}
            {l.visible.length === 0 && <tr><td colSpan={7} className="py-6 text-center text-muted-foreground">No instructions yet.</td></tr>}</tbody>
        </table></div>
        {l.pager}
      </div>
    </div>
  );
}
