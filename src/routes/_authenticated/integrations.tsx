import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrowLeft, Cable, Plus, Send, FlaskConical, Copy } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useRows, useWrite, errMsg } from "@/lib/execution-db";
import { useListControls } from "@/components/list-controls";
import { useMyOrg } from "@/lib/wip-db";
import { useCanAny } from "@/lib/access";
import { dispatchPortalEvents, simulatePortalReply } from "@/lib/mes/portals.functions";

export const Route = createFileRoute("/_authenticated/integrations")({
  head: () => ({ meta: [
    { title: "Maintenance & QA Portals · Cortanex MES" },
    { name: "description", content: "Connect the separate Maintenance and QA portals: outgoing events, incoming results and the message log." },
    { property: "og:title", content: "Maintenance & QA Portals · Cortanex MES" },
    { property: "og:description", content: "Portal connections and event log." },
  ] }),
  component: IntegrationsPage,
});

const inp = "h-8 w-full rounded-lg border border-border/60 bg-card/60 px-2 text-xs";
const btn = "inline-flex items-center gap-1 rounded-lg border border-primary/40 bg-primary/10 px-2.5 py-1.5 text-xs text-primary hover:bg-primary/20 disabled:opacity-50";

const SAMPLES: Record<string, Record<string, string>> = {
  qa: { inspection_result: '{ "rework_task_id": "<task id>", "result": "pass", "notes": "OK", "by": "QA inspector" }', hold_released: '{ "station_id": "<station>", "notes": "Sample OK" }', nonconformance_decision: '{ "reference": "NC-1", "decision": "use_as_is" }' },
  maintenance: { work_order_closed: '{ "station_id": "<station>", "machine_id": "<machine>", "notes": "Bearing replaced", "by": "Tech" }', hold_released: '{ "station_hold_id": "<hold id>" }' },
};

function randomSecret() { const a = new Uint8Array(24); crypto.getRandomValues(a); return Array.from(a, (b) => b.toString(16).padStart(2, "0")).join(""); }

function IntegrationsPage() {
  const qc = useQueryClient();
  const { data: org } = useMyOrg();
  const isAdmin = useCanAny("users.admin", "platform.admin");
  const { data: conns = [] } = useRows<any>("portal_connections", { enabled: isAdmin });
  const { data: events = [] } = useRows<any>("portal_events");
  const w = useWrite("portal_connections");
  const dispatch = useServerFn(dispatchPortalEvents);
  const simulate = useServerFn(simulatePortalReply);
  const [nc, setNc] = useState({ portal: "maintenance", name: "", url: "" });
  const [sim, setSim] = useState({ conn: "", type: "", body: "" });
  const [dir, setDir] = useState(""); const [st, setSt] = useState("");

  const rows = useMemo(() => events.filter((e) => (!dir || e.direction === dir) && (!st || e.status === st)), [events, dir, st]);
  const lc = useListControls(rows, { searchKeys: ["event_type", "portal", "status", "ref_id", "last_error"], dateKey: "created_at", exportName: "portal-events" });
  const simConn = conns.find((c) => c.id === sim.conn);
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const pending = events.filter((e) => e.direction === "out" && ["pending", "failed"].includes(e.status)).length;

  return (
    <div className="space-y-6">
      <Link to="/settings" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"><ArrowLeft className="h-3.5 w-3.5" /> Settings</Link>
      <div>
        <h1 className="flex items-center gap-2 font-display text-2xl font-semibold"><Cable className="h-5 w-5 text-primary" />Maintenance &amp; QA portals</h1>
        <p className="text-sm text-muted-foreground">Maintenance and quality run in their own portals. This system sends them holds, equipment faults, quality issues and re-inspection requests, and applies their replies (inspection results, closed work orders, released holds).</p>
      </div>

      {isAdmin && (
        <div className="glass-panel rounded-2xl p-5">
          <h2 className="text-sm font-semibold">Connections</h2>
          <div className="mt-3 space-y-2">
            {conns.map((c) => (
              <div key={c.id} className="rounded-xl border border-border/40 p-3 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div><b>{c.name}</b> <span className="uppercase text-muted-foreground">· {c.portal}</span> {!c.active && <span className="text-warning">· paused</span>}</div>
                  <div className="flex gap-2">
                    <button className="text-muted-foreground hover:text-foreground" onClick={() => w.update.mutate({ id: c.id, patch: { active: !c.active } })}>{c.active ? "Pause" : "Resume"}</button>
                    <button className="text-destructive" onClick={() => { if (confirm("Remove connection?")) w.remove.mutate(c.id); }}>Remove</button>
                  </div>
                </div>
                <div className="mt-2 grid gap-1 font-mono text-[11px] text-muted-foreground">
                  <span>Sends to: {c.outbound_url || "— not set"}</span>
                  <span className="flex items-center gap-1">Portal replies to: {origin}/api/public/portals/{c.id}<button onClick={() => { navigator.clipboard.writeText(`${origin}/api/public/portals/${c.id}`); toast.success("Copied"); }}><Copy className="h-3 w-3" /></button></span>
                  <span className="flex items-center gap-1">Shared secret (HMAC-SHA256, header x-mes-signature): ••••{String(c.shared_secret).slice(-6)}<button onClick={() => { navigator.clipboard.writeText(c.shared_secret); toast.success("Secret copied"); }}><Copy className="h-3 w-3" /></button></span>
                  <span>Last sent {c.last_sent_at ? new Date(c.last_sent_at).toLocaleString() : "never"} · last received {c.last_received_at ? new Date(c.last_received_at).toLocaleString() : "never"}</span>
                </div>
              </div>
            ))}
            {conns.length === 0 && <p className="text-xs text-muted-foreground">No portals connected yet. Events still queue up and are sent once you add one.</p>}
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-[140px_1fr_2fr_auto] sm:items-end">
            <label className="text-[11px] text-muted-foreground">Portal<select className={inp} value={nc.portal} onChange={(e) => setNc({ ...nc, portal: e.target.value })}><option value="maintenance">Maintenance</option><option value="qa">QA</option></select><span>Which system</span></label>
            <label className="text-[11px] text-muted-foreground">Name *<input className={inp} aria-label="Connection name" value={nc.name} onChange={(e) => setNc({ ...nc, name: e.target.value })} /><span>For your reference</span></label>
            <label className="text-[11px] text-muted-foreground">Portal address for events<input className={inp} aria-label="Portal URL" value={nc.url} placeholder="https://maintenance.example.com/mes-events" onChange={(e) => setNc({ ...nc, url: e.target.value })} /><span>Leave empty until the portal is ready</span></label>
            <button className={btn} disabled={!nc.name.trim() || !org} onClick={() => w.insert.mutate({ organization_id: org, portal: nc.portal, name: nc.name.trim(), outbound_url: nc.url.trim() || null, shared_secret: randomSecret() },
              { onSuccess: () => { toast.success("Connection added"); setNc({ portal: "maintenance", name: "", url: "" }); }, onError: (e) => toast.error(errMsg(e)) })}><Plus className="h-3 w-3" />Add</button>
          </div>
        </div>
      )}

      {isAdmin && conns.length > 0 && (
        <div className="glass-panel rounded-2xl p-5">
          <h2 className="flex items-center gap-2 text-sm font-semibold"><FlaskConical className="h-4 w-4 text-primary" />Try a portal reply</h2>
          <p className="text-xs text-muted-foreground">Handled exactly like a signed message from the portal. Useful before the portal is live.</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <select className={inp} aria-label="Simulate connection" value={sim.conn} onChange={(e) => setSim({ conn: e.target.value, type: "", body: "" })}><option value="">Connection…</option>{conns.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.portal})</option>)}</select>
            <select className={inp} aria-label="Simulate event" value={sim.type} disabled={!simConn} onChange={(e) => setSim({ ...sim, type: e.target.value, body: SAMPLES[simConn.portal][e.target.value] })}><option value="">Event…</option>{simConn && Object.keys(SAMPLES[simConn.portal]).map((k) => <option key={k}>{k}</option>)}</select>
          </div>
          <textarea className={`${inp} mt-2 h-24 py-1 font-mono`} aria-label="Simulate data" value={sim.body} onChange={(e) => setSim({ ...sim, body: e.target.value })} />
          <button className={`${btn} mt-2`} disabled={!sim.conn || !sim.type} onClick={async () => {
            let data; try { data = JSON.parse(sim.body); } catch { return toast.error("Data is not valid JSON"); }
            try { const r = await simulate({ data: { connectionId: sim.conn, event_type: sim.type, data } }); (r.ok ? toast.success : toast.error)(r.outcome); qc.invalidateQueries({ queryKey: ["exec"] }); } catch (e) { toast.error(errMsg(e)); }
          }}>Apply reply</button>
        </div>
      )}

      <div className="glass-panel rounded-2xl p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">Message log <span className="text-xs font-normal text-muted-foreground">{pending} waiting to send</span></h2>
          {isAdmin && <button className={btn} onClick={async () => { try { const r = await dispatch(); toast.success(`Sent ${r.sent}, failed ${r.failed}`); qc.invalidateQueries({ queryKey: ["exec"] }); } catch (e) { toast.error(errMsg(e)); } }}><Send className="h-3 w-3" />Send waiting events</button>}
        </div>
        <div className="mt-3 flex gap-2">
          <select className="h-8 rounded-lg border border-border/60 bg-card/60 px-2 text-xs" value={dir} onChange={(e) => setDir(e.target.value)}><option value="">Both directions</option><option value="out">Outgoing</option><option value="in">Incoming</option></select>
          <select className="h-8 rounded-lg border border-border/60 bg-card/60 px-2 text-xs" value={st} onChange={(e) => setSt(e.target.value)}><option value="">All statuses</option>{["pending", "sent", "failed", "applied", "rejected"].map((s) => <option key={s}>{s}</option>)}</select>
        </div>
        <div className="mt-3">{lc.toolbar}</div>
        <div className="mt-3 overflow-x-auto"><table className="w-full text-xs">
          <thead className="text-[10px] uppercase text-muted-foreground"><tr><th className="py-2 text-left">When</th><th className="text-left">Direction</th><th className="text-left">Portal</th><th className="text-left">Event</th><th className="text-left">Reference</th><th className="text-left">Status</th><th className="text-right">Tries</th><th className="text-left">Note</th></tr></thead>
          <tbody>{lc.visible.map((e) => (
            <tr key={e.id} className="border-t border-border/40" title={JSON.stringify(e.payload)}>
              <td className="py-2">{new Date(e.created_at).toLocaleString()}</td><td>{e.direction === "out" ? "→ out" : "← in"}</td><td className="uppercase">{e.portal}</td><td>{e.event_type}</td>
              <td className="font-mono text-[10px]">{e.ref_table ? `${e.ref_table}:${String(e.ref_id ?? "").slice(0, 12)}` : "—"}</td>
              <td><span className={`rounded-full border px-2 py-0.5 text-[10px] uppercase ${["failed", "rejected"].includes(e.status) ? "border-destructive/50 text-destructive" : "border-border/60"}`}>{e.status}</span></td>
              <td className="text-right font-mono">{e.attempts}</td><td className="text-muted-foreground">{e.last_error ?? ""}</td>
            </tr>))}
            {lc.visible.length === 0 && <tr><td colSpan={8} className="py-6 text-center text-muted-foreground">No messages yet.</td></tr>}
          </tbody></table></div>
        <div className="mt-3">{lc.pager}</div>
      </div>
    </div>
  );
}
