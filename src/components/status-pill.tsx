import { cn } from "@/lib/utils";
import type { LineStatus } from "@/lib/mes-data";

const styles: Record<string, string> = {
  running: "text-success",
  idle: "text-muted-foreground",
  down: "text-destructive",
  changeover: "text-accent",
  scheduled: "text-info",
  paused: "text-warning",
  hold: "text-destructive",
  completed: "text-muted-foreground",
  open: "text-destructive",
  resolved: "text-success",
  released: "text-success",
  rejected: "text-destructive",
  active: "text-primary",
  done: "text-success",
  pending: "text-muted-foreground",
  warn: "text-warning",
  critical: "text-destructive",
  info: "text-info",
  low: "text-success",
  medium: "text-warning",
  high: "text-destructive",
};

export function StatusPill({ status, className }: { status: LineStatus | string; className?: string }) {
  const c = styles[status] ?? "text-muted-foreground";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-card/60 px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wider",
        c,
        className,
      )}
    >
      <span className={cn("status-dot", c, status === "running" && "animate-pulse-glow")} />
      {status}
    </span>
  );
}
