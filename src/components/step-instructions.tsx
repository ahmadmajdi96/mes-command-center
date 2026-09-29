import { useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, Circle, Wrench } from "lucide-react";
import { useRows, useWrite, errMsg } from "@/lib/execution-db";
import { toolState } from "@/lib/tools";
import { supabase } from "@/integrations/supabase/client";

/** Work-instruction checklist and tool use for one order step. */
export function StepInstructions({ op, locked }: { op: any; locked: boolean }) {
  const { data: order } = useRows<any>("production_orders", { eq: { id: op.production_order_id } });
  const productId = order?.[0]?.product_id;
  const { data: all = [] } = useRows<any>("instruction_steps", { order: "step_no", asc: true });
  const { data: acks = [] } = useRows<any>("instruction_acks", { eq: { order_operation_id: op.id } });
  const { data: tools = [] } = useRows<any>("tools", { order: "code", asc: true });
  const { data: uses = [] } = useRows<any>("tool_usages", { eq: { order_operation_id: op.id } });
  const ackW = useWrite("instruction_acks");
  const useW = useWrite("tool_usages");
  const [tool, setTool] = useState("");
  const steps = all.filter((s) => s.operation_name.toLowerCase() === String(op.name).toLowerCase() && (!s.product_id || s.product_id === productId));
  const running = op.status === "running";
  const available = tools.filter((t) => !t.station_id || t.station_id === op.station_id);
  if (steps.length === 0 && available.length === 0) return null;

  const me = async () => {
    const { data } = await supabase.auth.getUser();
    const { data: p } = await supabase.from("profiles").select("full_name,email").eq("id", data.user!.id).maybeSingle();
    return { id: data.user!.id, name: p?.full_name ?? p?.email ?? null };
  };
  const ack = async (stepId: string) => {
    try { const u = await me(); await ackW.insert.mutateAsync({ organization_id: op.organization_id, order_operation_id: op.id, step_id: stepId, acked_by: u.id, acked_by_name: u.name }); }
    catch (e) { toast.error(errMsg(e)); }
  };
  const recordTool = async () => {
    if (!tool) return;
    try { const u = await me(); await useW.insert.mutateAsync({ organization_id: op.organization_id, tool_id: tool, order_operation_id: op.id, used_by: u.id, used_by_name: u.name }); toast.success("Tool use recorded"); setTool(""); }
    catch (e) { toast.error(errMsg(e)); }
  };

  return (
    <div className="mt-2 space-y-2 rounded-lg border border-border/40 bg-background/30 p-3 text-xs" data-testid={`instructions-${String(op.sequence).padStart(2, "0")}`}>
      {steps.length > 0 && (<div>
        <div className="mb-1 font-semibold">Work instructions ({acks.length}/{steps.filter((s) => s.requires_ack).length} confirmed)</div>
        <ol className="space-y-1">{steps.map((s) => {
          const a = acks.find((x) => x.step_id === s.id);
          return (<li key={s.id} className="flex items-start gap-2">
            {a ? <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 text-success" /> : <Circle className="mt-0.5 h-3.5 w-3.5 text-muted-foreground" />}
            <div className="flex-1"><div className="font-medium">{s.step_no}. {s.title}</div>{s.body && <div className="whitespace-pre-wrap text-muted-foreground">{s.body}</div>}
              {s.image_url && <img src={s.image_url} alt={s.title} className="mt-1 max-h-32 rounded" />}
              {a && <div className="text-[10px] text-muted-foreground">Confirmed by {a.acked_by_name ?? "—"} · {new Date(a.created_at).toLocaleString()}</div>}</div>
            {!a && s.requires_ack && running && !locked && <button className="rounded border border-border/60 px-2 py-0.5 hover:text-foreground" onClick={() => ack(s.id)}>Confirm done</button>}
          </li>);
        })}</ol>
        {!running && steps.some((s) => s.requires_ack) && acks.length === 0 && <div className="mt-1 text-muted-foreground">Start the step to confirm instructions.</div>}
      </div>)}
      {available.length > 0 && (<div>
        <div className="mb-1 flex items-center gap-1 font-semibold"><Wrench className="h-3 w-3" />Tools used</div>
        {uses.map((u) => <div key={u.id} className="text-muted-foreground">{tools.find((t) => t.id === u.tool_id)?.code} · {u.used_by_name} · {new Date(u.created_at).toLocaleString()}</div>)}
        {running && !locked && (<div className="mt-1 flex gap-2">
          <select className="h-8 flex-1 rounded border border-border/60 bg-card/60 px-2" value={tool} onChange={(e) => setTool(e.target.value)}>
            <option value="">Choose tool…</option>
            {available.map((t) => { const st = toolState(t); return <option key={t.id} value={t.id}>{t.code} · {t.name} · {st.label}</option>; })}
          </select>
          <button className="rounded border border-border/60 px-2" onClick={recordTool}>Record use</button>
        </div>)}
      </div>)}
    </div>
  );
}
