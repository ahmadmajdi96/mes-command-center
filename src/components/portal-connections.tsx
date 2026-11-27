import { RecLink } from "@/components/rec-link";
import { useMemo, useState } from "react";
import { Plus, Send, Copy } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useRows, useWrite, errMsg } from "@/lib/execution-db";
import { useListControls } from "@/components/list-controls";
import { useMyOrg } from "@/lib/wip-db";
import { useCanAny } from "@/lib/access";
import { dispatchPortalEvents } from "@/lib/mes/portals.functions";
import { useEffect } from "react";

const inp = "h-8 w-full rounded-lg border border-border/60 bg-card/60 px-2 text-xs";
const btn =
  "inline-flex items-center gap-1 rounded-lg border border-primary/40 bg-primary/10 px-2.5 py-1.5 text-xs text-primary hover:bg-primary/20 disabled:opacity-50";

function randomSecret() {
  const a = new Uint8Array(24);
  crypto.getRandomValues(a);
  return Array.from(a, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function PortalConnections() {
  const qc = useQueryClient();
  const { data: org } = useMyOrg();
  const isAdmin = useCanAny("users.admin", "platform.admin");
  const { data: conns = [] } = useRows<any>("portal_connections", { enabled: isAdmin });
  const { data: events = [] } = useRows<any>("portal_events");
  const w = useWrite("portal_connections");
  const dispatch = useServerFn(dispatchPortalEvents);
  const [nc, setNc] = useState({ portal: "maintenance", name: "", url: "" });
  const [dir, setDir] = useState("");
  const [st, setSt] = useState("");
  const [auto, setAuto] = useState(true);
  useEffect(() => {
    if (!isAdmin || !auto) return;
    const t = setInterval(async () => {
      try {
        const r = await dispatch();
        if (r.total) qc.invalidateQueries({ queryKey: ["exec"] });
      } catch {
        /* shown on manual send */
      }
    }, 20_000);
    return () => clearInterval(t);
  }, [isAdmin, auto, dispatch, qc]);
  const rows = useMemo(
    () => events.filter((e) => (!dir || e.direction === dir) && (!st || e.status === st)),
    [events, dir, st],
  );
  const lc = useListControls(rows, {
    searchKeys: ["event_type", "portal", "status", "ref_id", "last_error"],
    dateKey: "created_at",
    exportName: "portal-events",
  });
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const pending = events.filter(
    (e) => e.direction === "out" && ["pending", "failed"].includes(e.status),
  ).length;

  return (
    <div className="space-y-6">
      {isAdmin && (
        <div className="glass-panel rounded-2xl p-5">
          <h2 className="text-sm font-semibold">Connections</h2>
          <div className="mt-3 space-y-2">
            {conns.map((c) => (
              <div key={c.id} className="rounded-xl border border-border/40 p-3 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <b>
                      <RecLink kind="portal" id={c.id}>
                        {c.name}
                      </RecLink>
                    </b>{" "}
                    <span className="uppercase text-muted-foreground">· {c.portal}</span>{" "}
                    {!c.active && <span className="text-warning">· paused</span>}
                  </div>
                  <div className="flex gap-2">
                    <button
                      className="text-muted-foreground hover:text-foreground"
                      onClick={() => w.update.mutate({ id: c.id, patch: { active: !c.active } })}
                    >
                      {c.active ? "Pause" : "Resume"}
                    </button>
                    <button
                      className="text-destructive"
                      onClick={() => {
                        if (confirm("Remove connection?")) w.remove.mutate(c.id);
                      }}
                    >
                      Remove
                    </button>
                  </div>
                </div>
                <div className="mt-2 grid gap-1 font-mono text-[11px] text-muted-foreground">
                  <span>
                    Sends to: {c.outbound_url || "— not set"}{" "}
                    {String(c.outbound_url ?? "").includes("/api/public/mock-portal/") && (
                      <b className="text-warning">
                        (mock portal — replace with the real portal address when it is live)
                      </b>
                    )}
                  </span>
                  <span className="flex items-center gap-1">
                    Portal replies to: {origin}/api/public/portals/{c.id}
                    <button
                      aria-label="Copy reply URL"
                      onClick={() => {
                        navigator.clipboard.writeText(`${origin}/api/public/portals/${c.id}`);
                        toast.success("Copied");
                      }}
                    >
                      <Copy className="h-3 w-3" />
                    </button>
                  </span>
                  <span className="flex items-center gap-1">
                    Shared secret (HMAC-SHA256, header x-mes-signature): ••••
                    {String(c.shared_secret).slice(-6)}
                    <button
                      aria-label="Copy portal secret"
                      onClick={() => {
                        navigator.clipboard.writeText(c.shared_secret);
                        toast.success("Secret copied");
                      }}
                    >
                      <Copy className="h-3 w-3" />
                    </button>
                  </span>
                  <span>
                    Last sent {c.last_sent_at ? new Date(c.last_sent_at).toLocaleString() : "never"}{" "}
                    · last received{" "}
                    {c.last_received_at ? new Date(c.last_received_at).toLocaleString() : "never"}
                  </span>
                </div>
              </div>
            ))}
            {conns.length === 0 && (
              <p className="text-xs text-muted-foreground">
                No portals connected yet. Events still queue up and are sent once you add one.
              </p>
            )}
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-[140px_1fr_2fr_auto] sm:items-end">
            <label className="text-[11px] text-muted-foreground">
              Portal
              <select
                className={inp}
                value={nc.portal}
                onChange={(e) => setNc({ ...nc, portal: e.target.value })}
              >
                <option value="maintenance">Maintenance</option>
                <option value="qa">QA</option>
              </select>
              <span>Which system</span>
            </label>
            <label className="text-[11px] text-muted-foreground">
              Name *
              <input
                className={inp}
                aria-label="Connection name"
                value={nc.name}
                onChange={(e) => setNc({ ...nc, name: e.target.value })}
              />
              <span>For your reference</span>
            </label>
            <label className="text-[11px] text-muted-foreground">
              Portal address for events
              <input
                className={inp}
                aria-label="Portal address for events"
                value={nc.url}
                placeholder="https://maintenance.example.com/mes-events"
                onChange={(e) => setNc({ ...nc, url: e.target.value })}
              />
              <span>Leave empty until the portal is ready</span>
            </label>
            <button
              className={btn}
              disabled={!nc.name.trim() || !org}
              onClick={() =>
                w.insert.mutate(
                  {
                    organization_id: org,
                    portal: nc.portal,
                    name: nc.name.trim(),
                    outbound_url: nc.url.trim() || null,
                    shared_secret: randomSecret(),
                  },
                  {
                    onSuccess: () => {
                      toast.success("Connection added");
                      setNc({ portal: "maintenance", name: "", url: "" });
                    },
                    onError: (e) => toast.error(errMsg(e)),
                  },
                )
              }
            >
              <Plus className="h-3 w-3" />
              Add
            </button>
          </div>
        </div>
      )}

      <div className="glass-panel rounded-2xl p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">
            Message log{" "}
            <span className="text-xs font-normal text-muted-foreground">
              {pending} waiting to send
            </span>
          </h2>
          {isAdmin && (
            <label className="flex items-center gap-1 text-xs text-muted-foreground">
              <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} />
              Send automatically
            </label>
          )}
          {isAdmin && (
            <button
              className={btn}
              onClick={async () => {
                try {
                  const r = await dispatch();
                  toast.success(`Sent ${r.sent}, failed ${r.failed}`);
                  qc.invalidateQueries({ queryKey: ["exec"] });
                } catch (e) {
                  toast.error(errMsg(e));
                }
              }}
            >
              <Send className="h-3 w-3" />
              Send waiting events
            </button>
          )}
        </div>
        <div className="mt-3 flex gap-2">
          <select
            className="h-8 rounded-lg border border-border/60 bg-card/60 px-2 text-xs"
            value={dir}
            onChange={(e) => setDir(e.target.value)}
          >
            <option value="">Both directions</option>
            <option value="out">Outgoing</option>
            <option value="in">Incoming</option>
          </select>
          <select
            className="h-8 rounded-lg border border-border/60 bg-card/60 px-2 text-xs"
            value={st}
            onChange={(e) => setSt(e.target.value)}
          >
            <option value="">All statuses</option>
            {["pending", "sent", "failed", "applied", "rejected"].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </div>
        <div className="mt-3">{lc.toolbar}</div>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-[10px] uppercase text-muted-foreground">
              <tr>
                <th className="py-2 text-left">When</th>
                <th className="text-left">Direction</th>
                <th className="text-left">Portal</th>
                <th className="text-left">Event</th>
                <th className="text-left">Reference</th>
                <th className="text-left">Status</th>
                <th className="text-right">Tries</th>
                <th className="text-left">Note</th>
              </tr>
            </thead>
            <tbody>
              {lc.visible.map((e) => (
                <tr
                  key={e.id}
                  className="border-t border-border/40"
                  title={JSON.stringify(e.payload)}
                >
                  <td className="py-2">
                    <RecLink kind="portal_event" id={e.id}>
                      {new Date(e.created_at).toLocaleString()}
                    </RecLink>
                  </td>
                  <td>{e.direction === "out" ? "→ out" : "← in"}</td>
                  <td className="uppercase">{e.portal}</td>
                  <td>{e.event_type}</td>
                  <td className="font-mono text-[10px]">
                    {e.ref_table ? `${e.ref_table}:${String(e.ref_id ?? "").slice(0, 12)}` : "—"}
                  </td>
                  <td>
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[10px] uppercase ${["failed", "rejected"].includes(e.status) ? "border-destructive/50 text-destructive" : "border-border/60"}`}
                    >
                      {e.status}
                    </span>
                  </td>
                  <td className="text-right font-mono">{e.attempts}</td>
                  <td className="text-muted-foreground">{e.last_error ?? ""}</td>
                </tr>
              ))}
              {lc.visible.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-6 text-center text-muted-foreground">
                    No messages yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="mt-3">{lc.pager}</div>
      </div>
    </div>
  );
}
