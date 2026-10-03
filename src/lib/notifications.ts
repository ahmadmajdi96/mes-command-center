import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export type Notification = {
  id: string;
  type: string;
  title: string;
  message: string | null;
  link: string | null;
  severity: string;
  read_at: string | null;
  created_at: string;
};

export const NOTIFICATION_TYPES: { key: string; label: string; hint: string }[] = [
  { key: "approval_requested", label: "Approval requests", hint: "Someone needs your signature" },
  { key: "approval_decided", label: "Approval decisions", hint: "Your request was approved or rejected" },
  { key: "downtime", label: "Downtime", hint: "A line or station stopped" },
  { key: "hold", label: "Holds", hint: "An order, station or lot was put on hold" },
  { key: "nonconformance", label: "Nonconformances", hint: "A failed inspection or quality issue" },
  { key: "machine", label: "Machine commands", hint: "A command you sent failed or was blocked" },
  { key: "access", label: "Access changes", hint: "A role was given to or taken from you" },
];

export const notifKey = (uid: string) => ["notifications", uid];

export function useNotifications(userId: string, limit = 500) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: notifKey(userId),
    queryFn: async () => {
      const { data, error } = await (supabase.from("notifications" as any) as any)
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data ?? []) as Notification[];
    },
  });

  useEffect(() => {
    if (!userId) return;
    const ch = supabase
      .channel(`notifications-${userId}`)
      .on(
        "postgres_changes" as any,
        { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
        (payload: any) => {
          qc.invalidateQueries({ queryKey: notifKey(userId) });
          if (payload.eventType === "INSERT") {
            const n = payload.new as Notification;
            const fn = n.severity === "error" ? toast.error : n.severity === "warning" ? toast.warning : n.severity === "success" ? toast.success : toast.info;
            fn(n.title, { description: n.message ?? undefined });
          }
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [userId, qc]);

  return q;
}

export async function markRead(ids: string[]) {
  if (!ids.length) return;
  await (supabase.from("notifications" as any) as any).update({ read_at: new Date().toISOString() }).in("id", ids);
}
export async function markUnread(ids: string[]) {
  await (supabase.from("notifications" as any) as any).update({ read_at: null }).in("id", ids);
}
export async function removeNotifications(ids: string[]) {
  await (supabase.from("notifications" as any) as any).delete().in("id", ids);
}

export function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export const sevClass: Record<string, string> = {
  error: "bg-destructive",
  warning: "bg-warning",
  success: "bg-success",
  info: "bg-info",
};
