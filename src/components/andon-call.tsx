import { useState } from "react";
import { toast } from "sonner";
import { BellRing, Check, CheckCheck, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useRows, useWrite, errMsg } from "@/lib/execution-db";
import { useMyOrg } from "@/lib/wip-db";
import { btn, ghost, inp } from "@/components/qp-ui";

const KINDS = [
  { id: "supervisor", label: "Supervisor" },
  { id: "maintenance", label: "Maintenance" },
  { id: "quality", label: "Quality" },
] as const;

/** Call-for-help button for station screens. Creates an Andon call and alerts the right people. */
export function AndonCallButton({ stationId, stationName }: { stationId?: string; stationName?: string }) {
  const { data: org } = useMyOrg();
  const w = useWrite("andon_calls");
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<string>("supervisor");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const send = async () => {
    setBusy(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      const name = u.user?.user_metadata?.full_name || u.user?.email || "Operator";
      await w.insert.mutateAsync({ organization_id: org, station_id: stationId ?? null, kind, message: msg.trim() || null, created_by: u.user?.id ?? null, created_by_name: name });
      toast.success(`${KINDS.find((k) => k.id === kind)?.label} has been called`);
      setOpen(false); setMsg("");
    } catch (e) { toast.error(errMsg(e)); }
    finally { setBusy(false); }
  };

  return (
    <>
      <button className={ghost + " flex items-center gap-1.5 border-warning/50 text-warning"} onClick={() => setOpen(true)} title="Call for help">
        <BellRing className="h-3.5 w-3.5" />Call for help
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setOpen(false)}>
          <div className="glass-panel w-full max-w-sm space-y-3 rounded-2xl p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-sm font-semibold"><BellRing className="h-4 w-4 text-warning" />Call for help{stationName ? ` · ${stationName}` : ""}</h3>
              <button className={ghost} onClick={() => setOpen(false)}><X className="h-4 w-4" /></button>
            </div>
            <div className="flex gap-2">
              {KINDS.map((k) => (
                <button key={k.id} onClick={() => setKind(k.id)}
                  className={`flex-1 rounded-lg border px-2 py-2 text-xs ${kind === k.id ? "border-primary bg-primary/15 font-semibold" : "border-border/60 text-muted-foreground"}`}>{k.label}</button>
              ))}
            </div>
            <label className="block text-xs">What do you need? (optional)
              <textarea className={inp + " h-16 py-1"} value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="e.g. seal jaw sticking again" />
            </label>
            <button className={btn} disabled={busy} onClick={send}>{busy ? "Calling…" : "Call now"}</button>
          </div>
        </div>
      )}
    </>
  );
}

/** Open Andon calls list with acknowledge / resolve — shown on the Andon / Downtime page. */
export function AndonCallsPanel() {
  const { data: calls = [] } = useRows<any>("andon_calls", { order: "created_at", asc: false });
  const w = useWrite("andon_calls");
  const open = calls.filter((c: any) => c.status !== "resolved");
  if (calls.length === 0) return null;
  const act = async (c: any, action: "ack" | "resolve") => {
    try {
      const { data: u } = await supabase.auth.getUser();
      const name = u.user?.user_metadata?.full_name || u.user?.email || "User";
      await w.update.mutateAsync({ id: c.id, patch: action === "ack"
        ? { status: "acknowledged", acknowledged_by: name, acknowledged_at: new Date().toISOString() }
        : { status: "resolved", resolved_by: name, resolved_at: new Date().toISOString() } });
      toast.success(action === "ack" ? "Acknowledged" : "Resolved");
    } catch (e) { toast.error(errMsg(e)); }
  };
  return (
    <div className="glass-panel rounded-2xl p-5">
      <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold"><BellRing className="h-4 w-4 text-warning" />Calls for help {open.length > 0 && <span className="rounded-full bg-warning/15 px-2 py-0.5 text-[10px] text-warning">{open.length} open</span>}</h2>
      <div className="space-y-1.5 text-xs">
        {calls.slice(0, 20).map((c: any) => (
          <div key={c.id} className="flex flex-wrap items-center gap-2 border-t border-border/40 py-1.5">
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${c.status === "open" ? "bg-destructive/15 text-destructive" : c.status === "acknowledged" ? "bg-warning/15 text-warning" : "bg-emerald-500/15 text-emerald-400"}`}>{c.status}</span>
            <b>{c.kind}</b>
            {c.station_id && <span className="text-muted-foreground">at {c.station_id}</span>}
            <span className="text-muted-foreground">{c.message ?? "Help requested"}</span>
            <span className="ml-auto text-[10px] text-muted-foreground">{c.created_by_name} · {new Date(c.created_at).toLocaleString()}</span>
            {c.status === "open" && <button className={ghost} onClick={() => act(c, "ack")}><Check className="h-3 w-3" />Acknowledge</button>}
            {c.status !== "resolved" && <button className={ghost} onClick={() => act(c, "resolve")}><CheckCheck className="h-3 w-3" />Resolve</button>}
          </div>
        ))}
      </div>
    </div>
  );
}
