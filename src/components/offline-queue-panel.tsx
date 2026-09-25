import { Wifi, WifiOff, RotateCcw, X } from "lucide-react";
import { useOfflineQueue, retryItem, discardItem, flushQueue } from "@/lib/offline-queue";

/** Connection state + unsent line-side records for the operator. */
export function OfflineQueuePanel() {
  const { items, online } = useOfflineQueue();
  const pending = items.filter((i) => i.status === "pending");
  const failed = items.filter((i) => i.status === "failed");
  return (
    <div className="glass-panel space-y-2 rounded-2xl p-3 text-xs">
      <div className="flex items-center justify-between">
        <span className={`flex items-center gap-1.5 font-medium ${online ? "text-success" : "text-warning"}`}>
          {online ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
          {online ? "Online" : "Offline — records are saved on this device"}
        </span>
        <span className="text-muted-foreground">
          {pending.length} waiting to send{failed.length ? ` · ${failed.length} need attention` : ""}
        </span>
        {online && pending.length > 0 && (
          <button onClick={() => void flushQueue()} className="rounded-lg border border-border/60 px-2 py-1">Send now</button>
        )}
      </div>
      {failed.map((i) => (
        <div key={i.id} className="flex items-start justify-between gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-2">
          <div>
            <div className="font-medium">{i.label}</div>
            <div className="text-muted-foreground">Captured {new Date(i.capturedAt).toLocaleString()}</div>
            <div className="text-destructive">Refused: {i.error}</div>
          </div>
          <div className="flex gap-1">
            <button aria-label="Retry" onClick={() => retryItem(i.id)} className="rounded border border-border/60 p-1"><RotateCcw className="h-3 w-3" /></button>
            <button aria-label="Discard" onClick={() => { if (confirm("Discard this record? It will not be saved.")) discardItem(i.id); }} className="rounded border border-border/60 p-1"><X className="h-3 w-3" /></button>
          </div>
        </div>
      ))}
    </div>
  );
}
