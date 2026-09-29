import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ClipboardCheck, GraduationCap, AlertTriangle } from "lucide-react";
import { getOperationQuality, recordInspection, raiseNonconformance } from "@/lib/mes/quality.functions";
import { errMsg } from "@/lib/execution-db";
import { useCan } from "@/lib/access";

const inp = "h-8 w-full rounded-lg border border-border/60 bg-card/60 px-2 text-xs focus:border-primary/50 focus:outline-none";
const btn = "flex h-7 items-center gap-1 rounded-lg bg-primary px-2.5 text-[11px] font-medium text-primary-foreground disabled:opacity-50";
const ghost = "flex h-7 items-center gap-1 rounded-lg border border-border/60 px-2 text-[11px] disabled:opacity-40";

/** Skills, inspections and nonconformances for one order step. */
export function StepQuality({ op, locked }: { op: any; locked: boolean }) {
  const get = useServerFn(getOperationQuality);
  const rec = useServerFn(recordInspection);
  const raise = useServerFn(raiseNonconformance);
  const qc = useQueryClient();
  const canRecord = useCan("execution.record");
  const { data } = useQuery({ queryKey: ["exec", "op_quality", op.id, op.status, op.qty_processed], queryFn: () => get({ data: { operationId: op.id } }) });
  const [vals, setVals] = useState<Record<string, Record<string, string>>>({});
  const [nc, setNc] = useState<{ qty: string; severity: string; description: string } | null>(null);
  const [busy, setBusy] = useState(false);
  if (!data) return null;
  const active = ["running", "partially_completed", "on_hold"].includes(op.status);
  const notStarted = ["pending", "ready", "rework_required"].includes(op.status);
  if (!data.plans.length && !data.requiredSkills.length && !data.nonconformances.length && !data.results.length) return null;
  const done = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    try { await fn(); toast.success(ok); qc.invalidateQueries({ queryKey: ["exec"] }); return true; }
    catch (e) { toast.error(errMsg(e)); return false; } finally { setBusy(false); }
  };

  return (
    <div className="mt-2 space-y-2 rounded-lg border border-border/40 bg-background/30 p-2 text-[11px]" data-testid={`quality-${op.sequence}`}>
      {data.requiredSkills.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <GraduationCap className="h-3.5 w-3.5 text-primary" /> Requires: {data.requiredSkills.join(", ")}
          {notStarted && (data.missingSkills.length
            ? <span className="text-destructive">· You are not qualified (missing {data.missingSkills.join(", ")}) — start is blocked</span>
            : <span className="text-success">· You are qualified</span>)}
        </div>
      )}
      {data.plans.map((p: any) => {
        const v = vals[p.id] ?? {};
        return (
          <div key={p.id} className="space-y-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <ClipboardCheck className="h-3.5 w-3.5 text-primary" />
              <Link to="/inspection-plans/$planId" params={{ planId: p.id }} className="font-medium hover:text-primary">{p.name}</Link>
              <span className={p.recorded >= p.required ? "text-success" : "text-warning"}>{p.recorded} / {p.required} sample(s)</span>
              <span className="text-muted-foreground">· {p.sampling === "every_qty" ? `every ${p.sample_every}` : "once per step"} · {p.performed_by === "qa_portal" ? "done by QA portal" : "recorded here"}</span>
            </div>
            {active && !locked && p.performed_by === "local" && (
              <div className="flex flex-wrap items-end gap-1.5">
                {(p.characteristics ?? []).map((ch: any) => (
                  <label key={ch.name} className="w-36 space-y-0.5 text-muted-foreground">
                    <span>{ch.name}{ch.type === "numeric" ? ` (${ch.min ?? "–"}…${ch.max ?? "–"}${ch.unit ? ` ${ch.unit}` : ""})` : ""}</span>
                    {ch.type === "pass_fail"
                      ? <select aria-label={ch.name} className={inp} value={v[ch.name] ?? ""} onChange={(e) => setVals({ ...vals, [p.id]: { ...v, [ch.name]: e.target.value } })}><option value="">—</option><option value="pass">Pass</option><option value="fail">Fail</option></select>
                      : <input aria-label={ch.name} type="number" step="any" className={inp} value={v[ch.name] ?? ""} onChange={(e) => setVals({ ...vals, [p.id]: { ...v, [ch.name]: e.target.value } })} />}
                  </label>
                ))}
                <button className={btn} disabled={!canRecord || busy} onClick={() => done(async () => {
                  const r = await rec({ data: { operationId: op.id, planId: p.id, values: v } });
                  if (r.result === "fail") toast.warning(`Failed: ${r.failed.join(", ")} — nonconformance sent to QA`);
                  setVals({ ...vals, [p.id]: {} });
                }, "Inspection recorded")}>Record sample</button>
              </div>
            )}
          </div>
        );
      })}
      {data.results.length > 0 && (
        <details><summary className="cursor-pointer text-muted-foreground">Inspection results ({data.results.length})</summary>
          <ul className="mt-1 space-y-0.5">{data.results.map((r: any) => (
            <li key={r.id}><span className={r.result === "pass" ? "text-success" : "text-destructive"}>{r.result.toUpperCase()}</span> · sample {r.sample_no} · {Object.entries(r.values ?? {}).map(([k, x]) => `${k}=${x}`).join(", ") || "—"}{r.failed_checks?.length ? ` · ${r.failed_checks.join("; ")}` : ""} · {r.source === "qa_portal" ? "QA portal" : "local"} · {r.inspector_name}</li>
          ))}</ul>
        </details>
      )}
      {data.nonconformances.map((n: any) => (
        <div key={n.id} className="flex flex-wrap items-center gap-1.5">
          <AlertTriangle className="h-3.5 w-3.5 text-warning" />
          <Link to="/nonconformance/$ncId" params={{ ncId: n.id }} className="font-mono text-primary">{n.id}</Link>
          <span>{n.description}</span>
          <span className={n.status === "open" ? "text-warning" : "text-success"}>{n.status === "open" ? "waiting for QA decision" : `QA: ${String(n.decision).replace(/_/g, " ")}`}</span>
        </div>
      ))}
      {!locked && !notStarted && (nc ? (
        <div className="flex flex-wrap items-end gap-1.5">
          <label className="w-20 space-y-0.5 text-muted-foreground">Qty<input className={inp} type="number" value={nc.qty} onChange={(e) => setNc({ ...nc, qty: e.target.value })} /></label>
          <label className="w-24 space-y-0.5 text-muted-foreground">Severity<select className={inp} value={nc.severity} onChange={(e) => setNc({ ...nc, severity: e.target.value })}><option value="minor">Minor</option><option value="major">Major</option><option value="critical">Critical</option></select></label>
          <label className="min-w-48 flex-1 space-y-0.5 text-muted-foreground">Description<input className={inp} value={nc.description} onChange={(e) => setNc({ ...nc, description: e.target.value })} /></label>
          <button className={btn} disabled={busy} onClick={async () => { if (await done(() => raise({ data: { operationId: op.id, qty: Number(nc.qty || 0), severity: nc.severity, description: nc.description } }), "Nonconformance sent to QA")) setNc(null); }}>Send to QA</button>
          <button className={ghost} onClick={() => setNc(null)}>Cancel</button>
        </div>
      ) : <button className={ghost} disabled={!canRecord} onClick={() => setNc({ qty: "", severity: "major", description: "" })}><AlertTriangle className="h-3 w-3" />Raise nonconformance</button>)}
    </div>
  );
}
