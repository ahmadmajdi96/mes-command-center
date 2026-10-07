import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { HeartPulse, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useRows, errMsg } from "@/lib/execution-db";
import { supabase } from "@/integrations/supabase/client";
import { PageHead } from "@/components/qp-ui";
import { useCanAny } from "@/lib/access";

export const Route = createFileRoute("/_authenticated/integration-health")({
  head: () => ({ meta: [
    { title: "Integration health · Cortanex MES" },
    { name: "description", content: "Status of ERP, QA and maintenance connections with failures, retries and API key expiry." },
    { property: "og:title", content: "Integration health · Cortanex MES" },
    { property: "og:description", content: "Last success, failures and retry for every connection." },
  ] }),
  component: HealthPage,
});

const fmt = (d?: string | null) => (d ? new Date(d).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "never");
const ago = (d?: string | null) => (d ? (Date.now() - new Date(d).getTime()) / 3600_000 : Infinity);

function HealthPage() {
  const qc = useQueryClient();
  const canFix = useCanAny("platform.admin", "users.admin");
  const { data: conns = [] } = useRows<any>("portal_connections");
  const { data: events = [] } = useRows<any>("portal_events");
  const { data: erp = [] } = useRows<any>("erp_sync_log");
  const { data: keys = [] } = useRows<any>("api_keys");

  const cards = useMemo(() => {
    const portal = conns.map((c) => {
      const ev = events.filter((e) => e.connection_id === c.id || (!e.connection_id && e.portal === c.portal));
      const failed = ev.filter((e) => e.last_error && e.status === "pending");
      const pending = ev.filter((e) => e.status === "pending" && e.direction === "out");
      const lastOk = [c.last_sent_at, c.last_received_at].filter(Boolean).sort().at(-1);
      return { id: c.id, name: `${c.name} (${c.portal})`, active: c.active, lastOk, failed, pending: pending.length };
    });
    const erpFails = erp.filter((e) => e.status === "error" || e.status === "failed");
    const erpOk = erp.filter((e) => !["error", "failed"].includes(e.status)).map((e) => e.created_at).sort().at(-1);
    return { portal, erp: { lastOk: erpOk, fails: erpFails.slice(0, 20), total: erp.length } };
  }, [conns, events, erp]);

  const retry = async (ids: string[]) => {
    const { error } = await supabase.from("portal_events" as never).update({ last_error: null, attempts: 0 } as never).in("id", ids);
    if (error) return toast.error(errMsg(error));
    toast.success(`${ids.length} message(s) queued to send again`); qc.invalidateQueries({ queryKey: ["exec"] });
  };
  const setExpiry = async (id: string, v: string) => {
    const { error } = await supabase.from("api_keys" as never).update({ expires_at: v ? new Date(v).toISOString() : null } as never).eq("id", id);
    if (error) return toast.error(errMsg(error));
    toast.success("Expiry saved"); qc.invalidateQueries({ queryKey: ["exec"] });
  };
  const light = (h: number, failed: number) => (failed > 0 ? "bg-destructive" : h < 24 ? "bg-success" : h < 72 ? "bg-warning" : "bg-muted-foreground");

  return (
    <div className="space-y-6">
      <PageHead back="/integrations" backLabel="Portals" icon={<HeartPulse className="h-5 w-5 text-primary" />} title="Integration health"
        desc="Green = worked in the last 24 hours, amber = quiet for 1–3 days, red = messages are failing." />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <div className="glass-panel rounded-2xl p-5">
          <div className="flex items-center gap-2"><span className={`h-2.5 w-2.5 rounded-full ${light(ago(cards.erp.lastOk), cards.erp.fails.length)}`} /><h2 className="font-semibold">ERP</h2></div>
          <p className="mt-1 text-xs text-muted-foreground">Last success {fmt(cards.erp.lastOk)} · {cards.erp.total} messages · {cards.erp.fails.length} failed</p>
          <ul className="mt-2 space-y-1 text-[11px]">{cards.erp.fails.slice(0, 5).map((e) => <li key={e.id} className="text-destructive">{fmt(e.created_at)} · {e.entity} {e.erp_id ?? ""}: {e.message}</li>)}</ul>
        </div>
        {cards.portal.map((c) => (
          <div key={c.id} className="glass-panel rounded-2xl p-5">
            <div className="flex items-center gap-2"><span className={`h-2.5 w-2.5 rounded-full ${c.active ? light(ago(c.lastOk), c.failed.length) : "bg-muted-foreground"}`} /><h2 className="font-semibold">{c.name}</h2>{!c.active && <span className="text-[10px] text-muted-foreground">switched off</span>}</div>
            <p className="mt-1 text-xs text-muted-foreground">Last success {fmt(c.lastOk)} · {c.pending} waiting to send · {c.failed.length} failing</p>
            <ul className="mt-2 space-y-1 text-[11px]">{c.failed.slice(0, 5).map((e) => <li key={e.id} className="text-destructive">{e.event_type} · try {e.attempts}: {e.last_error}</li>)}</ul>
            {canFix && c.failed.length > 0 && <button onClick={() => retry(c.failed.map((e) => e.id))} className="mt-3 inline-flex items-center gap-1 rounded-lg border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs text-primary"><RotateCcw className="h-3.5 w-3.5" />Retry failed</button>}
          </div>
        ))}
        {cards.portal.length === 0 && <div className="glass-panel rounded-2xl p-5 text-sm text-muted-foreground">No QA or maintenance portal connected yet.</div>}
      </div>

      <div className="glass-panel rounded-2xl p-5">
        <h2 className="font-semibold">API keys</h2>
        <p className="text-xs text-muted-foreground">Set an expiry so old keys stop working. Keys expiring within 14 days are flagged.</p>
        <table className="mt-3 w-full text-xs"><thead className="text-[10px] uppercase text-muted-foreground"><tr><th className="py-1 text-left">Label</th><th className="text-left">Key</th><th className="text-left">Last used</th><th className="text-left">Expires</th><th className="text-left">State</th></tr></thead>
          <tbody>{keys.map((k) => {
            const days = k.expires_at ? (new Date(k.expires_at).getTime() - Date.now()) / 86_400_000 : null;
            const state = !k.active ? "off" : days != null && days < 0 ? "expired" : days != null && days < 14 ? `expires in ${Math.ceil(days)} d` : "ok";
            return <tr key={k.id} className="border-t border-border/40"><td className="py-1.5">{k.label}</td><td className="font-mono">{k.key_prefix}…</td><td>{fmt(k.last_used_at)}</td>
              <td>{canFix ? <input type="date" className="h-7 rounded border border-border/60 bg-card/60 px-1" defaultValue={k.expires_at?.slice(0, 10) ?? ""} onBlur={(e) => e.target.value !== (k.expires_at?.slice(0, 10) ?? "") && setExpiry(k.id, e.target.value)} /> : (k.expires_at?.slice(0, 10) ?? "none")}</td>
              <td className={state === "ok" ? "text-success" : state === "off" ? "text-muted-foreground" : "text-warning"}>{state}</td></tr>;
          })}{keys.length === 0 && <tr><td colSpan={5} className="py-4 text-center text-muted-foreground">No API keys.</td></tr>}</tbody></table>
      </div>
    </div>
  );
}
