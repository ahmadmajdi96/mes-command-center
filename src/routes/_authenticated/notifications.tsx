import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Bell, CheckCheck, Trash2, MailOpen, Mail } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useListControls } from "@/components/list-controls";
import { Switch } from "@/components/ui/switch";
import {
  NOTIFICATION_TYPES,
  useNotifications,
  markRead,
  markUnread,
  removeNotifications,
  notifKey,
  timeAgo,
  sevClass,
} from "@/lib/notifications";

export const Route = createFileRoute("/_authenticated/notifications")({
  head: () => ({
    meta: [
      { title: "Notifications · Cortanex MES" },
      { name: "description", content: "Live alerts for approvals, downtime, holds, nonconformances, machines and access changes." },
      { property: "og:title", content: "Notifications · Cortanex MES" },
      { property: "og:description", content: "Your live shop-floor alerts and notification preferences." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: NotificationsPage,
});

function NotificationsPage() {
  const { user } = Route.useRouteContext();
  const qc = useQueryClient();
  const { data = [], isLoading } = useNotifications(user.id);
  const [tab, setTab] = useState<"all" | "unread">("all");
  const [type, setType] = useState("");
  const [sel, setSel] = useState<Set<string>>(new Set());

  const rows = useMemo(
    () =>
      data
        .filter((n) => (tab === "unread" ? !n.read_at : true))
        .filter((n) => (type ? n.type === type : true))
        .map((n) => ({ ...n, state: n.read_at ? "read" : "unread" })),
    [data, tab, type],
  );
  const lc = useListControls(rows, { searchKeys: ["title", "message", "type", "severity"], dateKey: "created_at", exportName: "notifications" });
  const refresh = () => {
    setSel(new Set());
    qc.invalidateQueries({ queryKey: notifKey(user.id) });
  };
  const unread = data.filter((n) => !n.read_at).length;
  const ids = [...sel];

  const prefs = useQuery({
    queryKey: ["notif-prefs", user.id],
    queryFn: async () => {
      const { data } = await (supabase.from("notification_prefs" as any) as any).select("type, enabled").eq("user_id", user.id);
      return new Map<string, boolean>((data ?? []).map((p: any) => [p.type, p.enabled]));
    },
  });
  const setPref = async (t: string, enabled: boolean) => {
    const { error } = await (supabase.from("notification_prefs" as any) as any).upsert({ user_id: user.id, type: t, enabled, updated_at: new Date().toISOString() });
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["notif-prefs", user.id] });
  };

  const btn = "inline-flex items-center gap-1.5 rounded-lg border border-border/60 bg-card/60 px-2.5 py-1.5 text-xs disabled:opacity-40";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Notifications</h1>
          <p className="text-sm text-muted-foreground">{unread} unread · alerts arrive live while you work</p>
        </div>
        <button className={btn} disabled={!unread} onClick={async () => { await markRead(data.filter((n) => !n.read_at).map((n) => n.id)); refresh(); }}>
          <CheckCheck className="h-3.5 w-3.5" /> Mark all read
        </button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
        <div className="glass-panel space-y-3 rounded-2xl p-4">
          <div className="flex flex-wrap items-center gap-2">
            {(["all", "unread"] as const).map((t) => (
              <button key={t} onClick={() => setTab(t)} className={`rounded-lg px-3 py-1.5 text-xs ${tab === t ? "bg-primary/15 text-primary" : "text-muted-foreground"}`}>
                {t === "all" ? `All (${data.length})` : `Unread (${unread})`}
              </button>
            ))}
            <select value={type} onChange={(e) => setType(e.target.value)} className="h-8 rounded-lg border border-border/60 bg-card/60 px-2 text-xs" aria-label="Type">
              <option value="">All types</option>
              {NOTIFICATION_TYPES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
            </select>
            {sel.size > 0 && (
              <div className="ml-auto flex gap-1.5">
                <button className={btn} onClick={async () => { await markRead(ids); refresh(); }}><MailOpen className="h-3.5 w-3.5" /> Read</button>
                <button className={btn} onClick={async () => { await markUnread(ids); refresh(); }}><Mail className="h-3.5 w-3.5" /> Unread</button>
                <button className={`${btn} text-destructive`} onClick={async () => { await removeNotifications(ids); toast.success(`${ids.length} deleted`); refresh(); }}><Trash2 className="h-3.5 w-3.5" /> Delete</button>
              </div>
            )}
          </div>
          {lc.toolbar}
          <div className="divide-y divide-border/40 rounded-xl border border-border/40">
            {isLoading && <p className="p-6 text-center text-sm text-muted-foreground">Loading…</p>}
            {!isLoading && lc.visible.length === 0 && (
              <div className="p-10 text-center text-sm text-muted-foreground"><Bell className="mx-auto mb-2 h-5 w-5" />Nothing here.</div>
            )}
            {lc.visible.map((n) => (
              <div key={n.id} className={`flex items-start gap-3 p-3 ${n.read_at ? "opacity-60" : ""}`}>
                <input
                  type="checkbox"
                  aria-label="Select"
                  className="mt-1"
                  checked={sel.has(n.id)}
                  onChange={(e) => {
                    const s = new Set(sel);
                    e.target.checked ? s.add(n.id) : s.delete(n.id);
                    setSel(s);
                  }}
                />
                <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${sevClass[n.severity] ?? "bg-info"}`} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{n.title}</span>
                    <span className="rounded border border-border/60 px-1.5 text-[10px] text-muted-foreground">
                      {NOTIFICATION_TYPES.find((t) => t.key === n.type)?.label ?? n.type}
                    </span>
                  </div>
                  {n.message && <p className="text-xs text-muted-foreground">{n.message}</p>}
                  <div className="mt-1 flex gap-3 text-[11px]">
                    <span className="text-muted-foreground" title={new Date(n.created_at).toLocaleString()}>{timeAgo(n.created_at)}</span>
                    {n.link && (
                      <Link to={n.link as any} onClick={() => !n.read_at && markRead([n.id]).then(refresh)} className="text-primary hover:underline">Open →</Link>
                    )}
                    <button className="text-muted-foreground hover:text-foreground" onClick={async () => { await (n.read_at ? markUnread([n.id]) : markRead([n.id])); refresh(); }}>
                      Mark {n.read_at ? "unread" : "read"}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
          {lc.pager}
        </div>

        <div className="glass-panel h-fit space-y-3 rounded-2xl p-4">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">What to notify me about</div>
          {NOTIFICATION_TYPES.map((t) => (
            <label key={t.key} className="flex items-start justify-between gap-3">
              <span>
                <span className="block text-sm">{t.label}</span>
                <span className="block text-[11px] text-muted-foreground">{t.hint}</span>
              </span>
              <Switch checked={prefs.data?.get(t.key) ?? true} onCheckedChange={(v) => setPref(t.key, v)} aria-label={t.label} />
            </label>
          ))}
          <p className="text-[11px] text-muted-foreground">You only receive alerts for areas your roles cover.</p>
        </div>
      </div>
    </div>
  );
}
