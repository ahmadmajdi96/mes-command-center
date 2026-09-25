import { useEffect, useSyncExternalStore } from "react";
import {
  recordUnitEvent, recordReading, recordLotProgress, sendToRework, openStationHold,
} from "./mes/execution.functions";

/**
 * Line-side offline recording. Each action gets a correlation id when captured;
 * the server skips ids it already stored, so replaying after a dropped
 * connection never double-records. Items the server refuses (rule broken,
 * item moved meanwhile) are kept as "needs attention" with the refusal reason.
 */
export type QueueKind = "unit_event" | "reading" | "lot_progress" | "rework" | "hold";
export type QueueItem = {
  id: string;
  kind: QueueKind;
  payload: Record<string, unknown>;
  label: string;
  capturedAt: string;
  status: "pending" | "failed";
  error?: string;
  attempts: number;
};

const KEY = "cortanex-offline-queue-v1";
const listeners = new Set<() => void>();
let cache: QueueItem[] | null = null;

function read(): QueueItem[] {
  if (cache) return cache;
  if (typeof window === "undefined") return [];
  try { cache = JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { cache = []; }
  return cache!;
}
function write(items: QueueItem[]) {
  cache = items;
  localStorage.setItem(KEY, JSON.stringify(items));
  listeners.forEach((l) => l());
}
const EMPTY: QueueItem[] = [];

export function newCorrelationId(prefix = "OFF") {
  return `${prefix}-${crypto.randomUUID()}`;
}

const senders: Record<QueueKind, (p: any) => Promise<unknown>> = {
  unit_event: (p) => recordUnitEvent({ data: p }),
  reading: (p) => recordReading({ data: p }),
  lot_progress: (p) => recordLotProgress({ data: p }),
  rework: (p) => sendToRework({ data: p }),
  hold: (p) => openStationHold({ data: p }),
};

function isNetworkError(e: unknown) {
  const m = e instanceof Error ? e.message : String(e);
  return (typeof navigator !== "undefined" && !navigator.onLine) || /fetch|network|load failed|timeout/i.test(m);
}

/**
 * Send now when online; queue when offline or when the connection drops mid-send.
 * Rule refusals while online are thrown so the operator sees them immediately.
 */
export async function submitOrQueue(kind: QueueKind, payload: Record<string, unknown>, label: string) {
  const withId = { ...payload, correlation_id: (payload.correlation_id as string) ?? newCorrelationId(kind.slice(0, 3).toUpperCase()) };
  if (typeof navigator !== "undefined" && navigator.onLine) {
    try { return { queued: false, result: await senders[kind](withId) }; }
    catch (e) { if (!isNetworkError(e)) throw e; }
  }
  write([...read(), { id: withId.correlation_id as string, kind, payload: withId, label, capturedAt: new Date().toISOString(), status: "pending", attempts: 0 }]);
  return { queued: true };
}

let flushing = false;
/** Replay in capture order; stop at the first network failure to keep order. */
export async function flushQueue() {
  if (flushing || (typeof navigator !== "undefined" && !navigator.onLine)) return;
  flushing = true;
  try {
    for (const item of read().filter((i) => i.status === "pending")) {
      try {
        await senders[item.kind](item.payload);
        write(read().filter((i) => i.id !== item.id));
      } catch (e) {
        if (isNetworkError(e)) break;
        write(read().map((i) => i.id === item.id
          ? { ...i, status: "failed", attempts: i.attempts + 1, error: e instanceof Error ? e.message : String(e) }
          : i));
      }
    }
  } finally { flushing = false; }
}

export function retryItem(id: string) {
  write(read().map((i) => (i.id === id ? { ...i, status: "pending", error: undefined } : i)));
  void flushQueue();
}
export function discardItem(id: string) {
  write(read().filter((i) => i.id !== id));
}

export function useOfflineQueue() {
  const items = useSyncExternalStore(
    (l) => { listeners.add(l); return () => listeners.delete(l); },
    read,
    () => EMPTY,
  );
  const online = useSyncExternalStore(
    (l) => { window.addEventListener("online", l); window.addEventListener("offline", l); return () => { window.removeEventListener("online", l); window.removeEventListener("offline", l); }; },
    () => navigator.onLine,
    () => true,
  );
  useEffect(() => {
    const go = () => void flushQueue();
    window.addEventListener("online", go);
    const t = setInterval(go, 15000);
    go();
    return () => { window.removeEventListener("online", go); clearInterval(t); };
  }, []);
  return { items, online };
}
