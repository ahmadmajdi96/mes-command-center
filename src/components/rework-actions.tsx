import { RotateCcw, Play, Send, CheckCircle2, XCircle, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useWrite, errMsg } from "@/lib/execution-db";
import { useCanAny } from "@/lib/access";

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

