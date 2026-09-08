import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Search, Scan, Package, ExternalLink, Layers, Radio } from "lucide-react";
import { useUnits, useUnitsRealtime, useRecentUnitEvents, useOpenStationVisits } from "@/lib/units-db";
import { useProductionOrders } from "@/lib/production-orders-db";
import { useBatches, useBatchesRealtime } from "@/lib/batches-db";
import { useMes } from "@/lib/mes-store";

export const Route = createFileRoute("/_authenticated/tracking")({
  head: () => ({
    meta: [
      { title: "Product Tracking · Cortanex MES" },
      { name: "description", content: "Trace every product through the production line by unit UID, lot number, or PO — with a full station-by-station history." },
    ],
  }),
  component: Tracking,
});

function Tracking() {
  useUnitsRealtime();
  useBatchesRealtime();
  const { data: units = [] } = useUnits({ limit: 2000 });
  const { data: recent = [] } = useRecentUnitEvents(40);
  const { data: pos = [] } = useProductionOrders();
  const { data: batches = [] } = useBatches();
  const { data: openVisits = [] } = useOpenStationVisits();
  const store = useMes();
  const stations = store.stations;

  const [q, setQ] = useState("");

  const matches = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return [];
    return units
      .filter((u) =>
        u.uid.toLowerCase().includes(s) ||
        u.lot_number.toLowerCase().includes(s) ||
        u.sku.toLowerCase().includes(s) ||
        (u.production_order_id ?? "").toLowerCase().includes(s) ||
        (u.batch_id ?? "").toLowerCase().includes(s) ||
        u.product_name.toLowerCase().includes(s)
      )
      .slice(0, 50);
  }, [q, units]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight">Product Tracking</h1>
        <p className="text-sm text-muted-foreground">
          Search by unit UID, lot number, PO number or SKU. Every step processed on every unit is captured.
        </p>
      </div>

      <div className="glass-panel rounded-2xl p-4">
        <div className="relative">
          <Scan className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-primary" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Scan or type UID, lot, PO, SKU…"
            className="h-11 w-full rounded-xl border border-border/60 bg-card/60 pl-10 pr-3 text-sm focus:border-primary/50 focus:outline-none"
          />
        </div>
        {q && (
          <div className="mt-3 divide-y divide-border/40">
            {matches.length === 0 && <p className="py-4 text-xs text-muted-foreground">No matching units.</p>}
            {matches.map((u) => (
              <Link key={u.uid} to="/units/$uid" params={{ uid: u.uid }}
                className="flex items-center justify-between py-2.5 text-xs hover:text-primary">
                <div className="flex items-center gap-3">
                  <Package className="h-3.5 w-3.5 text-primary" />
                  <span className="font-mono text-primary">{u.uid}</span>
                  <span className="text-muted-foreground">{u.product_name}</span>
                </div>
                <div className="flex items-center gap-3 font-mono text-[10px] text-muted-foreground">
                  <span>Lot {u.lot_number}</span>
                  <span>{u.production_order_id}</span>
                  <span className="rounded-full border border-border/60 bg-card/60 px-2 py-0.5 uppercase">{u.status}</span>
                  <ExternalLink className="h-3 w-3" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Currently processing — from open station visits (entered_at set, exited_at null) */}
      <div className="glass-panel rounded-2xl p-5">
        <div className="flex items-center gap-2">
          <Radio className="h-4 w-4 animate-pulse text-success" />
          <h2 className="text-sm font-semibold">Currently processing at stations</h2>
          <span className="ml-auto text-xs text-muted-foreground">{openVisits.length} unit{openVisits.length === 1 ? "" : "s"} in-station right now</span>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {stations.map((st) => {
            const list = openVisits.filter((v) => v.station_id === st.id);
            if (list.length === 0) return null;
            return (
              <div key={st.id} className="rounded-xl border border-success/30 bg-success/5 p-3">
                <div className="flex items-center justify-between text-xs">
                  <div>
                    <span className="font-mono text-primary">{st.id}</span>
                    <span className="ml-2">{st.name}</span>
                  </div>
                  <span className="rounded-full border border-success/40 bg-success/10 px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-success">
                    {list.length} live
                  </span>
                </div>
                <div className="mt-2 space-y-1">
                  {list.slice(0, 6).map((v) => {
                    const secs = v.entered_at ? Math.round((Date.now() - new Date(v.entered_at).getTime()) / 1000) : 0;
                    return (
                      <Link key={v.id} to="/units/$uid" params={{ uid: v.unit_uid }}
                        className="flex items-center justify-between rounded border border-border/60 bg-card/60 px-2 py-1 font-mono text-[10px] hover:border-primary/40 hover:text-primary">
                        <span className="truncate">{v.unit_uid}</span>
                        <span className="text-muted-foreground">{secs}s</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
          {openVisits.length === 0 && (
            <p className="col-span-full py-4 text-xs text-muted-foreground">
              No unit is inside a station right now. Enter a unit at a station from a <Link to="/hmi" className="text-primary">station HMI</Link> or <Link to="/tracking" className="text-primary">unit page</Link>.
            </p>
          )}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Batches quick browse */}
        <div className="glass-panel rounded-2xl p-5">
          <h2 className="flex items-center gap-2 text-sm font-semibold"><Layers className="h-4 w-4 text-primary" /> By batch</h2>
          <p className="text-xs text-muted-foreground">Progress per batch across all orders</p>
          <div className="mt-3 divide-y divide-border/40">
            {batches.slice(0, 10).map((b) => {
              const pct = Number(b.qty) > 0 ? Math.round((Number(b.qty_produced) / Number(b.qty)) * 100) : 0;
              return (
                <Link key={b.id} to="/batches/$batchId" params={{ batchId: b.id }}
                  className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-2 text-xs hover:text-primary">
                  <div className="min-w-0">
                    <div className="font-mono text-[10px] text-muted-foreground truncate">{b.number} · lot {b.lot_number}</div>
                    <div className="truncate">{b.product_name}</div>
                  </div>
                  <div className="flex items-center gap-2 font-mono text-[10px]">
                    <div className="h-1.5 w-16 overflow-hidden rounded-full bg-card/80">
                      <div className="h-full bg-gradient-to-r from-primary to-info" style={{ width: `${pct}%` }} />
                    </div>
                    <span>{pct}%</span>
                  </div>
                </Link>
              );
            })}
            {batches.length === 0 && <p className="py-4 text-xs text-muted-foreground">No batches yet.</p>}
          </div>
        </div>

        {/* Recent scans */}
        <div className="glass-panel rounded-2xl p-5">
          <h2 className="text-sm font-semibold">Recent station events</h2>
          <p className="text-xs text-muted-foreground">Latest enter/exit events across all units</p>
          <div className="mt-3 divide-y divide-border/40">
            {recent.length === 0 && <p className="py-4 text-xs text-muted-foreground">No events yet.</p>}
            {recent.map((e) => (
              <div key={e.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 py-2 text-xs">
                <div className="min-w-0">
                  <Link to="/units/$uid" params={{ uid: e.unit_uid }} className="font-mono text-primary">{e.unit_uid}</Link>
                  <span className="ml-2 text-muted-foreground">@ {e.station_id ?? "—"} · {e.event}{e.dwell_seconds != null ? ` · ${e.dwell_seconds}s` : ""}</span>
                </div>
                <span className="font-mono text-[10px] text-muted-foreground">{new Date(e.at).toLocaleTimeString([], { hour12: false })}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Orders quick browse */}
      <div className="glass-panel rounded-2xl p-5">
        <h2 className="text-sm font-semibold">By production order</h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {pos.slice(0, 12).map((o) => (
            <Link key={o.id} to="/production-orders/$poId" params={{ poId: o.id }}
              className="rounded-lg border border-border/60 bg-card/60 p-3 hover:border-primary/40">
              <div className="font-mono text-[10px] text-muted-foreground">{o.number} · lot {o.lot_number}</div>
              <div className="text-sm">{o.product_name}</div>
              <div className="mt-1 flex items-center justify-between text-[11px] text-muted-foreground">
                <span>{o.line_id ?? "—"}</span>
                <span className="rounded-full border border-border/60 bg-card/60 px-2 py-0.5 uppercase">{o.status}</span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
