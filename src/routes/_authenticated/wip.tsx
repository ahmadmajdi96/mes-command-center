import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrowLeft, Boxes, MapPin, Plus, Scissors, Merge, MoveRight, ClipboardCheck, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useRows, useWrite, errMsg } from "@/lib/execution-db";
import { useListControls } from "@/components/list-controls";
import { useMyOrg, useMoveBatch, useSplitBatch, useMergeBatches, ageHours, unprocessed } from "@/lib/wip-db";
import { useCan, useCanAny } from "@/lib/access";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/wip")({
  head: () => ({ meta: [
    { title: "Work in Progress · Cortanex MES" },
    { name: "description", content: "Where every batch is, how long it has waited, and split, merge, move and count WIP." },
    { property: "og:title", content: "Work in Progress · Cortanex MES" },
    { property: "og:description", content: "WIP locations, aging, split/merge and reconciliation." },
  ] }),
  component: WipPage,
});

const inp = "h-8 w-full rounded-lg border border-border/60 bg-card/60 px-2 text-xs";
const btn = "inline-flex items-center gap-1 rounded-lg border border-primary/40 bg-primary/10 px-2.5 py-1 text-xs text-primary hover:bg-primary/20 disabled:opacity-50";
const ghost = "inline-flex items-center gap-1 rounded-lg border border-border/60 px-2 py-1 text-[11px] hover:bg-card/60 disabled:opacity-50";
const KINDS = ["buffer", "staging", "line_side", "quarantine", "warehouse"];

type Dlg = { kind: "move" | "split" | "merge" | "count"; batch: any } | null;

function WipPage() {
  const { data: org } = useMyOrg();
  const { data: locations = [] } = useRows<any>("wip_locations", { order: "name", asc: true });
  const { data: batches = [] } = useRows<any>("production_batches");
  const { data: moves = [] } = useRows<any>("wip_moves");
  const { data: counts = [] } = useRows<any>("wip_counts");
  const { data: links = [] } = useRows<any>("batch_links");
  const locW = useWrite("wip_locations");
  const canLoc = useCan("masterdata.write");
  const canMove = useCanAny("execution.record", "material.handle");
  const canSplit = useCanAny("orders.lifecycle", "execution.override");
  const [tab, setTab] = useState<"wip" | "moves" | "counts" | "links">("wip");
  const [locFilter, setLocFilter] = useState("");
  const [agedOnly, setAgedOnly] = useState(false);
  const [dlg, setDlg] = useState<Dlg>(null);
  const [nl, setNl] = useState({ name: "", kind: "buffer", aging: 24 });

  const locName = (id?: string | null) => locations.find((l) => l.id === id)?.name ?? (id ? id : "Unassigned");
  const wip = useMemo(() => batches
    .filter((b) => !["completed", "closed", "cancelled", "finished"].includes(b.status))
    .map((b) => {
      const loc = locations.find((l) => l.id === b.location_id);
      const age = ageHours(b);
      return { ...b, location: locName(b.location_id), wip_qty: unprocessed(b), age_h: Math.round(age * 10) / 10, aged: loc ? age > Number(loc.aging_limit_hours) : false, limit_h: loc?.aging_limit_hours ?? null };
    })
    .filter((b) => (!locFilter || (locFilter === "none" ? !b.location_id : b.location_id === locFilter)) && (!agedOnly || b.aged)), [batches, locations, locFilter, agedOnly]);

  const lcW = useListControls(wip, { searchKeys: ["number", "lot_number", "production_order_id", "product_name", "location", "status"], dateKey: "created_at", exportName: "wip" });
  const lcM = useListControls(moves.map((m) => ({ ...m, from: locName(m.from_location_id), to: locName(m.to_location_id) })), { searchKeys: ["batch_id", "from", "to", "reason", "actor_name"], dateKey: "created_at", exportName: "wip-moves" });
  const lcC = useListControls(counts.map((c) => ({ ...c, location: locName(c.location_id) })), { searchKeys: ["batch_id", "location", "reason", "actor_name"], dateKey: "created_at", exportName: "wip-counts" });
  const lcL = useListControls(links, { searchKeys: ["link_type", "parent_batch_id", "child_batch_id", "reason", "actor_name"], dateKey: "created_at", exportName: "batch-links" });

  const perLoc = locations.map((l) => {
    const here = batches.filter((b) => b.location_id === l.id && !["completed", "closed", "cancelled", "finished"].includes(b.status));
    return { ...l, n: here.length, qty: here.reduce((s, b) => s + unprocessed(b), 0), aged: here.filter((b) => ageHours(b) > Number(l.aging_limit_hours)).length };
  });
  const totalAged = wip.filter((b) => b.aged).length;
  const variance = counts.reduce((s, c) => s + Number(c.variance), 0);

  return (
    <div className="space-y-6">
      <Link to="/" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"><ArrowLeft className="h-3.5 w-3.5" /> Control Center</Link>
      <div>
        <h1 className="flex items-center gap-2 font-display text-2xl font-semibold tracking-tight"><Boxes className="h-5 w-5 text-primary" />Work in progress</h1>
        <p className="text-sm text-muted-foreground">Where every open batch is, how long it has waited, and split, merge, move or count it.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <Kpi label="Open WIP batches" value={String(wip.length)} />
        <Kpi label="WIP quantity" value={wip.reduce((s, b) => s + b.wip_qty, 0).toLocaleString()} />
        <Kpi label="Over aging limit" value={String(totalAged)} warn={totalAged > 0} />
        <Kpi label="Count variance (all counts)" value={variance.toLocaleString()} warn={variance !== 0} />
      </div>

      <div className="glass-panel rounded-2xl p-5">
        <h2 className="flex items-center gap-2 text-sm font-semibold"><MapPin className="h-4 w-4 text-primary" />Locations</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {perLoc.map((l) => (
            <button key={l.id} onClick={() => { setLocFilter(l.id); setTab("wip"); }} className={`rounded-xl border p-3 text-left hover:bg-card/60 ${locFilter === l.id ? "border-primary/60" : "border-border/40"}`}>
              <div className="flex items-center justify-between"><span className="text-sm font-medium">{l.name}</span><span className="text-[10px] uppercase text-muted-foreground">{l.kind.replace("_", " ")}</span></div>
              <div className="mt-1 text-xs text-muted-foreground">{l.n} batch(es) · {l.qty.toLocaleString()} units · limit {Number(l.aging_limit_hours)} h</div>
              {l.aged > 0 && <div className="mt-1 flex items-center gap-1 text-xs text-warning"><AlertTriangle className="h-3 w-3" />{l.aged} over limit</div>}
            </button>
          ))}
          {locations.length === 0 && <p className="text-xs text-muted-foreground">No locations yet — add one below.</p>}
        </div>
        {canLoc && (
          <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_160px_140px_auto] sm:items-end">
            <label className="text-[11px] text-muted-foreground">Name<input className={inp} aria-label="Location name" value={nl.name} onChange={(e) => setNl({ ...nl, name: e.target.value })} placeholder="e.g. Mill buffer A" /><span>Shown on moves and counts</span></label>
            <label className="text-[11px] text-muted-foreground">Kind<select className={inp} value={nl.kind} onChange={(e) => setNl({ ...nl, kind: e.target.value })}>{KINDS.map((k) => <option key={k} value={k}>{k.replace("_", " ")}</option>)}</select><span>What the area is used for</span></label>
            <label className="text-[11px] text-muted-foreground">Aging limit (h)<input className={inp} type="number" min={1} value={nl.aging} onChange={(e) => setNl({ ...nl, aging: Number(e.target.value) })} /><span>Flag WIP waiting longer</span></label>
            <button className={btn} disabled={!nl.name.trim() || !org || locW.insert.isPending} onClick={() => locW.insert.mutate(
              { id: `LOC-${Date.now().toString(36).toUpperCase()}`, organization_id: org, name: nl.name.trim(), kind: nl.kind, aging_limit_hours: nl.aging },
              { onSuccess: () => { toast.success("Location added"); setNl({ name: "", kind: "buffer", aging: 24 }); }, onError: (e) => toast.error(errMsg(e)) })}><Plus className="h-3 w-3" />Add location</button>
          </div>
        )}
      </div>

      <div className="glass-panel rounded-2xl p-5">
        <div className="flex flex-wrap gap-2">
          {([["wip", "Open WIP"], ["moves", "Move history"], ["counts", "Counts & reconciliation"], ["links", "Splits & merges"]] as const).map(([k, v]) => (
            <button key={k} onClick={() => setTab(k)} className={`rounded-lg px-3 py-1.5 text-xs ${tab === k ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-card/60"}`}>{v}</button>
          ))}
        </div>

        {tab === "wip" && (<>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <select className="h-8 rounded-lg border border-border/60 bg-card/60 px-2 text-xs" aria-label="Location filter" value={locFilter} onChange={(e) => setLocFilter(e.target.value)}>
              <option value="">All locations</option><option value="none">Unassigned</option>{locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
            <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={agedOnly} onChange={(e) => setAgedOnly(e.target.checked)} />Over aging limit only</label>
          </div>
          <div className="mt-3">{lcW.toolbar}</div>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-[10px] uppercase text-muted-foreground"><tr><th className="py-2 text-left">Batch</th><th className="text-left">Order</th><th className="text-left">Product</th><th className="text-left">Location</th><th className="text-right">WIP qty</th><th className="text-right">Waiting</th><th className="text-left">Status</th><th className="text-right">Actions</th></tr></thead>
              <tbody>
                {lcW.visible.map((b) => (
                  <tr key={b.id} className="border-t border-border/40 hover:bg-card/40">
                    <td className="py-2"><Link to="/batches/$batchId" params={{ batchId: b.id }} className="font-mono text-primary">{b.number}</Link>{b.parent_batch_id && <div className="text-[10px] text-muted-foreground">split from {b.parent_batch_id}</div>}</td>
                    <td><Link to="/production-orders/$poId" params={{ poId: b.production_order_id }} className="font-mono text-primary">{b.production_order_id}</Link></td>
                    <td>{b.product_name}</td>
                    <td>{b.location}</td>
                    <td className="text-right font-mono">{b.wip_qty.toLocaleString()} {b.uom}</td>
                    <td className={`text-right font-mono ${b.aged ? "text-warning" : ""}`}>{b.age_h} h{b.limit_h ? ` / ${Number(b.limit_h)}` : ""}</td>
                    <td><span className="rounded-full border border-border/60 px-2 py-0.5 text-[10px] uppercase">{b.status}</span></td>
                    <td className="text-right"><div className="flex justify-end gap-1">
                      <button className={ghost} disabled={!canMove} onClick={() => setDlg({ kind: "move", batch: b })}><MoveRight className="h-3 w-3" />Move</button>
                      <button className={ghost} disabled={!canSplit} onClick={() => setDlg({ kind: "split", batch: b })}><Scissors className="h-3 w-3" />Split</button>
                      <button className={ghost} disabled={!canSplit} onClick={() => setDlg({ kind: "merge", batch: b })}><Merge className="h-3 w-3" />Merge</button>
                      <button className={ghost} disabled={!canMove || !b.location_id} title={!b.location_id ? "Move it to a location first" : ""} onClick={() => setDlg({ kind: "count", batch: b })}><ClipboardCheck className="h-3 w-3" />Count</button>
                    </div></td>
                  </tr>
                ))}
                {lcW.visible.length === 0 && <tr><td colSpan={8} className="py-6 text-center text-muted-foreground">No open WIP matches.</td></tr>}
              </tbody>
            </table>
          </div>
          <div className="mt-3">{lcW.pager}</div>
        </>)}

        {tab === "moves" && <HistoryTable lc={lcM} cols={[["created_at", "When"], ["batch_id", "Batch"], ["from", "From"], ["to", "To"], ["qty", "Qty"], ["reason", "Reason"], ["actor_name", "By"]]} />}
        {tab === "counts" && <HistoryTable lc={lcC} cols={[["created_at", "When"], ["batch_id", "Batch"], ["location", "Location"], ["expected_qty", "Expected"], ["counted_qty", "Counted"], ["variance", "Variance"], ["reason", "Reason"], ["actor_name", "By"]]} />}
        {tab === "links" && <HistoryTable lc={lcL} cols={[["created_at", "When"], ["link_type", "Type"], ["parent_batch_id", "From batch"], ["child_batch_id", "To batch"], ["qty", "Qty"], ["reason", "Reason"], ["actor_name", "By"]]} />}
      </div>

      <WipDialog dlg={dlg} onClose={() => setDlg(null)} locations={locations} batches={batches} org={org} />
    </div>
  );
}

function Kpi({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return <div className="glass-panel rounded-xl p-4"><div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div><div className={`mt-1 font-mono text-xl ${warn ? "text-warning" : ""}`}>{value}</div></div>;
}

function HistoryTable({ lc, cols }: { lc: any; cols: [string, string][] }) {
  const isBatch = (k: string) => ["batch_id", "parent_batch_id", "child_batch_id"].includes(k);
  return (<>
    <div className="mt-3">{lc.toolbar}</div>
    <div className="mt-3 overflow-x-auto"><table className="w-full text-xs">
      <thead className="text-[10px] uppercase text-muted-foreground"><tr>{cols.map(([, l]) => <th key={l} className="py-2 text-left">{l}</th>)}</tr></thead>
      <tbody>{lc.visible.map((r: any) => (
        <tr key={r.id} className="border-t border-border/40">{cols.map(([k]) => (
          <td key={k} className={`py-2 ${k === "variance" && Number(r[k]) !== 0 ? "text-warning font-mono" : ""}`}>
            {k === "created_at" ? new Date(r[k]).toLocaleString() : isBatch(k) ? <Link to="/batches/$batchId" params={{ batchId: r[k] }} className="font-mono text-primary">{r[k]}</Link> : String(r[k] ?? "—")}
          </td>))}</tr>))}
        {lc.visible.length === 0 && <tr><td colSpan={cols.length} className="py-6 text-center text-muted-foreground">Nothing recorded yet.</td></tr>}
      </tbody></table></div>
    <div className="mt-3">{lc.pager}</div>
  </>);
}

function WipDialog({ dlg, onClose, locations, batches, org }: { dlg: Dlg; onClose: () => void; locations: any[]; batches: any[]; org: string | null | undefined }) {
  const move = useMoveBatch(); const split = useSplitBatch(); const merge = useMergeBatches();
  const countW = useWrite("wip_counts");
  const [to, setTo] = useState(""); const [qty, setQty] = useState(0); const [reason, setReason] = useState(""); const [sources, setSources] = useState<string[]>([]);
  const b = dlg?.batch;
  const reset = () => { setTo(""); setQty(0); setReason(""); setSources([]); onClose(); };
  const siblings = b ? batches.filter((x) => x.id !== b.id && x.production_order_id === b.production_order_id && x.sku === b.sku && !["completed", "closed", "cancelled", "running"].includes(x.status) && Number(x.qty_produced) === 0 && Number(x.qty_scrap) === 0) : [];
  const expected = b ? unprocessed(b) : 0;
  const run = (p: Promise<unknown>, ok: string) => p.then(() => { toast.success(ok); reset(); }).catch((e) => toast.error(errMsg(e)));
  const title = { move: "Move batch", split: "Split batch", merge: "Merge batches into this one", count: "Count WIP" }[dlg?.kind ?? "move"];
  return (
    <Dialog open={!!dlg} onOpenChange={(o) => !o && reset()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{title} {b?.number}</DialogTitle></DialogHeader>
        {b && <div className="space-y-3 text-xs">
          <p className="text-muted-foreground">Unprocessed: <b className="font-mono">{expected} {b.uom}</b> · at {locations.find((l) => l.id === b.location_id)?.name ?? "no location"}</p>
          {dlg?.kind === "move" && <label className="block">To location *<select className={inp} aria-label="To location" value={to} onChange={(e) => setTo(e.target.value)}><option value="">Choose…</option>{locations.filter((l) => l.active && l.id !== b.location_id).map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select></label>}
          {dlg?.kind === "split" && <label className="block">Quantity for the new batch *<input className={inp} aria-label="Split quantity" type="number" min={0} value={qty} onChange={(e) => setQty(Number(e.target.value))} /><span className="text-muted-foreground">Must be below {expected}</span></label>}
          {dlg?.kind === "merge" && <div>Batches to merge in (same order, no output yet) *
            {siblings.map((s) => <label key={s.id} className="mt-1 flex items-center gap-2"><input type="checkbox" checked={sources.includes(s.id)} onChange={(e) => setSources(e.target.checked ? [...sources, s.id] : sources.filter((x) => x !== s.id))} />{s.number} · {Number(s.qty)} {s.uom}</label>)}
            {siblings.length === 0 && <p className="text-muted-foreground">No batch can be merged into this one.</p>}</div>}
          {dlg?.kind === "count" && <label className="block">Counted quantity *<input className={inp} aria-label="Counted quantity" type="number" min={0} value={qty} onChange={(e) => setQty(Number(e.target.value))} /><span className="text-muted-foreground">Variance {qty - expected}</span></label>}
          <label className="block">Reason{dlg?.kind === "move" || (dlg?.kind === "count" && qty === expected) ? " (optional)" : " *"}<textarea className={`${inp} h-16 py-1`} aria-label="Reason" value={reason} onChange={(e) => setReason(e.target.value)} /></label>
          <div className="flex justify-end gap-2">
            <button className={ghost} onClick={reset}>Cancel</button>
            <button className={btn} disabled={move.isPending || split.isPending || merge.isPending || countW.insert.isPending} onClick={() => {
              if (dlg?.kind === "move") { if (!to) return toast.error("Choose a location"); run(move.mutateAsync({ _batch_id: b.id, _to: to, _reason: reason || null }), "Batch moved"); }
              if (dlg?.kind === "split") run(split.mutateAsync({ _batch_id: b.id, _qty: qty, _reason: reason }).then((id) => toast.message(`New batch ${String(id)}`)), "Batch split");
              if (dlg?.kind === "merge") run(merge.mutateAsync({ _target: b.id, _sources: sources, _reason: reason }), "Batches merged");
              if (dlg?.kind === "count") run((async () => {
                const { data: u } = await supabase.auth.getUser();
                return countW.insert.mutateAsync({ organization_id: org ?? b.organization_id, location_id: b.location_id, batch_id: b.id, expected_qty: expected, counted_qty: qty, reason: reason || null, actor_user_id: u.user?.id, actor_name: u.user?.email });
              })(), "Count recorded");
            }}>Confirm</button>
          </div>
        </div>}
      </DialogContent>
    </Dialog>
  );
}
