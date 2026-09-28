import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Play, CheckCircle2, PauseCircle, PlayCircle, Wrench, ShieldCheck, Ban, RotateCcw, SkipForward,
  AlertTriangle, Lock, Unlock, Pencil, RefreshCw, History, ListChecks, XCircle, Clock,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useRows, errMsg } from "@/lib/execution-db";
import { useWasteReasons } from "@/lib/hmi-db";
import { useCan } from "@/lib/access";
import { useListControls } from "@/components/list-controls";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  getReleaseCheck, startOperation, finishSetup, changeOperationStatus, confirmOperation, approveOperation,
  raiseException, resolveException, placeOrderHold, releaseOrderHold, modifyOrder,
} from "@/lib/mes/operations.functions";

const inp = "h-9 w-full rounded-lg border border-border/60 bg-card/60 px-2 text-xs focus:border-primary/50 focus:outline-none";
const btn = "flex h-8 items-center gap-1 rounded-lg bg-primary px-2.5 text-xs font-medium text-primary-foreground disabled:opacity-50";
const ghost = "flex h-7 items-center gap-1 rounded-lg border border-border/60 px-2 text-[11px] hover:text-foreground disabled:opacity-40";
const card = "glass-panel space-y-3 rounded-2xl p-4";
const lbl = "space-y-1 text-[11px] text-muted-foreground";

export const OP_STATUS: Record<string, { label: string; cls: string }> = {
  pending: { label: "Not started", cls: "border-border/60 text-muted-foreground" },
  ready: { label: "Ready", cls: "border-info/50 text-info" },
  running: { label: "In progress", cls: "border-primary/50 text-primary" },
  partially_completed: { label: "Partially completed", cls: "border-primary/50 text-primary" },
  completed: { label: "Completed", cls: "border-success/50 text-success" },
  on_hold: { label: "On hold", cls: "border-warning/50 text-warning" },
  blocked: { label: "Blocked", cls: "border-destructive/50 text-destructive" },
  cancelled: { label: "Cancelled", cls: "border-border/60 text-muted-foreground line-through" },
  rework_required: { label: "Rework required", cls: "border-warning/50 text-warning" },
  skipped: { label: "Skipped", cls: "border-border/60 text-muted-foreground" },
};
export const StatusPill = ({ s }: { s: string }) => {
  const x = OP_STATUS[s] ?? { label: s, cls: "border-border/60" };
  return <span className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wider ${x.cls}`}>{x.label}</span>;
};

const EX_TYPES: Record<string, string> = {
  machine_failure: "Machine failure", material_shortage: "Material shortage", tool_failure: "Tool failure",
  process_deviation: "Process deviation", production_interruption: "Production interruption",
  resource_unavailable: "Resource unavailable", quality_interruption: "Quality-related interruption", other: "Other",
};
const HOLD_TYPES = ["quality", "material", "planning", "customer", "equipment", "other"];
const HOLD_CATS: Record<string, string> = { downtime: "Downtime (machine / equipment)", waiting: "Waiting", material: "Waiting for material", break: "Break", quality: "Quality check" };

type Po = { id: string; number: string; sku: string; product_name: string; qty: number; uom: string; status: string; organization_id: string; line_id?: string | null; planned_start?: string | null; planned_end?: string | null; priority?: string; shift?: string; operator?: string | null; notes?: string | null; created_at?: string };

function useRefresh() {
  const qc = useQueryClient();
  return () => { qc.invalidateQueries({ queryKey: ["exec"] }); qc.invalidateQueries({ queryKey: ["production_order"] }); qc.invalidateQueries({ queryKey: ["production_orders"] }); qc.invalidateQueries({ queryKey: ["release_check"] }); qc.invalidateQueries({ queryKey: ["order_timeline"] }); };
}

function useRun() {
  const refresh = useRefresh();
  const [busy, setBusy] = useState(false);
  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    try { await fn(); toast.success(ok); refresh(); return true; }
    catch (e) { toast.error(errMsg(e)); return false; }
    finally { setBusy(false); }
  };
  return { run, busy };
}

const mins = (a?: string | null, b?: string | null) => (a ? Math.max(0, Math.round(((b ? new Date(b).getTime() : Date.now()) - new Date(a).getTime()) / 6000) / 10) : 0);
const fmtMin = (m: number | null | undefined) => (m == null ? "—" : m >= 60 ? `${Math.floor(m / 60)} h ${Math.round(m % 60)} min` : `${m} min`);
const dt = (s?: string | null) => (s ? new Date(s).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "—");

function useTick(ms = 30000) {
  const [, set] = useState(0);
  useEffect(() => { const t = setInterval(() => set((x) => x + 1), ms); return () => clearInterval(t); }, [ms]);
}

/* =============================== Release readiness =============================== */

export function ReleaseReadiness({ po }: { po: Po }) {
  const check = useServerFn(getReleaseCheck);
  const { data = [], isFetching, refetch, error } = useQuery({ queryKey: ["release_check", po.id, po.status], queryFn: () => check({ data: { orderId: po.id } }) });
  const blocking = data.filter((x) => x.blocking && !x.ok);
  const warnings = data.filter((x) => !x.blocking && !x.ok);
  const pre = ["scheduled", "planned"].includes(po.status);
  return (
    <div className={card} data-testid="release-readiness">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-semibold"><ListChecks className="h-4 w-4 text-primary" />Execution readiness</h3>
        <button className={ghost} onClick={() => refetch()} disabled={isFetching}><RefreshCw className={`h-3 w-3 ${isFetching ? "animate-spin" : ""}`} />Re-check</button>
      </div>
      {error && <p className="text-xs text-destructive">{errMsg(error)}</p>}
      <p className={`text-xs ${blocking.length ? "text-destructive" : warnings.length ? "text-warning" : "text-success"}`}>
        {blocking.length
          ? `${pre ? "Cannot be released yet" : "Execution is blocked"} — ${blocking.length} required check${blocking.length === 1 ? "" : "s"} failing.`
          : warnings.length ? `Ready${pre ? " to release" : ""}, with ${warnings.length} warning${warnings.length === 1 ? "" : "s"}.` : `All checks pass${pre ? " — ready to release" : ""}.`}
      </p>
      <ul className="grid gap-1.5 md:grid-cols-2">
        {data.map((x) => (
          <li key={x.key} className="flex items-start gap-2 rounded-lg border border-border/40 bg-card/40 px-2.5 py-1.5 text-xs">
            {x.ok ? <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" /> : x.blocking ? <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" /> : <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" />}
            <div><div>{x.label}{!x.ok && <span className="ml-1 text-[10px] uppercase text-muted-foreground">{x.blocking ? "required" : "warning"}</span>}</div><div className="text-[11px] text-muted-foreground">{x.detail}</div></div>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* =============================== Operations board =============================== */

export function OperationsBoard({ po, ops, batches, locked }: { po: Po; ops: any[]; batches: any[]; locked: boolean }) {
  useTick();
  const { data: events = [] } = useRows("operation_events", { eq: { production_order_id: po.id }, order: "at", asc: true });
  const { data: machines = [] } = useRows("machines", { order: "name", asc: true });
  const { data: stations = [] } = useRows("stations", { order: "sequence", asc: true });
  const { data: wcs = [] } = useRows("work_centers", { order: "id", asc: true });
  const [dlg, setDlg] = useState<{ kind: "start" | "confirm" | "status" | "approve" | "exception"; op: any; action?: string } | null>(null);
  const canRecord = useCan("execution.record");
  const canOverride = useCan("execution.override");
  const canRework = useCan("execution.rework");
  const { run, busy } = useRun();
  const setup = useServerFn(finishSetup);

  const blockOf = (o: any, i: number): string | null => {
    if (!["released", "running"].includes(po.status)) return `Order is ${po.status}`;
    for (const p of ops.slice(0, i)) {
      if (["skipped", "cancelled"].includes(p.status)) continue;
      if (!["completed", "partially_completed"].includes(p.status)) return `Waiting for "${p.name}" (${OP_STATUS[p.status]?.label ?? p.status})`;
      if (p.status === "partially_completed" && Number(p.qty_yield) <= 0) return `"${p.name}" has no accepted quantity yet`;
      if (p.requires_approval && !p.approved_at) return `"${p.name}" needs approval`;
    }
    return null;
  };

  return (
    <div className={card} data-testid="operations-board">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">Operations — step-by-step execution</h3>
        <span className="text-[11px] text-muted-foreground">{ops.filter((o) => o.status === "completed").length} / {ops.filter((o) => !["skipped", "cancelled"].includes(o.status)).length} completed</span>
      </div>
      {ops.length === 0 && <p className="text-xs text-muted-foreground">No operations yet — apply an execution scenario or add operations below.</p>}
      <div className="space-y-3">
        {ops.map((o, i) => {
          const mine = events.filter((e: any) => e.operation_id === o.id);
          const block = ["pending", "ready", "rework_required"].includes(o.status) ? blockOf(o, i) : null;
          const wc = wcs.find((w: any) => w.id === o.work_center_id);
          const mc = machines.find((m: any) => m.id === o.machine_id);
          const remaining = Math.max(0, Number(o.qty_input) - Number(o.qty_processed));
          const inSetup = !!o.setup_started_at && !o.setup_completed_at;
          const holdStart = o.status === "on_hold" ? [...mine].reverse().find((e: any) => e.event_type === "status_change" && e.payload?.to === "on_hold")?.at : null;
          const yieldPct = Number(o.qty_processed) > 0 ? Math.round((Number(o.qty_yield) / Number(o.qty_processed)) * 1000) / 10 : null;
          return (
            <div key={o.id} className="rounded-xl border border-border/50 bg-card/40 p-3" data-testid={`op-${o.sequence}`}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="font-mono text-xs text-muted-foreground">{o.sequence}</span><b>{o.name}</b><StatusPill s={o.status} />
                    {o.requires_approval && <span className={`rounded-full border px-2 py-0.5 text-[10px] ${o.approved_at ? "border-success/50 text-success" : "border-warning/50 text-warning"}`}>{o.approved_at ? `Approved by ${o.approved_by_name}` : "Needs approval"}</span>}
                    {inSetup && <span className="rounded-full border border-info/50 px-2 py-0.5 text-[10px] text-info">Setup {fmtMin(mins(o.setup_started_at))}</span>}
                  </div>
                  <div className="mt-0.5 text-[11px] text-muted-foreground">
                    Work center {wc ? `${wc.id} · ${wc.name}` : o.work_center_id ?? "—"}{mc ? ` · Machine ${mc.name}` : ""}{o.station_id ? ` · Station ${o.station_id}` : ""}{o.batch_id ? ` · Batch ${o.batch_id}` : ""}
                    {(o.required_fields ?? []).length > 0 && <> · Requires {(o.required_fields as string[]).map((f) => f.replace("_", " ")).join(", ")}</>}
                  </div>
                  {o.status_reason && !["completed"].includes(o.status) && <div className="text-[11px] text-muted-foreground">Last change: {o.status_reason}{o.status === "on_hold" && o.hold_category ? ` (${HOLD_CATS[o.hold_category] ?? o.hold_category}, ${fmtMin(mins(holdStart))})` : ""}</div>}
                  {block && <div className="mt-1 flex items-center gap-1 text-[11px] text-warning"><Lock className="h-3 w-3" />{block}</div>}
                </div>
                {!locked && (
                  <div className="flex flex-wrap items-center gap-1.5">
                    {["pending", "ready", "rework_required"].includes(o.status) && <button className={btn} disabled={!canRecord || !!block || busy} title={block ?? ""} onClick={() => setDlg({ kind: "start", op: o })}><Play className="h-3 w-3" />{o.status === "rework_required" ? "Start rework" : "Start"}</button>}
                    {inSetup && <button className={ghost} disabled={!canRecord || busy} onClick={() => run(() => setup({ data: { operationId: o.id } }), "Setup finished")}><Wrench className="h-3 w-3" />Setup done</button>}
                    {["running", "partially_completed"].includes(o.status) && <>
                      <button className={btn} disabled={!canRecord || inSetup} title={inSetup ? "Finish the setup first" : ""} onClick={() => setDlg({ kind: "confirm", op: o })}><CheckCircle2 className="h-3 w-3" />Confirm / complete</button>
                      <button className={ghost} disabled={!canRecord} onClick={() => setDlg({ kind: "status", op: o, action: "hold" })}><PauseCircle className="h-3 w-3" />Hold</button>
                    </>}
                    {o.status === "on_hold" && <button className={btn} disabled={!canRecord || busy} onClick={() => setDlg({ kind: "status", op: o, action: "resume" })}><PlayCircle className="h-3 w-3" />Resume</button>}
                    {o.requires_approval && !o.approved_at && ["completed", "partially_completed"].includes(o.status) && <button className={ghost} disabled={!canOverride} onClick={() => setDlg({ kind: "approve", op: o })}><ShieldCheck className="h-3 w-3" />Approve</button>}
                    {["running", "partially_completed", "completed"].includes(o.status) && <button className={ghost} disabled={!(canRework || canOverride)} onClick={() => setDlg({ kind: "status", op: o, action: "rework" })}><RotateCcw className="h-3 w-3" />Rework required</button>}
                    {!["completed", "cancelled", "skipped", "blocked"].includes(o.status) && <button className={ghost} disabled={!canOverride} onClick={() => setDlg({ kind: "status", op: o, action: "block" })}><Ban className="h-3 w-3" />Block</button>}
                    {o.status === "blocked" && <button className={ghost} disabled={!canOverride} onClick={() => setDlg({ kind: "status", op: o, action: "unblock" })}><Unlock className="h-3 w-3" />Unblock</button>}
                    {["pending", "ready"].includes(o.status) && <button className={ghost} disabled={!canOverride} onClick={() => setDlg({ kind: "status", op: o, action: "skip" })}><SkipForward className="h-3 w-3" />Skip</button>}
                    {!["completed", "cancelled", "skipped"].includes(o.status) && <button className={ghost} disabled={!canRecord} onClick={() => setDlg({ kind: "exception", op: o })}><AlertTriangle className="h-3 w-3" />Exception</button>}
                  </div>
                )}
              </div>

              <div className="mt-2 grid grid-cols-3 gap-1.5 text-[11px] sm:grid-cols-7">
                <Q l="Input" v={o.qty_input} u={po.uom} />
                <Q l="Processed" v={o.qty_processed} u={po.uom} />
                <Q l="Accepted" v={o.qty_yield} u={po.uom} tone="text-success" />
                <Q l="Rejected" v={o.qty_rejected} u={po.uom} tone="text-warning" />
                <Q l="Scrap" v={o.qty_scrap} u={po.uom} tone="text-destructive" />
                <Q l="Remaining" v={remaining} u={po.uom} />
                <Q l="Yield" v={yieldPct == null ? "—" : `${yieldPct}%`} />
              </div>

              <div className="mt-2 grid grid-cols-2 gap-1.5 text-[11px] sm:grid-cols-6">
                <T l="Started" v={dt(o.started_at)} sub={o.started_by} />
                <T l="Completed" v={dt(o.completed_at)} sub={o.completed_by} />
                <T l="Duration" v={fmtMin(o.actual_duration_min ?? (o.started_at ? mins(o.started_at, o.completed_at) : null))} sub={`plan ${fmtMin(Math.round(Number(o.setup_min) + Number(o.run_min_per_unit) * Number(po.qty)))}`} />
                <T l="Setup" v={fmtMin(o.actual_setup_min ?? (o.setup_started_at ? mins(o.setup_started_at, o.setup_completed_at) : null))} sub={`plan ${o.setup_min} min`} />
                <T l="Processing" v={fmtMin(o.actual_processing_min)} />
                <T l="Waiting / downtime" v={`${fmtMin(o.actual_waiting_min)} / ${fmtMin(o.actual_downtime_min)}`} />
              </div>

              {(o.completion_reason || o.completion_notes || o.approval_comment || Object.keys(o.parameters ?? {}).length > 0) && (
                <div className="mt-2 space-y-0.5 text-[11px] text-muted-foreground">
                  {Object.keys(o.parameters ?? {}).length > 0 && <div>Parameters: {Object.entries(o.parameters).map(([k, v]) => `${k} = ${v}`).join(" · ")}</div>}
                  {o.completion_reason && <div>Completion reason: {o.completion_reason}</div>}
                  {o.completion_notes && <div>Notes: {o.completion_notes}</div>}
                  {o.approval_comment && <div>Approval: {o.approval_comment}</div>}
                </div>
              )}
              <div className="mt-2 whitespace-pre-wrap rounded-lg border border-border/40 bg-background/30 p-2 text-xs"><span className="text-muted-foreground">Work instructions: </span>{o.work_instructions || "—"}</div>
              {mine.length > 0 && (
                <details className="mt-2 text-[11px]">
                  <summary className="cursor-pointer text-muted-foreground">Step history ({mine.length})</summary>
                  <ul className="mt-1 space-y-0.5">
                    {mine.map((e: any) => <li key={e.id}>{dt(e.at)} · {eventLabel(e)} · <span className="text-muted-foreground">{e.actor_name}</span></li>)}
                  </ul>
                </details>
              )}
            </div>
          );
        })}
      </div>

      {dlg?.kind === "start" && <StartDialog po={po} op={dlg.op} ops={ops} machines={machines} stations={stations} batches={batches} onClose={() => setDlg(null)} />}
      {dlg?.kind === "confirm" && <ConfirmDialog po={po} op={dlg.op} batches={batches} onClose={() => setDlg(null)} />}
      {dlg?.kind === "status" && <StatusDialog op={dlg.op} action={dlg.action!} onClose={() => setDlg(null)} />}
      {dlg?.kind === "approve" && <ApproveDialog op={dlg.op} onClose={() => setDlg(null)} />}
      {dlg?.kind === "exception" && <ExceptionDialog po={po} op={dlg.op} machines={machines} onClose={() => setDlg(null)} />}
    </div>
  );
}

function eventLabel(e: any) {
  if (e.event_type === "status_change") return `${OP_STATUS[e.payload?.from]?.label ?? e.payload?.from} → ${OP_STATUS[e.payload?.to]?.label ?? e.payload?.to}${e.reason ? ` — ${e.reason}` : ""}${e.payload?.category ? ` (${HOLD_CATS[e.payload.category] ?? e.payload.category})` : ""}`;
  if (e.event_type === "start") return `Started with input ${e.payload?.input_qty}${e.payload?.machine_id ? ` on ${e.payload.machine_id}` : ""}${e.payload?.batch_id ? `, batch ${e.payload.batch_id}` : ""}`;
  if (e.event_type === "setup_start") return "Setup started";
  if (e.event_type === "setup_end") return `Setup finished (${e.payload?.setup_min} min)`;
  if (e.event_type === "approved") return `Approved${e.reason ? ` — ${e.reason}` : ""}`;
  return e.event_type;
}

const Q = ({ l, v, u, tone }: { l: string; v: unknown; u?: string; tone?: string }) => (
  <div className="rounded-lg border border-border/40 bg-background/30 px-2 py-1"><div className="text-[9px] uppercase text-muted-foreground">{l}</div><div className={`font-mono ${tone ?? ""}`}>{typeof v === "number" || typeof v === "string" ? (typeof v === "number" ? Number(v).toLocaleString() : v) : Number(v ?? 0).toLocaleString()}{u && typeof v !== "string" ? <span className="text-muted-foreground"> {u}</span> : null}</div></div>
);
const T = ({ l, v, sub }: { l: string; v: string; sub?: string | null }) => (
  <div className="rounded-lg border border-border/40 bg-background/30 px-2 py-1"><div className="text-[9px] uppercase text-muted-foreground">{l}</div><div className="font-mono">{v}</div>{sub && <div className="truncate text-[10px] text-muted-foreground">{sub}</div>}</div>
);

function Modal({ title, desc, children, onClose }: { title: string; desc?: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader><DialogTitle>{title}</DialogTitle>{desc && <DialogDescription>{desc}</DialogDescription>}</DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}

function StartDialog({ po, op, ops, machines, stations, batches, onClose }: any) {
  const start = useServerFn(startOperation);
  const { run, busy } = useRun();
  const idx = ops.findIndex((x: any) => x.id === op.id);
  const prev = ops.slice(0, idx).filter((x: any) => !["skipped", "cancelled"].includes(x.status)).at(-1);
  const available = op.status === "rework_required" ? Number(op.qty_rejected || op.qty_input || po.qty) : prev ? Number(prev.qty_yield) - Number(op.qty_input) : Number(po.qty) - Number(op.qty_input);
  const lineStations = stations.filter((s: any) => !po.line_id || s.line_id === po.line_id);
  const [f, setF] = useState({ inputQty: Math.max(0, available), machineId: op.machine_id ?? "", stationId: op.station_id ?? "", batchId: op.batch_id ?? "", withSetup: Number(op.setup_min) > 0 && !op.started_at, params: [{ k: "", v: "" }] });
  const req: string[] = op.required_fields ?? [];
  const setP = (i: number, patch: any) => setF({ ...f, params: f.params.map((p, j) => (j === i ? { ...p, ...patch } : p)) });
  return (
    <Modal title={`${op.status === "rework_required" ? "Start rework" : "Start"} · ${op.name}`} desc={`Order ${po.number} · ${po.product_name}. You are recorded as the operator; the start time is now.`} onClose={onClose}>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className={lbl}>Input quantity ({po.uom}) *<input className={inp} type="number" min={0} step="any" value={f.inputQty} onChange={(e) => setF({ ...f, inputQty: Number(e.target.value) })} /><span>Available: {Math.max(0, available)} {po.uom}{prev ? ` (accepted at "${prev.name}")` : " (order quantity)"}</span></label>
        <label className={lbl}>Machine / equipment{req.includes("machine") ? " *" : ""}<select className={inp} value={f.machineId} onChange={(e) => setF({ ...f, machineId: e.target.value })}><option value="">None</option>{machines.map((m: any) => <option key={m.id} value={m.id} disabled={["fault", "down", "maintenance", "offline"].includes(m.status)}>{m.name} ({m.status})</option>)}</select></label>
        <label className={lbl}>Station<select className={inp} value={f.stationId} onChange={(e) => setF({ ...f, stationId: e.target.value })}><option value="">None</option>{lineStations.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>{lineStations.length === 0 && <span>No stations set up on this line</span>}</label>
        <label className={lbl}>Batch / lot{req.includes("batch") ? " *" : ""}<select className={inp} value={f.batchId} onChange={(e) => setF({ ...f, batchId: e.target.value })}><option value="">None</option>{batches.map((b: any) => <option key={b.id} value={b.id}>{b.number} · {b.lot_number}</option>)}</select></label>
      </div>
      <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={f.withSetup} onChange={(e) => setF({ ...f, withSetup: e.target.checked })} />Start with setup (planned {op.setup_min} min) — press "Setup done" when finished</label>
      <div className="space-y-1">
        <div className="text-[11px] text-muted-foreground">Execution parameters{req.includes("parameters") ? " *" : ""}</div>
        {f.params.map((p, i) => (
          <div key={i} className="flex gap-2">
            <input className={inp} placeholder="Name (e.g. Temperature °C)" value={p.k} onChange={(e) => setP(i, { k: e.target.value })} />
            <input className={inp} placeholder="Value" value={p.v} onChange={(e) => setP(i, { v: e.target.value })} />
          </div>
        ))}
        <button className={ghost} onClick={() => setF({ ...f, params: [...f.params, { k: "", v: "" }] })}>+ Parameter</button>
      </div>
      <div className="flex justify-end gap-2">
        <button className={ghost} onClick={onClose}>Cancel</button>
        <button className={btn} disabled={busy || !(f.inputQty > 0)} onClick={async () => {
          const parameters = Object.fromEntries(f.params.filter((p) => p.k.trim()).map((p) => [p.k.trim(), p.v]));
          if (await run(() => start({ data: { operationId: op.id, inputQty: f.inputQty, machineId: f.machineId || null, stationId: f.stationId || null, batchId: f.batchId || null, withSetup: f.withSetup, parameters } }), `${op.name} started`)) onClose();
        }}><Play className="h-3 w-3" />Start operation</button>
      </div>
    </Modal>
  );
}

function ConfirmDialog({ po, op, batches, onClose }: any) {
  const confirm = useServerFn(confirmOperation);
  const { run, busy } = useRun();
  const { data: reasons = [] } = useWasteReasons();
  const scrapR = reasons.filter((r: any) => (r.kind ?? "scrap") !== "reject");
  const rejectR = reasons.filter((r: any) => ["reject", "both"].includes(r.kind ?? "scrap"));
  const open = Math.max(0, Number(op.qty_input) - Number(op.qty_processed));
  const [f, setF] = useState({ accepted: open, rejected: 0, scrap: 0, scrapReason: "", rejectReason: "", completionReason: "", notes: "", final: true, batchId: op.batch_id ?? "", postGoodsReceipt: true });
  const produced = Number(f.accepted) + Number(f.rejected) + Number(f.scrap);
  const after = Number(op.qty_processed) + produced;
  const short = f.final && after < Number(op.qty_input);
  const req: string[] = op.required_fields ?? [];
  const problems: string[] = [];
  if (produced <= 0 && !f.final) problems.push("Enter a quantity");
  if (after > Number(op.qty_input)) problems.push(`Total processed ${after} exceeds the input of ${op.qty_input}`);
  if (f.scrap > 0 && !f.scrapReason) problems.push("Scrap reason required");
  if (f.rejected > 0 && !f.rejectReason) problems.push("Reject reason required");
  if (f.final && (short || req.includes("completion_reason")) && !f.completionReason.trim()) problems.push(short ? `Completion reason required (only ${after} of ${op.qty_input} processed)` : "Completion reason required");
  if (f.final && req.includes("notes") && !f.notes.trim()) problems.push("Execution notes required");
  if (f.final && req.includes("batch") && !f.batchId) problems.push("Batch / lot required");
  if (f.final && req.includes("machine") && !op.machine_id) problems.push("Machine required — it must be set when the step is started");
  const yieldPct = produced > 0 ? Math.round((f.accepted / produced) * 1000) / 10 : 0;
  return (
    <Modal title={`Confirm quantities · ${op.name}`} desc={`Input ${op.qty_input} ${po.uom} · already processed ${op.qty_processed} · open ${open} ${po.uom}`} onClose={onClose}>
      <div className="grid grid-cols-3 gap-2">
        <label className={lbl}>Accepted *<input className={inp} aria-label="Accepted" type="number" min={0} step="any" value={f.accepted} onChange={(e) => setF({ ...f, accepted: Number(e.target.value) })} /></label>
        <label className={lbl}>Rejected<input className={inp} aria-label="Rejected" type="number" min={0} step="any" value={f.rejected} onChange={(e) => setF({ ...f, rejected: Number(e.target.value) })} /></label>
        <label className={lbl}>Scrap<input className={inp} aria-label="Scrap" type="number" min={0} step="any" value={f.scrap} onChange={(e) => setF({ ...f, scrap: Number(e.target.value) })} /></label>
      </div>
      <div className="rounded-lg border border-border/40 bg-card/40 p-2 text-xs">Produced <b className="font-mono">{produced}</b> {po.uom} = accepted + rejected + scrap · yield <b className="font-mono">{yieldPct}%</b> · remaining after this <b className="font-mono">{Math.max(0, Number(op.qty_input) - after)}</b></div>
      {f.rejected > 0 && <label className={lbl}>Reject reason *<select className={inp} aria-label="Reject reason" value={f.rejectReason} onChange={(e) => setF({ ...f, rejectReason: e.target.value })}><option value="">Choose…</option>{rejectR.map((r: any) => <option key={r.id} value={`${r.code} · ${r.label}`}>{r.code} · {r.label}</option>)}</select></label>}
      {f.scrap > 0 && <label className={lbl}>Scrap reason *<select className={inp} aria-label="Scrap reason" value={f.scrapReason} onChange={(e) => setF({ ...f, scrapReason: e.target.value })}><option value="">Choose…</option>{scrapR.map((r: any) => <option key={r.id} value={`${r.code} · ${r.label}`}>{r.code} · {r.label}</option>)}</select></label>}
      <label className={lbl}>Batch / lot{req.includes("batch") ? " *" : ""}<select className={inp} value={f.batchId} onChange={(e) => setF({ ...f, batchId: e.target.value })}><option value="">None</option>{batches.map((b: any) => <option key={b.id} value={b.id}>{b.number}</option>)}</select></label>
      <div className="flex flex-wrap gap-4 text-xs">
        <label className="flex items-center gap-1"><input type="radio" checked={f.final} onChange={() => setF({ ...f, final: true })} />Complete the operation</label>
        <label className="flex items-center gap-1"><input type="radio" checked={!f.final} onChange={() => setF({ ...f, final: false })} />Partial confirmation (keeps it open)</label>
      </div>
      {f.final && <label className={lbl}>Completion reason{short || req.includes("completion_reason") ? " *" : ""}<input className={inp} placeholder={short ? "Why is less than the input being completed?" : "e.g. Normal completion"} value={f.completionReason} onChange={(e) => setF({ ...f, completionReason: e.target.value })} /></label>}
      <label className={lbl}>Execution notes{f.final && req.includes("notes") ? " *" : ""}<textarea className={`${inp} h-16 py-1`} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></label>
      <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={f.postGoodsReceipt} onChange={(e) => setF({ ...f, postGoodsReceipt: e.target.checked })} />Post goods receipt for accepted quantity (last operation only)</label>
      {problems.length > 0 && <ul className="space-y-0.5 text-[11px] text-destructive">{problems.map((p) => <li key={p}>• {p}</li>)}</ul>}
      <div className="flex justify-end gap-2">
        <button className={ghost} onClick={onClose}>Cancel</button>
        <button className={btn} disabled={busy || problems.length > 0} onClick={async () => {
          if (await run(() => confirm({ data: { operationId: op.id, produced, accepted: f.accepted, rejected: f.rejected, scrap: f.scrap, scrapReason: f.scrapReason || null, rejectReason: f.rejectReason || null, completionReason: f.completionReason || null, notes: f.notes || null, final: f.final, batchId: f.batchId || null, postGoodsReceipt: f.postGoodsReceipt } }), f.final ? `${op.name} completed` : "Partial quantity confirmed")) onClose();
        }}><CheckCircle2 className="h-3 w-3" />{f.final ? "Confirm and complete" : "Confirm partial"}</button>
      </div>
    </Modal>
  );
}

const ACTION_TEXT: Record<string, { title: string; ok: string; reason: boolean }> = {
  hold: { title: "Put operation on hold", ok: "Operation on hold", reason: true },
  resume: { title: "Resume operation", ok: "Operation resumed", reason: false },
  block: { title: "Block operation", ok: "Operation blocked", reason: true },
  unblock: { title: "Unblock operation", ok: "Operation unblocked", reason: false },
  rework: { title: "Mark rework required", ok: "Marked rework required", reason: true },
  skip: { title: "Skip operation", ok: "Operation skipped", reason: true },
};

function StatusDialog({ op, action, onClose }: any) {
  const change = useServerFn(changeOperationStatus);
  const { run, busy } = useRun();
  const t = ACTION_TEXT[action];
  const [reason, setReason] = useState("");
  const [category, setCategory] = useState("waiting");
  return (
    <Modal title={`${t.title} · ${op.name}`} desc={action === "hold" ? "Hold time is counted as waiting or downtime in the step's actual times." : undefined} onClose={onClose}>
      {action === "hold" && <label className={lbl}>Hold type *<select className={inp} value={category} onChange={(e) => setCategory(e.target.value)}>{Object.entries(HOLD_CATS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>}
      <label className={lbl}>Reason{t.reason ? " *" : " (optional)"}<textarea className={`${inp} h-16 py-1`} aria-label="Reason" value={reason} onChange={(e) => setReason(e.target.value)} /></label>
      <div className="flex justify-end gap-2">
        <button className={ghost} onClick={onClose}>Cancel</button>
        <button className={btn} disabled={busy || (t.reason && !reason.trim())} onClick={async () => {
          if (await run(() => change({ data: { operationId: op.id, action, reason: reason || undefined, category } }), t.ok)) onClose();
        }}>{t.title}</button>
      </div>
    </Modal>
  );
}

function ApproveDialog({ op, onClose }: any) {
  const approve = useServerFn(approveOperation);
  const { run, busy } = useRun();
  const [comment, setComment] = useState("");
  return (
    <Modal title={`Approve · ${op.name}`} desc={`Accepted ${op.qty_yield}, rejected ${op.qty_rejected}, scrap ${op.qty_scrap}. The next operation can start only after approval.`} onClose={onClose}>
      <label className={lbl}>Comment<textarea className={`${inp} h-16 py-1`} value={comment} onChange={(e) => setComment(e.target.value)} /></label>
      <div className="flex justify-end gap-2">
        <button className={ghost} onClick={onClose}>Cancel</button>
        <button className={btn} disabled={busy} onClick={async () => { if (await run(() => approve({ data: { operationId: op.id, comment } }), "Operation approved")) onClose(); }}><ShieldCheck className="h-3 w-3" />Approve</button>
      </div>
    </Modal>
  );
}

function ExceptionDialog({ po, op, machines, onClose }: any) {
  const raise = useServerFn(raiseException);
  const { run, busy } = useRun();
  const [f, setF] = useState({ exception_type: "machine_failure", severity: "medium", machine_id: op?.machine_id ?? "", resource: "", reason_code: "", description: "", blocks_execution: false, hold_operation: !!op && ["running", "partially_completed"].includes(op.status) });
  return (
    <Modal title={`Record exception${op ? ` · ${op.name}` : ""}`} desc={`Order ${po.number}. You are recorded as the reporting operator; the start time is now.`} onClose={onClose}>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className={lbl}>Type *<select className={inp} aria-label="Exception type" value={f.exception_type} onChange={(e) => setF({ ...f, exception_type: e.target.value })}>{Object.entries(EX_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
        <label className={lbl}>Severity<select className={inp} value={f.severity} onChange={(e) => setF({ ...f, severity: e.target.value })}>{["low", "medium", "high", "critical"].map((s) => <option key={s}>{s}</option>)}</select></label>
        <label className={lbl}>Machine<select className={inp} value={f.machine_id} onChange={(e) => setF({ ...f, machine_id: e.target.value })}><option value="">None</option>{machines.map((m: any) => <option key={m.id} value={m.id}>{m.name}</option>)}</select></label>
        <label className={lbl}>Other resource<input className={inp} placeholder="Tool, person, utility…" value={f.resource} onChange={(e) => setF({ ...f, resource: e.target.value })} /></label>
        <label className={lbl}>Reason code<input className={inp} placeholder="e.g. MF-HYD-01" value={f.reason_code} onChange={(e) => setF({ ...f, reason_code: e.target.value })} /></label>
      </div>
      <label className={lbl}>Description *<textarea className={`${inp} h-16 py-1`} aria-label="Description" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></label>
      <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={f.blocks_execution} onChange={(e) => setF({ ...f, blocks_execution: e.target.checked })} />Block execution until resolved{op ? " (this operation)" : " (whole order)"}</label>
      {op && ["running", "partially_completed"].includes(op.status) && <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={f.hold_operation} onChange={(e) => setF({ ...f, hold_operation: e.target.checked })} />Put the operation on hold now (time counts as downtime / waiting)</label>}
      <div className="flex justify-end gap-2">
        <button className={ghost} onClick={onClose}>Cancel</button>
        <button className={btn} disabled={busy || !f.description.trim()} onClick={async () => {
          if (await run(() => raise({ data: { ...f, production_order_id: po.id, operation_id: op?.id ?? null, machine_id: f.machine_id || null, line_id: po.line_id ?? null, station_id: op?.station_id ?? null } }), "Exception recorded")) onClose();
        }}><AlertTriangle className="h-3 w-3" />Record exception</button>
      </div>
    </Modal>
  );
}

/* =============================== Exceptions =============================== */

export function ExceptionsPanel({ po, ops }: { po: Po; ops: any[] }) {
  const { data: rows = [] } = useRows("production_exceptions", { eq: { production_order_id: po.id }, order: "started_at" });
  const { data: machines = [] } = useRows("machines", { order: "name", asc: true });
  const [raiseOpen, setRaiseOpen] = useState(false);
  const [resolving, setResolving] = useState<any>(null);
  const canRecord = useCan("execution.record");
  const lc = useListControls(rows.map((x: any) => ({ ...x, type: EX_TYPES[x.exception_type], operation: ops.find((o) => o.id === x.operation_id)?.name ?? "" })), { searchKeys: ["id", "type", "description", "resolution", "reason_code", "machine_id", "resource", "operator_name", "operation", "status"], dateKey: "started_at", exportName: `exceptions-${po.id}` });
  const open = rows.filter((x: any) => x.status === "open").length;
  return (
    <div className={card} data-testid="exceptions-panel">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-semibold"><AlertTriangle className="h-4 w-4 text-warning" />Production exceptions <span className="text-xs font-normal text-muted-foreground">{open} open · {rows.length} total</span></h3>
        <button className={btn} disabled={!canRecord || ["closed", "cancelled"].includes(po.status)} onClick={() => setRaiseOpen(true)}>Record exception</button>
      </div>
      {rows.length > 0 && lc.toolbar}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="text-[10px] uppercase text-muted-foreground"><tr><th className="text-left">ID</th><th className="text-left">Type</th><th className="text-left">Operation / resource</th><th className="text-left">Started → ended</th><th className="text-right">Duration</th><th className="text-left">Description / resolution</th><th className="text-left">Status</th><th /></tr></thead>
          <tbody>
            {lc.visible.map((x: any) => (
              <tr key={x.id} className="border-t border-border/40 align-top">
                <td className="py-1.5 font-mono">{x.id}</td>
                <td>{x.type}<div className="text-[10px] uppercase text-muted-foreground">{x.severity}{x.blocks_execution ? " · blocking" : ""}</div></td>
                <td>{x.operation || "Whole order"}<div className="text-[10px] text-muted-foreground">{[x.machine_id, x.resource, x.reason_code].filter(Boolean).join(" · ") || "—"}</div></td>
                <td className="font-mono text-[10px]">{dt(x.started_at)}<br />{x.ended_at ? dt(x.ended_at) : "…"}</td>
                <td className="text-right font-mono">{fmtMin(mins(x.started_at, x.ended_at))}</td>
                <td className="max-w-[260px]">{x.description}<div className="text-[10px] text-muted-foreground">By {x.operator_name}{x.resolution ? ` · Resolution: ${x.resolution} (${x.resolved_by_name})` : ""}</div></td>
                <td><span className={`rounded-full border px-2 py-0.5 text-[10px] uppercase ${x.status === "open" ? "border-warning/50 text-warning" : "border-success/50 text-success"}`}>{x.status}</span></td>
                <td>{x.status === "open" && <button className={ghost} disabled={!canRecord} onClick={() => setResolving(x)}>Resolve</button>}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={8} className="py-3 text-center text-muted-foreground">No exceptions on this order.</td></tr>}
          </tbody>
        </table>
      </div>
      {rows.length > 0 && lc.pager}
      {raiseOpen && <ExceptionDialog po={po} op={null} machines={machines} onClose={() => setRaiseOpen(false)} />}
      {resolving && <ResolveDialog ex={resolving} op={ops.find((o) => o.id === resolving.operation_id)} onClose={() => setResolving(null)} />}
    </div>
  );
}

function ResolveDialog({ ex, op, onClose }: any) {
  const resolve = useServerFn(resolveException);
  const { run, busy } = useRun();
  const [resolution, setResolution] = useState("");
  const [resume, setResume] = useState(op?.status === "on_hold");
  return (
    <Modal title={`Resolve ${ex.id}`} desc={`${EX_TYPES[ex.exception_type]} · ${ex.description}`} onClose={onClose}>
      <label className={lbl}>Resolution *<textarea className={`${inp} h-16 py-1`} aria-label="Resolution" value={resolution} onChange={(e) => setResolution(e.target.value)} /></label>
      {op?.status === "on_hold" && <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={resume} onChange={(e) => setResume(e.target.checked)} />Resume "{op.name}" now</label>}
      <div className="flex justify-end gap-2">
        <button className={ghost} onClick={onClose}>Cancel</button>
        <button className={btn} disabled={busy || !resolution.trim()} onClick={async () => { if (await run(() => resolve({ data: { id: ex.id, resolution, resume_operation: resume } }), "Exception resolved")) onClose(); }}>Resolve</button>
      </div>
    </Modal>
  );
}

/* =============================== Order holds + modify =============================== */

export function OrderHoldsPanel({ po }: { po: Po }) {
  const { data: holds = [] } = useRows("order_holds", { eq: { production_order_id: po.id }, order: "opened_at" });
  const [placing, setPlacing] = useState(false);
  const [releasing, setReleasing] = useState<any>(null);
  const canRaise = useCan("holds.raise");
  const canRelease = useCan("holds.release") || useCan("execution.override");
  const open = holds.filter((h: any) => h.status === "open");
  const holdable = ["scheduled", "planned", "released", "running", "paused", "hold"].includes(po.status);
  return (
    <div className={card} data-testid="order-holds">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-semibold"><Lock className="h-4 w-4 text-warning" />Order holds <span className="text-xs font-normal text-muted-foreground">{open.length} open · {holds.length} total</span></h3>
        <button className={btn} disabled={!canRaise || !holdable} onClick={() => setPlacing(true)}><Lock className="h-3 w-3" />Place hold</button>
      </div>
      {open.length > 0 && <p className="text-xs text-warning">This order is on hold. No operation can start or confirm quantities until every hold is released.</p>}
      <ul className="space-y-1.5">
        {holds.map((h: any) => (
          <li key={h.id} className="rounded-lg border border-border/40 bg-card/40 p-2 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div><span className={`mr-2 rounded-full border px-2 py-0.5 text-[10px] uppercase ${h.status === "open" ? "border-warning/50 text-warning" : "border-success/50 text-success"}`}>{h.status}</span><b className="capitalize">{h.hold_type}</b> · {h.reason}</div>
              {h.status === "open" && <button className={ghost} disabled={!canRelease} onClick={() => setReleasing(h)}><Unlock className="h-3 w-3" />Release</button>}
            </div>
            <div className="mt-1 text-[11px] text-muted-foreground">Placed {dt(h.opened_at)} by {h.opened_by_name}{h.comments ? ` · ${h.comments}` : ""}{h.prev_status ? ` · order was ${h.prev_status}` : ""}</div>
            {h.status === "released" && <div className="text-[11px] text-muted-foreground">Released {dt(h.released_at)} by {h.released_by_name} · {h.release_comments}</div>}
          </li>
        ))}
        {holds.length === 0 && <li className="text-xs text-muted-foreground">No holds on this order.</li>}
      </ul>
      {placing && <PlaceHoldDialog po={po} onClose={() => setPlacing(false)} />}
      {releasing && <ReleaseHoldDialog hold={releasing} onClose={() => setReleasing(null)} />}
    </div>
  );
}

function PlaceHoldDialog({ po, onClose }: any) {
  const place = useServerFn(placeOrderHold);
  const { run, busy } = useRun();
  const [f, setF] = useState({ hold_type: "quality", reason: "", comments: "" });
  return (
    <Modal title={`Place hold · ${po.number}`} desc="Running operations are put on hold and their hold time is counted as waiting." onClose={onClose}>
      <label className={lbl}>Hold type *<select className={inp} value={f.hold_type} onChange={(e) => setF({ ...f, hold_type: e.target.value })}>{HOLD_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}</select></label>
      <label className={lbl}>Hold reason *<input className={inp} aria-label="Hold reason" value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} /></label>
      <label className={lbl}>Comments<textarea className={`${inp} h-16 py-1`} value={f.comments} onChange={(e) => setF({ ...f, comments: e.target.value })} /></label>
      <div className="flex justify-end gap-2">
        <button className={ghost} onClick={onClose}>Cancel</button>
        <button className={btn} disabled={busy || !f.reason.trim()} onClick={async () => { if (await run(() => place({ data: { orderId: po.id, ...f } }), "Order put on hold")) onClose(); }}><Lock className="h-3 w-3" />Place hold</button>
      </div>
    </Modal>
  );
}

function ReleaseHoldDialog({ hold, onClose }: any) {
  const release = useServerFn(releaseOrderHold);
  const { run, busy } = useRun();
  const [comments, setComments] = useState("");
  return (
    <Modal title="Release hold" desc={`${hold.hold_type} · ${hold.reason}. When the last hold is released the order returns to "${hold.prev_status ?? "released"}". Operations on hold must then be resumed one by one.`} onClose={onClose}>
      <label className={lbl}>Release comments *<textarea className={`${inp} h-16 py-1`} aria-label="Release comments" value={comments} onChange={(e) => setComments(e.target.value)} /></label>
      <div className="flex justify-end gap-2">
        <button className={ghost} onClick={onClose}>Cancel</button>
        <button className={btn} disabled={busy || !comments.trim()} onClick={async () => { if (await run(() => release({ data: { holdId: hold.id, comments } }), "Hold released")) onClose(); }}><Unlock className="h-3 w-3" />Release hold</button>
      </div>
    </Modal>
  );
}

const toLocal = (s?: string | null) => { if (!s) return ""; const d = new Date(s); const p = (n: number) => String(n).padStart(2, "0"); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; };

export function ModifyOrderButton({ po }: { po: Po }) {
  const [open, setOpen] = useState(false);
  const can = useCan("orders.write");
  const locked = ["completed", "finished", "closed", "cancelled"].includes(po.status);
  return (
    <>
      <button className="flex items-center gap-1 rounded-lg border border-border/60 px-3 py-1.5 text-xs hover:text-foreground disabled:opacity-50" disabled={!can || locked} title={locked ? `A ${po.status} order cannot be changed` : ""} onClick={() => setOpen(true)}><Pencil className="h-3 w-3" />Modify order</button>
      {open && <ModifyDialog po={po} onClose={() => setOpen(false)} />}
    </>
  );
}

function ModifyDialog({ po, onClose }: { po: Po; onClose: () => void }) {
  const modify = useServerFn(modifyOrder);
  const { run, busy } = useRun();
  const { data: lines = [] } = useRows("lines", { order: "id", asc: true });
  const running = ["running", "paused"].includes(po.status);
  const [f, setF] = useState({ qty: po.qty, planned_start: toLocal(po.planned_start), planned_end: toLocal(po.planned_end), priority: po.priority ?? "normal", line_id: po.line_id ?? "", shift: po.shift ?? "A", operator: po.operator ?? "", notes: po.notes ?? "", reason: "" });
  return (
    <Modal title={`Modify ${po.number}`} desc="Every change is saved in the order history with the old and new values and your reason." onClose={onClose}>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className={lbl}>Quantity ({po.uom})<input className={inp} type="number" min={0} step="any" value={f.qty} onChange={(e) => setF({ ...f, qty: Number(e.target.value) })} /></label>
        <label className={lbl}>Priority<select className={inp} value={f.priority} onChange={(e) => setF({ ...f, priority: e.target.value })}>{["low", "normal", "high", "urgent"].map((p) => <option key={p}>{p}</option>)}</select></label>
        <label className={lbl}>Planned start<input className={inp} type="datetime-local" value={f.planned_start} onChange={(e) => setF({ ...f, planned_start: e.target.value })} /></label>
        <label className={lbl}>Planned end<input className={inp} type="datetime-local" value={f.planned_end} onChange={(e) => setF({ ...f, planned_end: e.target.value })} /></label>
        <label className={lbl}>Line{running ? " (locked while running)" : ""}<select className={inp} value={f.line_id} disabled={running} onChange={(e) => setF({ ...f, line_id: e.target.value })}><option value="">None</option>{lines.map((l: any) => <option key={l.id} value={l.id}>{l.id} · {l.name}</option>)}</select></label>
        <label className={lbl}>Shift<select className={inp} value={f.shift} onChange={(e) => setF({ ...f, shift: e.target.value })}>{["A", "B", "C"].map((s) => <option key={s}>{s}</option>)}</select></label>
        <label className={lbl}>Responsible operator<input className={inp} value={f.operator} onChange={(e) => setF({ ...f, operator: e.target.value })} /></label>
      </div>
      <label className={lbl}>Notes<textarea className={`${inp} h-14 py-1`} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></label>
      <label className={lbl}>Reason for change *<input className={inp} aria-label="Reason for change" value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} /></label>
      <div className="flex justify-end gap-2">
        <button className={ghost} onClick={onClose}>Cancel</button>
        <button className={btn} disabled={busy || !f.reason.trim()} onClick={async () => {
          const patch: Record<string, unknown> = { qty: f.qty, priority: f.priority, shift: f.shift, operator: f.operator || null, notes: f.notes || null,
            planned_start: f.planned_start ? new Date(f.planned_start).toISOString() : null, planned_end: f.planned_end ? new Date(f.planned_end).toISOString() : null };
          if (!running) patch.line_id = f.line_id || null;
          if (await run(() => modify({ data: { id: po.id, reason: f.reason, patch } }), "Order updated")) onClose();
        }}>Save changes</button>
      </div>
    </Modal>
  );
}

/* =============================== Order history timeline =============================== */

type Ev = { at: string; kind: string; title: string; detail: string; operation: string; by: string };

export function OrderTimeline({ po, ops }: { po: Po; ops: any[] }) {
  const opName = (id?: string | null) => ops.find((o) => o.id === id)?.name ?? "";
  const { data: audit = [] } = useQuery({
    queryKey: ["order_timeline", "audit", po.id, ops.map((o) => o.id).join(",")],
    queryFn: async () => {
      const ids = [po.id, ...ops.map((o) => o.id)];
      const { data, error } = await supabase.from("audit_entries").select("*").in("entity_id", ids).order("at", { ascending: true }).limit(2000);
      if (error) throw error;
      return data ?? [];
    },
  });
  const eq = { production_order_id: po.id };
  const { data: events = [] } = useRows("operation_events", { eq, order: "at", asc: true });
  const { data: confs = [] } = useRows("production_confirmations", { eq });
  const { data: cons = [] } = useRows("material_consumptions", { eq });
  const { data: grs = [] } = useRows("goods_receipts", { eq });
  const { data: acts = [] } = useRows("activity_confirmations", { eq });
  const { data: exs = [] } = useRows("production_exceptions", { eq, order: "started_at" });
  const { data: holds = [] } = useRows("order_holds", { eq, order: "opened_at" });
  const [kind, setKind] = useState("");

  const all = useMemo<Ev[]>(() => {
    const out: Ev[] = [];
    if (po.created_at) out.push({ at: po.created_at, kind: "Order", title: "Order created", detail: `${po.qty} ${po.uom} ${po.product_name}`, operation: "", by: "" });
    audit.forEach((a: any) => {
      if (a.entity === "order_operation" || a.action?.startsWith("hold:") || a.action?.startsWith("exception:")) return; // shown from their own records
      const t = a.action === "modify" ? "Order modified" : a.action?.startsWith("status:") ? `Order ${a.action.slice(7)}` : a.action;
      const diff = a.action === "modify" && a.after_data ? Object.keys(a.after_data).map((k) => `${k}: ${fmtV(a.before_data?.[k])} → ${fmtV(a.after_data[k])}`).join("; ") : "";
      out.push({ at: a.at, kind: "Order", title: t, detail: [a.summary, diff].filter(Boolean).join(" · "), operation: "", by: a.actor_name });
    });
    events.forEach((e: any) => out.push({ at: e.at, kind: "Operation", title: e.event_type === "status_change" ? `Operation ${OP_STATUS[e.payload?.to]?.label.toLowerCase() ?? e.payload?.to}` : e.event_type === "start" ? "Operation started" : e.event_type.replace("_", " "), detail: eventLabel(e), operation: opName(e.operation_id), by: e.actor_name ?? "" }));
    confs.forEach((c: any) => {
      out.push({ at: c.created_at, kind: "Quantity", title: c.final ? "Final quantity confirmed" : "Partial quantity confirmed", detail: `Produced ${c.qty_produced ?? Number(c.qty_yield) + Number(c.qty_scrap) + Number(c.qty_rejected ?? 0)} · accepted ${c.qty_yield} · rejected ${c.qty_rejected ?? 0}${c.reject_reason ? ` (${c.reject_reason})` : ""} · scrap ${c.qty_scrap}${c.scrap_reason ? ` (${c.scrap_reason})` : ""}${c.completion_reason ? ` · ${c.completion_reason}` : ""}${c.notes ? ` · ${c.notes}` : ""}`, operation: opName(c.operation_id), by: c.actor_name ?? "" });
      if (Number(c.qty_scrap) > 0) out.push({ at: c.created_at, kind: "Scrap", title: `${c.qty_scrap} ${po.uom} scrapped`, detail: c.scrap_reason ?? "", operation: opName(c.operation_id), by: c.actor_name ?? "" });
    });
    cons.forEach((m: any) => out.push({ at: m.created_at, kind: "Material", title: `${m.component_sku} consumed`, detail: `${m.qty} ${m.uom}${m.input_lot ? ` · lot ${m.input_lot}` : ""}${m.backflush ? " · backflush" : ""}`, operation: opName(m.operation_id), by: m.actor_name ?? "" }));
    grs.forEach((g: any) => out.push({ at: g.created_at, kind: "Output", title: `${String(g.receipt_type).replace("_", "-")} received`, detail: `${g.sku} ${g.qty} ${g.uom}${g.lot_number ? ` · lot ${g.lot_number}` : ""}`, operation: "", by: g.actor_name ?? "" }));
    acts.forEach((a: any) => out.push({ at: a.created_at, kind: "Time", title: `${a.activity_type} time recorded`, detail: `${a.minutes} min × ${a.people}`, operation: opName(a.operation_id), by: a.actor_name ?? "" }));
    exs.forEach((x: any) => {
      out.push({ at: x.started_at, kind: "Exception", title: `${EX_TYPES[x.exception_type]} raised`, detail: `${x.id} · ${x.description}${x.blocks_execution ? " · blocking" : ""}`, operation: opName(x.operation_id), by: x.operator_name ?? "" });
      if (x.ended_at) out.push({ at: x.ended_at, kind: "Exception", title: "Exception resolved", detail: `${x.id} · ${x.resolution ?? ""}`, operation: opName(x.operation_id), by: x.resolved_by_name ?? "" });
    });
    holds.forEach((h: any) => {
      out.push({ at: h.opened_at, kind: "Hold", title: "Order put on hold", detail: `${h.hold_type} · ${h.reason}${h.comments ? ` · ${h.comments}` : ""}`, operation: "", by: h.opened_by_name ?? "" });
      if (h.released_at) out.push({ at: h.released_at, kind: "Hold", title: "Released from hold", detail: h.release_comments ?? "", operation: "", by: h.released_by_name ?? "" });
    });
    return out.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  }, [po, audit, events, confs, cons, grs, acts, exs, holds, ops]);

  const kinds = Array.from(new Set(all.map((e) => e.kind)));
  const rows = kind ? all.filter((e) => e.kind === kind) : all;
  const lc = useListControls(rows, { searchKeys: ["title", "detail", "operation", "by", "kind"], dateKey: "at", exportName: `history-${po.id}` });
  return (
    <div className={card} data-testid="order-timeline">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-semibold"><History className="h-4 w-4 text-primary" />Order history <span className="text-xs font-normal text-muted-foreground">{all.length} events</span></h3>
        <select className="h-8 rounded-lg border border-border/60 bg-card/60 px-2 text-xs" value={kind} onChange={(e) => setKind(e.target.value)} aria-label="Event type">
          <option value="">All event types</option>{kinds.map((k) => <option key={k}>{k}</option>)}
        </select>
      </div>
      {lc.toolbar}
      <ol className="relative space-y-2 border-l border-border/50 pl-4">
        {lc.visible.map((e, i) => (
          <li key={i} className="text-xs">
            <span className="absolute -left-[5px] mt-1 h-2.5 w-2.5 rounded-full border border-primary/60 bg-background" />
            <div className="flex flex-wrap items-center gap-2"><Clock className="h-3 w-3 text-muted-foreground" /><span className="font-mono text-[11px] text-muted-foreground">{new Date(e.at).toLocaleString()}</span><span className="rounded border border-border/60 px-1.5 text-[10px] uppercase text-muted-foreground">{e.kind}</span><b>{e.title}</b>{e.operation && <span className="text-muted-foreground">· {e.operation}</span>}</div>
            <div className="text-[11px] text-muted-foreground">{e.detail}{e.by ? ` — ${e.by}` : ""}</div>
          </li>
        ))}
        {rows.length === 0 && <li className="text-xs text-muted-foreground">No events yet.</li>}
      </ol>
      {lc.pager}
    </div>
  );
}
const fmtV = (v: unknown) => (v == null || v === "" ? "—" : typeof v === "string" && /^\d{4}-\d\d-\d\dT/.test(v) ? new Date(v).toLocaleString() : String(v));
