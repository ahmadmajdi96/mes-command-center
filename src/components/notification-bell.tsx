import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Bell, CheckCheck } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useNotifications, markRead, notifKey, timeAgo, sevClass } from "@/lib/notifications";
import { useState } from "react";

export function NotificationBell({ userId }: { userId: string }) {
  const { data = [] } = useNotifications(userId);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const unread = data.filter((n) => !n.read_at);
  const refresh = () => qc.invalidateQueries({ queryKey: notifKey(userId) });

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          aria-label="Notifications"
          className="relative grid h-9 w-9 place-items-center rounded-lg border border-border/60 bg-card/60 text-muted-foreground transition hover:text-foreground"
        >
          <Bell className="h-4 w-4" />
          {unread.length > 0 && (
            <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-destructive px-1 text-[9px] font-bold text-destructive-foreground">
              {unread.length > 99 ? "99+" : unread.length}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 p-0">
        <div className="flex items-center justify-between border-b border-border/60 px-3 py-2">
          <span className="text-sm font-semibold">Notifications</span>
          <button
            disabled={!unread.length}
            onClick={async () => {
              await markRead(unread.map((n) => n.id));
              refresh();
            }}
            className="inline-flex items-center gap-1 text-[11px] text-primary disabled:opacity-40"
          >
            <CheckCheck className="h-3.5 w-3.5" /> Mark all read
          </button>
        </div>
        <div className="max-h-96 overflow-y-auto">
          {data.length === 0 && <p className="px-3 py-8 text-center text-xs text-muted-foreground">You're all caught up.</p>}
          {data.slice(0, 12).map((n) => (
            <button
              key={n.id}
              onClick={async () => {
                if (!n.read_at) await markRead([n.id]);
                refresh();
                setOpen(false);
                if (n.link) navigate({ to: n.link as any });
              }}
              className={`flex w-full gap-2.5 border-b border-border/30 px-3 py-2.5 text-left hover:bg-card/60 ${n.read_at ? "opacity-60" : ""}`}
            >
              <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${sevClass[n.severity] ?? "bg-info"}`} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{n.title}</span>
                {n.message && <span className="block truncate text-[11px] text-muted-foreground">{n.message}</span>}
                <span className="text-[10px] text-muted-foreground">{timeAgo(n.created_at)}</span>
              </span>
            </button>
          ))}
        </div>
        <Link
          to="/notifications"
          onClick={() => setOpen(false)}
          className="block border-t border-border/60 px-3 py-2 text-center text-xs text-primary hover:underline"
        >
          View all notifications & preferences
        </Link>
      </PopoverContent>
    </Popover>
  );
}
