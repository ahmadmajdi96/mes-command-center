import { useState } from "react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { PenLine } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useRows, errMsg } from "@/lib/execution-db";
import { APPROVAL_KINDS, requestApproval, type ApprovalKind } from "@/lib/mes/approvals.functions";

type Po = { id: string; number: string; organization_id: string; uom: string; product_id?: string | null };
type Op = { id: string; name: string };

/** Opens a small form to request a signed approval straight from an order or step. */
export function RequestApprovalButton({ po, op, kinds, className }: { po: Po; op?: Op; kinds: ApprovalKind[]; className?: string }) {
  const qc = useQueryClient();
  const request = useServerFn(requestApproval);
  const { data: reqs = [] } = useRows<any>("approval_requests");
  const { data: versions = [] } = useRows<any>("production_versions");
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<ApprovalKind>(kinds[0]);
  const [qty, setQty] = useState("");
  const [version, setVersion] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const refIds = [po.id, op?.id].filter(Boolean);
  const pending = reqs.filter((r) => r.status === "pending" && kinds.includes(r.kind) && refIds.some((id) => r.ref_id === id || String(r.ref_id).startsWith(`${po.id}:`) && !op)).length;

  const submit = async () => {
    let refTable = "production_orders", refId = po.id, summary = "";
    const details: Record<string, unknown> = { note };
    if (kind === "order_release") summary = `Release ${po.number}`;
    if (kind === "version_change") {
      if (!version) return toast.error("Choose the new version");
      refId = `${po.id}:${version}`; summary = `Change ${po.number} to version ${version}`; details.version = version;
    }
    if (kind === "scrap_over_limit" || kind === "step_override") {
      if (!op) return;
      refTable = "order_operations"; refId = op.id;
      if (kind === "scrap_over_limit") {
        if (!(Number(qty) > 0)) return toast.error("Enter the total scrap quantity to approve");
        details.qty = Number(qty); summary = `Scrap up to ${qty} ${po.uom} on ${op.name} (${po.number})`;
      } else summary = `Skip step "${op.name}" on ${po.number}`;
    }
    if (note.trim()) summary += ` — ${note.trim()}`;
    setBusy(true);
    try {
      await request({ data: { organizationId: po.organization_id, kind, refTable, refId, summary, details } });
      toast.success("Approval requested — an approver signs it on the Approvals page");
      setOpen(false); setNote(""); setQty("");
      qc.invalidateQueries({ queryKey: ["exec"] });
    } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  };

  const inp = "h-9 w-full rounded-lg border border-border/60 bg-card/60 px-2 text-xs focus:outline-none";
  return (
    <>
      <button className={className ?? "flex h-7 items-center gap-1 rounded-lg border border-border/60 px-2 text-[11px]"} onClick={() => setOpen(true)} data-testid={`request-approval-${op?.id ?? po.id}`}>
        <PenLine className="h-3 w-3" />Request approval{pending ? ` (${pending} pending)` : ""}
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request approval</DialogTitle>
            <DialogDescription>{op ? `Step "${op.name}" on ${po.number}` : `Order ${po.number}`}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-xs">
            <label className="block space-y-1 text-muted-foreground">What needs approval
              <select className={inp} value={kind} onChange={(e) => setKind(e.target.value as ApprovalKind)}>
                {kinds.map((k) => <option key={k} value={k}>{APPROVAL_KINDS[k]}</option>)}
              </select></label>
            {kind === "scrap_over_limit" && <label className="block space-y-1 text-muted-foreground">Total scrap to allow ({po.uom})<input className={inp} type="number" value={qty} onChange={(e) => setQty(e.target.value)} /></label>}
            {kind === "version_change" && <label className="block space-y-1 text-muted-foreground">New version
              <select className={inp} value={version} onChange={(e) => setVersion(e.target.value)}>
                <option value="">Choose…</option>
                {versions.filter((v) => !po.product_id || v.product_id === po.product_id).map((v) => <option key={v.id} value={v.id}>{v.id} · {v.name ?? ""}</option>)}
              </select></label>}
            <label className="block space-y-1 text-muted-foreground">Why it is needed<input className={inp} value={note} onChange={(e) => setNote(e.target.value)} /></label>
            <div className="flex justify-end gap-2">
              <button className="h-8 rounded-lg border border-border/60 px-3" onClick={() => setOpen(false)}>Cancel</button>
              <button className="h-8 rounded-lg bg-primary px-3 font-medium text-primary-foreground disabled:opacity-50" disabled={busy} onClick={submit}>Send request</button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
