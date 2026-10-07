import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Smartphone, Play, Pause, RotateCcw, Cpu, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useRows } from "@/lib/execution-db";
import { startOperation, changeOperationStatus } from "@/lib/mes/operations.functions";
import { sendMachineCommand } from "@/lib/mes/machines.functions";
import { OperatorSwitch } from "@/components/operator-switch";
import { FloorModeToggle } from "@/components/floor-mode";
import { AndonCallButton } from "@/components/andon-call";

export const Route = createFileRoute("/_authenticated/mobile")({
  head: () => ({
    meta: [
      { title: "Operator App · Cortanex MES" },
      { name: "description", content: "Phone-sized operator view of the shop floor: live step status per station and machine commands." },
      { property: "og:title", content: "Operator App · Cortanex MES" },
      { property: "og:description", content: "Live step status and machine commands for operators on the floor." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MobileApp,
});

const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));
const TONE: Record<string, string> = { running: "bg-success/20 text-success", ready: "bg-primary/20 text-primary", on_hold: "bg-warning/20 text-warning", blocked: "bg-destructive/20 text-destructive", completed: "bg-muted text-muted-foreground" };

function MobileApp() {
  const qc = useQueryClient();
  const { data: stations = [] } = useRows<any>("stations", { order: "sequence", asc: true });
  const [stationId, setStationId] = useState("");
  const station = stations.find((s) => s.id === stationId);
  const { data: ops = [] } = useRows<any>("order_operations", { order: "sequence", asc: true });
  const { data: orders = [] } = useRows<any>("production_orders");
  const { data: machines = [] } = useRows<any>("machines", { order: "name", asc: true });
  const { data: cmds = [] } = useRows<any>("machine_commands");
  const start = useServerFn(startOperation);
  const status = useServerFn(changeOperationStatus);
  const send = useServerFn(sendMachineCommand);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("mobile-station");
    if (saved) setStationId(saved);
    const ch = supabase.channel("rt-mobile")
      .on("postgres_changes", { event: "*", schema: "public", table: "order_operations" }, () => qc.invalidateQueries({ queryKey: ["exec", "order_operations"] }))
      .on("postgres_changes", { event: "*", schema: "public", table: "machine_commands" }, () => qc.invalidateQueries({ queryKey: ["exec", "machine_commands"] }))
      .on("postgres_changes", { event: "*", schema: "public", table: "machines" }, () => qc.invalidateQueries({ queryKey: ["exec", "machines"] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  const pick = (id: string) => { setStationId(id); localStorage.setItem("mobile-station", id); };
  const openOrders = orders.filter((o) => !["completed", "closed", "cancelled"].includes(o.status) && (!station || o.line_id === station.line_id));
  const mySteps = ops.filter((p) => openOrders.some((o) => o.id === p.production_order_id) && p.status !== "completed" && (!p.station_id || p.station_id === stationId));
  const myMachines = machines.filter((m) => m.station_id === stationId);

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    try { await fn(); toast.success(ok); qc.invalidateQueries({ queryKey: ["exec"] }); } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  };

  const b = "flex h-11 flex-1 items-center justify-center gap-1.5 rounded-xl text-sm font-medium disabled:opacity-40";
  return (
    <div className="mx-auto max-w-md space-y-4 pb-10">
      <div className="flex items-center justify-between">
        <h1 className="flex items-center gap-2 font-display text-xl font-semibold"><Smartphone className="h-5 w-5 text-primary" />Operator App</h1>
        <span className="flex items-center gap-1 text-[10px] text-success"><span className="h-2 w-2 animate-pulse rounded-full bg-success" />Live</span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <OperatorSwitch />
        <FloorModeToggle />
        {stationId && <AndonCallButton stationId={stationId} stationName={stations.find((s) => s.id === stationId)?.name} />}
      </div>
      <select aria-label="My station" className="h-11 w-full rounded-xl border border-border/60 bg-card/60 px-3 text-sm" value={stationId} onChange={(e) => pick(e.target.value)}>
        <option value="">Choose my station…</option>
        {stations.map((s) => <option key={s.id} value={s.id}>{s.name} · {s.line_id}</option>)}
      </select>

      {stationId && <>
        <h2 className="text-xs uppercase tracking-wider text-muted-foreground">My steps ({mySteps.length})</h2>
        {mySteps.length === 0 && <p className="glass-panel rounded-2xl p-4 text-sm text-muted-foreground">No open steps for this station.</p>}
        {mySteps.map((p) => {
          const o = orders.find((x) => x.id === p.production_order_id);
          return (
            <div key={p.id} className="glass-panel space-y-3 rounded-2xl p-4" data-testid={`m-op-${p.id}`}>
              <div className="flex items-start justify-between gap-2">
                <div><div className="font-semibold">{p.sequence}. {p.name}</div><div className="text-xs text-muted-foreground">{o?.id} · {o?.product_name} · {o?.qty} {o?.uom}</div></div>
                <span className={`rounded-md px-2 py-0.5 text-[10px] uppercase ${TONE[p.status] ?? "bg-muted text-muted-foreground"}`}>{p.status}</span>
              </div>
              {p.status_reason && <p className="text-xs text-warning">{p.status_reason}</p>}
              <div className="flex gap-2">
                {["ready", "pending", "planned"].includes(p.status) && <button disabled={busy} className={`${b} bg-success text-success-foreground`} onClick={() => run(() => start({ data: { operationId: p.id, inputQty: Number(o?.qty ?? 0), stationId } }), "Step started")}><Play className="h-4 w-4" />Start</button>}
                {p.status === "running" && <button disabled={busy} className={`${b} bg-warning text-warning-foreground`} onClick={() => { const r = prompt("Why are you pausing?"); if (r) run(() => status({ data: { operationId: p.id, action: "hold", reason: r } }), "Step on hold"); }}><Pause className="h-4 w-4" />Hold</button>}
                {p.status === "on_hold" && <button disabled={busy} className={`${b} bg-primary text-primary-foreground`} onClick={() => run(() => status({ data: { operationId: p.id, action: "resume" } }), "Step resumed")}><RotateCcw className="h-4 w-4" />Resume</button>}
                <Link to="/production-orders/$poId" params={{ poId: p.production_order_id }} className={`${b} border border-border/60`}><ExternalLink className="h-4 w-4" />Record / finish</Link>
              </div>
            </div>
          );
        })}

        <h2 className="text-xs uppercase tracking-wider text-muted-foreground">My machines ({myMachines.length})</h2>
        {myMachines.length === 0 && <p className="glass-panel rounded-2xl p-4 text-sm text-muted-foreground">No machines at this station.</p>}
        {myMachines.map((m) => {
          const signed = m.safety_status === "approved" && (!m.safety_valid_until || new Date(m.safety_valid_until) > new Date());
          const last = cmds.filter((c) => c.machine_id === m.id).slice(0, 3);
          return (
            <div key={m.id} className="glass-panel space-y-2 rounded-2xl p-4">
              <div className="flex items-center justify-between"><div className="flex items-center gap-2 font-semibold"><Cpu className="h-4 w-4 text-primary" />{m.name}</div><span className={`text-[10px] uppercase ${signed ? "text-success" : "text-destructive"}`}>{signed ? "safety signed" : "commands locked"}</span></div>
              <div className="text-xs text-muted-foreground">{m.protocol} · {m.connection_mode} · {m.status}</div>
              <div className="grid grid-cols-2 gap-2">
                {(m.commands ?? []).map((c: any) => (
                  <button key={c.name} disabled={busy || !signed} className="h-11 rounded-xl border border-border/60 bg-card/60 text-sm disabled:opacity-40"
                    onClick={() => { const reason = c.safety ? prompt(`"${c.name}" is safety-relevant. Reason?`) ?? "" : undefined; if (c.safety && !reason) return; run(() => send({ data: { machineId: m.id, command: c.name, reason } }), `${c.name} sent`); }}>{c.name}</button>
                ))}
              </div>
              {last.map((c) => <div key={c.id} className="text-[11px] text-muted-foreground">{new Date(c.created_at).toLocaleTimeString()} · {c.command} · {c.status}</div>)}
            </div>
          );
        })}
      </>}
    </div>
  );
}
