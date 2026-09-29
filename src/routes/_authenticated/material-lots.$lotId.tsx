import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Package, GitBranch } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useWrite, errMsg } from "@/lib/execution-db";
import { LOT_KINDS } from "@/lib/wip-db";
import { useCan } from "@/lib/access";
import { DataMatrix } from "@/components/datamatrix";

export const Route = createFileRoute("/_authenticated/material-lots/$lotId")({
  head: () => ({ meta: [
    { title: "Lot detail · Cortanex MES" },
    { name: "description", content: "Lot quantities, usage history and backward/forward genealogy." },
    { property: "og:title", content: "Lot detail · Cortanex MES" },
    { property: "og:description", content: "Lot usage and genealogy." },
  ] }),
  component: LotDetail,
});

function LotDetail() {
  const { lotId } = useParams({ from: "/_authenticated/material-lots/$lotId" });
  const w = useWrite("material_lots");
  const canHandle = useCan("material.handle");
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["exec", "lot", lotId],
    queryFn: async () => {
      const { data: lot, error } = await supabase.from("material_lots" as never).select("*").eq("id", lotId).maybeSingle();
      if (error) throw error;
      if (!lot) return null;
      const l = lot as any;
      const [{ data: uses }, { data: forward }, { data: backward }] = await Promise.all([
        supabase.from("material_consumptions").select("*").eq("lot_id", lotId).order("created_at", { ascending: false }),
        supabase.from("lot_genealogy" as never).select("*").eq("input_lot_id", lotId),
        l.source_order_id ? supabase.from("lot_genealogy" as never).select("*").eq("production_order_id", l.source_order_id) : Promise.resolve({ data: [] }),
      ]);
      return { lot: l, uses: (uses ?? []) as any[], forward: (forward ?? []) as any[], backward: (backward ?? []) as any[] };
    },
  });
  if (isLoading) return <div className="text-sm text-muted-foreground">Loading…</div>;
  if (!data) return <div className="glass-panel rounded-2xl p-8 text-center text-sm">Lot not found. <Link to="/material-lots" className="text-primary">Back</Link></div>;
  const { lot, uses, forward, backward } = data;
  const setStatus = (status: string) => w.update.mutate({ id: lot.id, patch: { status } }, { onSuccess: () => { toast.success(`Lot ${status}`); refetch(); }, onError: (e) => toast.error(errMsg(e)) });

  return (
    <div className="space-y-6">
      <Link to="/material-lots" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"><ArrowLeft className="h-3.5 w-3.5" /> Material lots</Link>
      <div className="glass-panel grid gap-6 rounded-2xl p-6 md:grid-cols-[1fr_auto]">
        <div>
          <h1 className="flex items-center gap-2 font-display text-2xl font-semibold"><Package className="h-5 w-5 text-primary" />{lot.lot_number}</h1>
          <p className="mt-1 text-sm">{lot.sku} · {lot.name} <span className="text-muted-foreground">· {LOT_KINDS[lot.kind]}</span></p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {[["Received", `${Number(lot.qty_received)} ${lot.uom}`], ["Remaining", `${Number(lot.qty_remaining)} ${lot.uom}`], ["Status", lot.status], ["Expiry", lot.expiry_date ?? "—"], ["Supplier", lot.supplier ?? "—"], ["Received on", new Date(lot.created_at).toLocaleDateString()]].map(([k, v]) => (
              <div key={k} className="rounded-xl border border-border/40 bg-card/40 p-3"><div className="text-[10px] uppercase text-muted-foreground">{k}</div><div className="mt-1 font-mono text-sm">{v}</div></div>
            ))}
          </div>
          {lot.source_order_id && <p className="mt-3 text-xs">Produced by order <Link to="/production-orders/$poId" params={{ poId: lot.source_order_id }} className="font-mono text-primary">{lot.source_order_id}</Link></p>}
          {canHandle && <div className="mt-4 flex gap-2">
            {lot.status === "available" && <button className="rounded-lg border border-warning/40 px-3 py-1.5 text-xs text-warning" onClick={() => setStatus("quarantine")}>Quarantine</button>}
            {lot.status === "available" && <button className="rounded-lg border border-destructive/40 px-3 py-1.5 text-xs text-destructive" onClick={() => setStatus("blocked")}>Block</button>}
            {["quarantine", "blocked"].includes(lot.status) && Number(lot.qty_remaining) > 0 && <button className="rounded-lg border border-primary/40 px-3 py-1.5 text-xs text-primary" onClick={() => setStatus("available")}>Release to available</button>}
          </div>}
        </div>
        <div className="grid place-items-center rounded-2xl border border-border/40 bg-card/40 p-4"><DataMatrix text={lot.lot_number} scale={5} className="rounded bg-white" /></div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="glass-panel rounded-2xl p-5">
          <h2 className="flex items-center gap-2 text-sm font-semibold"><GitBranch className="h-4 w-4 text-primary" />Used in (forward)</h2>
          <Gen rows={forward} lotCol="output_lot" skuCol="output_sku" />
        </div>
        <div className="glass-panel rounded-2xl p-5">
          <h2 className="flex items-center gap-2 text-sm font-semibold"><GitBranch className="h-4 w-4 rotate-180 text-primary" />Made from (backward)</h2>
          <Gen rows={backward} lotCol="input_lot" skuCol="input_sku" />
        </div>
      </div>

      <div className="glass-panel rounded-2xl p-5">
        <h2 className="text-sm font-semibold">Usage history</h2>
        <table className="mt-3 w-full text-xs"><thead className="text-[10px] uppercase text-muted-foreground"><tr><th className="py-2 text-left">When</th><th className="text-left">Order</th><th className="text-right">Used</th><th className="text-right">Planned</th><th className="text-left">How</th><th className="text-left">By</th></tr></thead>
          <tbody>{uses.map((u) => <tr key={u.id} className="border-t border-border/40"><td className="py-2">{new Date(u.created_at).toLocaleString()}</td><td><Link to="/production-orders/$poId" params={{ poId: u.production_order_id }} className="font-mono text-primary">{u.production_order_id}</Link></td><td className="text-right font-mono">{Number(u.qty)} {u.uom}</td><td className="text-right font-mono">{u.planned_qty ?? "—"}</td><td>{u.backflush ? "Backflush" : "Scanned"}</td><td>{u.actor_name}</td></tr>)}
            {uses.length === 0 && <tr><td colSpan={6} className="py-6 text-center text-muted-foreground">Not used yet.</td></tr>}</tbody></table>
      </div>
    </div>
  );
}

function Gen({ rows, lotCol, skuCol }: { rows: any[]; lotCol: string; skuCol: string }) {
  if (!rows.length) return <p className="mt-3 text-xs text-muted-foreground">No linked lots.</p>;
  return <ul className="mt-3 space-y-1 text-xs">{rows.map((r, i) => (
    <li key={i} className="flex justify-between rounded-lg border border-border/40 px-3 py-2"><span><b className="font-mono">{r[lotCol]}</b> · {r[skuCol]}</span><span className="font-mono">{Number(r.qty_used)} {r.uom} · <Link to="/production-orders/$poId" params={{ poId: r.production_order_id }} className="text-primary">{r.production_order_id}</Link></span></li>
  ))}</ul>;
}
