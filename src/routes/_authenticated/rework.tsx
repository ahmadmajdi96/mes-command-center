import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrowLeft, RotateCcw, Play, Send, CheckCircle2, XCircle, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useRows, useWrite, errMsg } from "@/lib/execution-db";
import { useListControls } from "@/components/list-controls";
import { REWORK_STATUS } from "@/lib/wip-db";
import { useCanAny } from "@/lib/access";

export const Route = createFileRoute("/_authenticated/rework")({
  head: () => ({ meta: [
    { title: "Rework Tasks · Cortanex MES" },
    { name: "description", content: "Rework tasks from rejected output, through re-inspection by QA." },
    { property: "og:title", content: "Rework Tasks · Cortanex MES" },
    { property: "og:description", content: "Rework and re-inspection." },
  ] }),
  component: ReworkPage,
});

const ghost = "inline-flex items-center gap-1 rounded-lg border border-border/60 px-2 py-1 text-[11px] hover:bg-card/60 disabled:opacity-50";

export function ReworkActions({ t }: { t: any }) {
  const w = useWrite("rework_tasks");
  const canWork = useCanAny("execution.rework", "execution.record");
  const canInspect = useCanAny("holds.release", "execution.override");
  const set = (patch: Record<string, unknown>, ok: string) => w.update.mutate({ id: t.id, patch }, { onSuccess: () => toast.success(ok), onError: (e) => toast.error(errMsg(e)) });
  return (
    <div className="flex flex-wrap justify-end gap-1">
      {t.status === "open" && <button className={ghost} disabled={!canWork} onClick={() => set({ status: "in_progress" }, "Rework started")}><Play className="h-3 w-3" />Start</button>}
      {t.status === "in_progress" && <button className={ghost} disabled={!canWork} onClick={() => set({ status: "awaiting_inspection" }, "Sent for re-inspection (QA portal notified)")}><Send className="h-3 w-3" />Done → re-inspect</button>}
      {t.status === "awaiting_inspection" && <>
        <button className={ghost} disabled={!canInspect} onClick={() => set({ status: "passed", inspection_source: "local", inspection_notes: "Passed locally" }, "Re-inspection passed")}><CheckCircle2 className="h-3 w-3" />Pass</button>
        <button className={ghost} disabled={!canInspect} onClick={() => { const n = window.prompt("What failed?")?.trim(); if (!n) return; set({ status: "failed", inspection_source: "local", inspection_notes: n }, "Re-inspection failed"); }}><XCircle className="h-3 w-3" />Fail</button>
      </>}
      {t.status === "failed" && <button className={ghost} disabled={!canWork} onClick={() => set({ status: "open" }, "Rework reopened")}><RotateCcw className="h-3 w-3" />Rework again</button>}
      {["open", "in_progress", "failed"].includes(t.status) && <button className={ghost} disabled={!canWork} onClick={() => { if (confirm("Scrap this quantity?")) set({ status: "scrapped" }, "Scrapped"); }}><Trash2 className="h-3 w-3" />Scrap</button>}
    </div>
  );
}

function ReworkPage() {
  const { data: tasks = [] } = useRows<any>("rework_tasks");
  const [status, setStatus] = useState("");
  const rows = useMemo(() => tasks.filter((t) => !status || t.status === status).map((t) => ({ ...t, status_label: REWORK_STATUS[t.status] })), [tasks, status]);
  const lc = useListControls(rows, { searchKeys: ["production_order_id", "batch_id", "reason", "assigned_to", "status_label", "inspector_name", "inspection_notes"], dateKey: "created_at", exportName: "rework-tasks" });
  const count = (s: string) => tasks.filter((t) => t.status === s).length;
  return (
    <div className="space-y-6">
      <Link to="/quality" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"><ArrowLeft className="h-3.5 w-3.5" /> Quality holds</Link>
      <div>
        <h1 className="flex items-center gap-2 font-display text-2xl font-semibold"><RotateCcw className="h-5 w-5 text-primary" />Rework tasks</h1>
        <p className="text-sm text-muted-foreground">Rejected output sent back for rework. When a task is done it goes to the QA portal for re-inspection; the result comes back here.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-5">{["open", "in_progress", "awaiting_inspection", "passed", "failed"].map((s) => (
        <button key={s} onClick={() => setStatus(status === s ? "" : s)} className={`glass-panel rounded-xl p-4 text-left ${status === s ? "ring-1 ring-primary" : ""}`}><div className="text-[10px] uppercase text-muted-foreground">{REWORK_STATUS[s]}</div><div className="mt-1 font-mono text-xl">{count(s)}</div></button>
      ))}</div>
      <div className="glass-panel rounded-2xl p-5">
        {lc.toolbar}
        <div className="mt-3 overflow-x-auto"><table className="w-full text-xs">
          <thead className="text-[10px] uppercase text-muted-foreground"><tr><th className="py-2 text-left">Created</th><th className="text-left">Order / batch</th><th className="text-right">Qty</th><th className="text-left">Reason</th><th className="text-left">Attempt</th><th className="text-left">Status</th><th className="text-left">Re-inspection</th><th className="text-right">Actions</th></tr></thead>
          <tbody>{lc.visible.map((t) => (
            <tr key={t.id} className="border-t border-border/40 align-top">
              <td className="py-2">{new Date(t.created_at).toLocaleString()}</td>
              <td><Link to="/production-orders/$poId" params={{ poId: t.production_order_id }} className="font-mono text-primary">{t.production_order_id}</Link>{t.batch_id && <div className="font-mono text-[10px]">{t.batch_id}</div>}</td>
              <td className="text-right font-mono">{Number(t.qty)} {t.uom}</td>
              <td>{t.reason}{t.instructions && <div className="text-muted-foreground">{t.instructions}</div>}</td>
              <td>#{t.attempts}</td>
              <td><span className="rounded-full border border-border/60 px-2 py-0.5 text-[10px] uppercase">{t.status_label}</span></td>
              <td>{t.inspection_result ? `${t.inspection_result} · ${t.inspection_source === "qa_portal" ? "QA portal" : "local"}${t.inspector_name ? ` · ${t.inspector_name}` : ""}` : "—"}{t.inspection_notes && <div className="text-muted-foreground">{t.inspection_notes}</div>}</td>
              <td className="text-right"><ReworkActions t={t} /></td>
            </tr>))}
            {lc.visible.length === 0 && <tr><td colSpan={8} className="py-6 text-center text-muted-foreground">No rework tasks match.</td></tr>}
          </tbody></table></div>
        <div className="mt-3">{lc.pager}</div>
      </div>
    </div>
  );
}
