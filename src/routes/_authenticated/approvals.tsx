import { createFileRoute } from "@tanstack/react-router";
import { RecLink } from "@/components/rec-link";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { PenLine, ShieldCheck } from "lucide-react";
import { useRows, errMsg } from "@/lib/execution-db";
import { supabase } from "@/integrations/supabase/client";
import { useMyOrg } from "@/lib/wip-db";
import { useCan, useCanAny } from "@/lib/access";
import { useListControls } from "@/components/list-controls";
import { PageHead, inp, btn, ghost, lbl, th, fmt } from "@/components/qp-ui";
import { APPROVAL_KINDS, decideApproval, requestApproval, type ApprovalKind } from "@/lib/mes/approvals.functions";

export const Route = createFileRoute("/_authenticated/approvals")({
  head: () => ({ meta: [
    { title: "Approvals & Signatures · Cortanex MES" },
    { name: "description", content: "Approval requests for releases, scrap, overrides and version changes, signed electronically." },
    { property: "og:title", content: "Approvals & Signatures · Cortanex MES" },
    { property: "og:description", content: "Signed approvals with password re-entry and reason." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: ApprovalsPage,
});

const STATUS_CLS: Record<string, string> = { pending: "text-warning", approved: "text-success", rejected: "text-destructive" };

function ApprovalsPage() {
  const qc = useQueryClient();
  const { data: org } = useMyOrg();
  const canDecide = useCanAny("execution.override", "orders.lifecycle");
  const canSettings = useCan("masterdata.write");
  const { data: reqs = [] } = useRows<any>("approval_requests");
  const { data: sigs = [] } = useRows<any>("e_signatures", { order: "signed_at" });
  const { data: orders = [] } = useRows<any>("production_orders");
  const { data: ops = [] } = useRows<any>("order_operations", { order: "sequence", asc: true });
  const { data: versions = [] } = useRows<any>("production_versions");
  const { data: settings = [] } = useRows<any>("approval_settings", { order: "updated_at" });
  const request = useServerFn(requestApproval);
  const decide = useServerFn(decideApproval);

  const [f, setF] = useState({ kind: "order_release" as ApprovalKind, order: "", op: "", qty: "", version: "", note: "" });
  const [sign, setSign] = useState<{ id: string; approve: boolean } | null>(null);
  const [sf, setSf] = useState({ reason: "", password: "" });
  const [busy, setBusy] = useState(false);
  const cur = settings.find((s) => s.organization_id === org);
  const [limit, setLimit] = useState<string>("");

  const rows = useMemo(() => reqs.map((r) => ({ ...r, kindLabel: APPROVAL_KINDS[r.kind as ApprovalKind] ?? r.kind })), [reqs]);
  const lr = useListControls(rows, { searchKeys: ["summary", "kindLabel", "status", "requested_by_name", "decided_by_name", "decision_reason", "ref_id"], dateKey: "created_at", exportName: "approvals" });
  const ls = useListControls(sigs, { searchKeys: ["signer_name", "signer_email", "meaning", "reason", "ref_id"], dateKey: "signed_at", exportName: "e-signatures" });
  const orderOps = ops.filter((o) => o.production_order_id === f.order);
  const order = orders.find((o) => o.id === f.order);

  const submit = async () => {
    if (!org || !f.order) return toast.error("Choose an order");
    let refTable = "production_orders", refId = f.order, summary = "", details: Record<string, unknown> = { note: f.note };
    if (f.kind === "order_release") summary = `Release ${order?.number ?? f.order}`;
    if (f.kind === "version_change") {
      if (!f.version) return toast.error("Choose the new version");
      refId = `${f.order}:${f.version}`; summary = `Change ${order?.number} to version ${f.version}`; details.version = f.version;
    }
    if (f.kind === "scrap_over_limit" || f.kind === "step_override") {
      if (!f.op) return toast.error("Choose the step");
      const op = ops.find((o) => o.id === f.op);
      refTable = "order_operations"; refId = f.op;
      if (f.kind === "scrap_over_limit") {
        if (!(Number(f.qty) > 0)) return toast.error("Enter the total scrap quantity to approve");
        details.qty = Number(f.qty); summary = `Scrap up to ${f.qty} ${order?.uom ?? ""} on ${op?.name} (${order?.number})`;
      } else summary = `Skip step "${op?.name}" on ${order?.number}`;
    }
    if (f.note.trim()) summary += ` — ${f.note.trim()}`;
    try {
      await request({ data: { organizationId: org, kind: f.kind, refTable, refId, summary, details } });
      toast.success("Approval requested"); setF({ ...f, note: "", qty: "" });
      qc.invalidateQueries({ queryKey: ["exec"] });
    } catch (e) { toast.error(errMsg(e)); }
  };

  const doSign = async () => {
    if (!sign) return;
    setBusy(true);
    try {
      await decide({ data: { id: sign.id, approve: sign.approve, reason: sf.reason, password: sf.password } });
      toast.success(sign.approve ? "Approved and signed" : "Rejected and signed");
      setSign(null); setSf({ reason: "", password: "" });
      qc.invalidateQueries({ queryKey: ["exec"] });
    } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  };

  const saveLimit = async () => {
    if (!org || !(Number(limit) >= 0)) return;
    const { error } = await supabase.from("approval_settings" as never).upsert({ organization_id: org, scrap_limit: Number(limit) } as never);
    if (error) return toast.error(error.message);
    toast.success("Scrap limit saved"); setLimit(""); qc.invalidateQueries({ queryKey: ["exec"] });
  };

  return (
    <div className="space-y-6">
      <PageHead back="/production-orders" backLabel="Production orders" icon={<ShieldCheck className="h-5 w-5 text-primary" />} title="Approvals & electronic signatures"
        desc="Order releases, scrap over the limit, skipped steps and production-version changes only go through after a signed approval. Signing needs your password and a reason." />

      <div className="glass-panel grid gap-3 rounded-2xl p-5 sm:grid-cols-6">
        <label className={lbl}>Type<select className={inp} value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value as ApprovalKind })}>
          {Object.entries(APPROVAL_KINDS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select><span>What needs approval.</span></label>
        <label className={lbl}>Order<select className={inp} value={f.order} onChange={(e) => setF({ ...f, order: e.target.value, op: "" })}>
          <option value="">Choose…</option>{orders.map((o) => <option key={o.id} value={o.id}>{o.number} · {o.product_name} · {o.status}</option>)}</select><span>The production order.</span></label>
        {(f.kind === "scrap_over_limit" || f.kind === "step_override") && (
          <label className={lbl}>Step<select className={inp} value={f.op} onChange={(e) => setF({ ...f, op: e.target.value })}>
            <option value="">Choose…</option>{orderOps.map((o) => <option key={o.id} value={o.id}>{o.sequence} · {o.name} · {o.status}</option>)}</select><span>The step concerned.</span></label>)}
        {f.kind === "scrap_over_limit" && <label className={lbl}>Total scrap<input className={inp} type="number" value={f.qty} onChange={(e) => setF({ ...f, qty: e.target.value })} /><span>Up to this total on the step.</span></label>}
        {f.kind === "version_change" && <label className={lbl}>New version<select className={inp} value={f.version} onChange={(e) => setF({ ...f, version: e.target.value })}>
          <option value="">Choose…</option>{versions.filter((v) => !order || v.product_id === order.product_id).map((v) => <option key={v.id} value={v.id}>{v.id} · {v.name ?? v.version ?? ""}</option>)}</select><span>Version to switch to.</span></label>}
        <label className={lbl}>Note<input className={inp} value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /><span>Why it is needed.</span></label>
        <div className="flex items-start pt-5"><button className={btn} onClick={submit}><PenLine className="h-3.5 w-3.5" />Request approval</button></div>
      </div>

      {canSettings && (
        <div className="glass-panel flex flex-wrap items-end gap-3 rounded-2xl p-5">
          <label className={lbl + " w-48"}>Scrap limit per step<input className={inp} type="number" placeholder={String(cur?.scrap_limit ?? 50)} value={limit} onChange={(e) => setLimit(e.target.value)} /><span>Current: {cur?.scrap_limit ?? 50}. Above this needs approval.</span></label>
          <button className={ghost} disabled={!limit} onClick={saveLimit}>Save limit</button>
        </div>)}

      <div className="glass-panel rounded-2xl p-5">
        <h2 className="mb-2 font-semibold">Requests</h2>
        {lr.toolbar}
        <div className="mt-3 overflow-x-auto"><table className="w-full text-xs">
          <thead className="text-[10px] uppercase text-muted-foreground"><tr><th className={th}>Requested</th><th className="text-left">Type</th><th className="text-left">What</th><th className="text-left">By</th><th className="text-left">Status</th><th className="text-left">Decision</th><th /></tr></thead>
          <tbody>{lr.visible.map((r) => (
            <tr key={r.id} className="border-t border-border/40" data-testid={`approval-${r.id}`}>
              <td className="py-2">{fmt(r.created_at)}</td><td>{r.kindLabel}</td><td><RecLink kind="approval" id={r.id}>{r.summary}</RecLink></td><td>{r.requested_by_name ?? "—"}</td>
              <td className={STATUS_CLS[r.status]}>{r.status}</td>
              <td>{r.decided_by_name ? `${r.decided_by_name} · ${fmt(r.decided_at)} · ${r.decision_reason}` : "—"}</td>
              <td className="text-right">{r.status === "pending" && canDecide && (<div className="flex justify-end gap-1">
                <button className={ghost} onClick={() => setSign({ id: r.id, approve: true })}>Approve</button>
                <button className={ghost} onClick={() => setSign({ id: r.id, approve: false })}>Reject</button></div>)}</td>
            </tr>))}
            {lr.visible.length === 0 && <tr><td colSpan={7} className="py-6 text-center text-muted-foreground">No requests.</td></tr>}</tbody>
        </table></div>
        {lr.pager}
      </div>

      <div className="glass-panel rounded-2xl p-5">
        <h2 className="mb-2 font-semibold">Electronic signature record</h2>
        <p className="mb-2 text-xs text-muted-foreground">Permanent: signatures cannot be edited or deleted.</p>
        {ls.toolbar}
        <div className="mt-3 overflow-x-auto"><table className="w-full text-xs">
          <thead className="text-[10px] uppercase text-muted-foreground"><tr><th className={th}>Signed</th><th className="text-left">Signer</th><th className="text-left">Meaning</th><th className="text-left">Reason</th></tr></thead>
          <tbody>{ls.visible.map((s) => (
            <tr key={s.id} className="border-t border-border/40"><td className="py-2">{fmt(s.signed_at)}</td><td>{s.signer_name} <span className="text-muted-foreground">{s.signer_email}</span></td><td>{s.meaning}</td><td>{s.reason}</td></tr>))}
            {ls.visible.length === 0 && <tr><td colSpan={4} className="py-6 text-center text-muted-foreground">No signatures yet.</td></tr>}</tbody>
        </table></div>
        {ls.pager}
      </div>

      {sign && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4" onClick={() => setSign(null)}>
          <div className="glass-panel w-full max-w-sm space-y-3 rounded-2xl p-5" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold">{sign.approve ? "Approve" : "Reject"} — electronic signature</h3>
            <p className="text-xs text-muted-foreground">By signing you confirm this decision under your own name.</p>
            <label className={lbl}>Reason<input className={inp} value={sf.reason} onChange={(e) => setSf({ ...sf, reason: e.target.value })} /></label>
            <label className={lbl}>Your password<input className={inp} type="password" autoComplete="current-password" value={sf.password} onChange={(e) => setSf({ ...sf, password: e.target.value })} /></label>
            <div className="flex justify-end gap-2"><button className={ghost} onClick={() => setSign(null)}>Cancel</button>
              <button className={btn} disabled={busy} onClick={doSign}>Sign</button></div>
          </div>
        </div>)}
    </div>
  );
}
