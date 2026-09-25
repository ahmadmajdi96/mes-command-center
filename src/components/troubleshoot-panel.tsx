import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Sparkles, Loader2 } from "lucide-react";
import { troubleshootIssue } from "@/lib/mes/troubleshoot.functions";

/** Operator describes an issue in their own words; AI returns causes, checks and next steps. */
export function TroubleshootPanel(props: { stationId: string; stationName: string; lineName?: string; unitUid?: string | null }) {
  const run = useServerFn(troubleshootIssue);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [answer, setAnswer] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function ask() {
    setBusy(true); setError(null); setAnswer("");
    try {
      const r = await run({ data: { description: text, station_id: props.stationId, station_name: props.stationName, line_name: props.lineName, unit_uid: props.unitUid } });
      if (r.error) setError(r.error); else setAnswer(r.guidance);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally { setBusy(false); }
  }

  return (
    <div className="glass-panel space-y-3 rounded-2xl p-4">
      <div className="flex items-center gap-2 text-sm font-medium"><Sparkles className="h-4 w-4 text-primary" /> AI troubleshooting</div>
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} maxLength={4000}
        placeholder="Describe the problem, e.g. 'Filler keeps under-filling bottles after changeover, weights 5% low'"
        className="w-full rounded-lg border border-border/60 bg-card/60 p-2 text-sm focus:border-primary/50 focus:outline-none" />
      <button onClick={ask} disabled={busy || text.trim().length < 5}
        className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50">
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />} Get guidance
      </button>
      {error && <div role="alert" className="text-xs text-destructive">{error}</div>}
      {answer && <div className="whitespace-pre-wrap rounded-lg border border-border/60 bg-card/40 p-3 text-sm leading-relaxed">{answer}</div>}
      {answer && <p className="text-[10px] text-muted-foreground">AI-generated guidance — follow site safety procedures and confirm with a supervisor.</p>}
    </div>
  );
}
