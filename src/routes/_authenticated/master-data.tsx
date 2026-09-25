import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, Lock, Unlock } from "lucide-react";
import { useRows, useWrite, errMsg } from "@/lib/execution-db";
import { useListControls } from "@/components/list-controls";
import { useProducts } from "@/lib/products-db";

export const Route = createFileRoute("/_authenticated/master-data")({
  head: () => ({
    meta: [
      { title: "Master Data · Cortanex MES" },
      { name: "description", content: "Work centers, BOMs, routings with work instructions, production versions and the ERP replication log." },
      { property: "og:title", content: "Master Data · Cortanex MES" },
      { property: "og:description", content: "ERP-replicated master data for production order execution." },
    ],
  }),
  component: MasterData,
});

const TABS = ["Work centers", "BOMs", "Routings", "Production versions", "ERP sync log"] as const;
const inp = "h-8 rounded-lg border border-border/60 bg-card/60 px-2 text-xs focus:border-primary/50 focus:outline-none";
const btn = "flex h-8 items-center gap-1 rounded-lg bg-primary px-2.5 text-xs font-medium text-primary-foreground disabled:opacity-50";
const iconBtn = "grid h-7 w-7 place-items-center rounded-lg border border-border/60 text-muted-foreground hover:text-foreground";

function MasterData() {
  const [tab, setTab] = useState<(typeof TABS)[number]>("Work centers");
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight">Master Data</h1>
        <p className="text-sm text-muted-foreground">Replicated from ERP (materials, work centers, BOMs, routings, batch numbers, production versions). Lock a record with "MES override" so the next ERP sync doesn't overwrite it.</p>
      </div>
      <div className="flex flex-wrap gap-1">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`rounded-full border px-3 py-1 text-xs ${tab === t ? "border-primary/60 bg-primary/10 text-primary" : "border-border/60 text-muted-foreground"}`}>{t}</button>
        ))}
      </div>
      {tab === "Work centers" && <WorkCenters />}
      {tab === "BOMs" && <Boms />}
      {tab === "Routings" && <Routings />}
      {tab === "Production versions" && <Versions />}
      {tab === "ERP sync log" && <SyncLog />}
    </div>
  );
}

function OverrideToggle({ table, row }: { table: string; row: any }) {
  const w = useWrite(table);
  return (
    <button title={row.mes_override ? "MES override on — ERP will not overwrite" : "ERP controlled"} className={iconBtn}
      onClick={() => w.update.mutate({ id: row.id, patch: { mes_override: !row.mes_override } }, { onError: (e) => toast.error(errMsg(e)) })}>
      {row.mes_override ? <Lock className="h-3.5 w-3.5 text-warning" /> : <Unlock className="h-3.5 w-3.5" />}
    </button>
  );
}
function Del({ table, id }: { table: string; id: string }) {
  const w = useWrite(table);
  return (
    <button className={iconBtn} aria-label="Delete" onClick={() => { if (confirm("Delete?")) w.remove.mutate(id, { onError: (e) => toast.error(errMsg(e)) }); }}>
      <Trash2 className="h-3.5 w-3.5" />
    </button>
  );
}

function Table({ cols, rows, render }: { cols: string[]; rows: any[]; render: (r: any) => React.ReactNode[] }) {
  return (
    <div className="glass-panel overflow-x-auto rounded-2xl">
      <table className="w-full text-sm">
        <thead className="bg-card/60 text-[11px] uppercase tracking-wider text-muted-foreground">
          <tr>{cols.map((c) => <th key={c} className="px-3 py-2 text-left">{c}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r) => <tr key={r.id} className="border-t border-border/40 align-top">{render(r).map((c, i) => <td key={i} className="px-3 py-2 text-xs">{c}</td>)}</tr>)}
          {rows.length === 0 && <tr><td colSpan={cols.length} className="px-3 py-6 text-center text-xs text-muted-foreground">Nothing yet.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

function WorkCenters() {
  const { data = [] } = useRows("work_centers");
  const w = useWrite("work_centers");
  const [f, setF] = useState({ id: "", name: "", kind: "line", line_id: "" });
  const lc = useListControls(data, { exportName: "work-centers", dateKey: "created_at" as never });
  return (
    <div className="space-y-3">
      <div className="glass-panel flex flex-wrap gap-2 rounded-2xl p-3">
        <input className={inp} placeholder="ID (e.g. WC-FILL)" value={f.id} onChange={(e) => setF({ ...f, id: e.target.value })} />
        <input className={inp} placeholder="Name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        <select className={inp} value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}>{["line", "station", "machine", "labor"].map((k) => <option key={k}>{k}</option>)}</select>
        <input className={inp} placeholder="Line / station ID (optional)" value={f.line_id} onChange={(e) => setF({ ...f, line_id: e.target.value })} />
        <button className={btn} disabled={!f.id || !f.name} onClick={() => w.insert.mutate({ id: f.id, name: f.name, kind: f.kind, line_id: f.line_id || null }, { onSuccess: () => { toast.success("Work center added"); setF({ id: "", name: "", kind: "line", line_id: "" }); }, onError: (e) => toast.error(errMsg(e)) })}><Plus className="h-3.5 w-3.5" />Add</button>
      </div>
      {lc.toolbar}
      <Table cols={["ID", "Name", "Kind", "Line", "ERP", ""]} rows={lc.visible} render={(r) => [
        <span className="font-mono">{r.id}</span>, r.name, r.kind, r.line_id ?? "—", r.erp_id ?? "—",
        <div className="flex gap-1"><OverrideToggle table="work_centers" row={r} /><Del table="work_centers" id={r.id} /></div>,
      ]} />
      {lc.pager}
    </div>
  );
}

function Boms() {
  const { data = [] } = useRows("boms");
  const { data: items = [] } = useRows("bom_items", { order: "sequence", asc: true });
  const { data: products = [] } = useProducts();
  const w = useWrite("boms");
  const wi = useWrite("bom_items");
  const [f, setF] = useState({ product_id: "", version: "1", base_qty: 1 });
  const [it, setIt] = useState<Record<string, any>>({});
  const lc = useListControls(data, { exportName: "boms", dateKey: "created_at" as never });
  return (
    <div className="space-y-3">
      <div className="glass-panel flex flex-wrap gap-2 rounded-2xl p-3">
        <select className={inp} value={f.product_id} onChange={(e) => setF({ ...f, product_id: e.target.value })}>
          <option value="">Product…</option>{products.map((p) => <option key={p.id} value={p.id}>{p.sku} · {p.name}</option>)}
        </select>
        <input className={inp} placeholder="Version" value={f.version} onChange={(e) => setF({ ...f, version: e.target.value })} />
        <input className={inp} type="number" placeholder="Base qty" value={f.base_qty} onChange={(e) => setF({ ...f, base_qty: Number(e.target.value) })} />
        <button className={btn} disabled={!f.product_id} onClick={() => {
          const p = products.find((x) => x.id === f.product_id)!;
          w.insert.mutate({ id: `BOM-${p.sku}-${f.version}`, product_id: p.id, sku: p.sku, version: f.version, base_qty: f.base_qty, uom: p.uom }, { onSuccess: () => toast.success("BOM added"), onError: (e) => toast.error(errMsg(e)) });
        }}><Plus className="h-3.5 w-3.5" />Add BOM</button>
      </div>
      {lc.toolbar}
      {lc.visible.map((b: any) => {
        const mine = items.filter((i: any) => i.bom_id === b.id);
        const n = it[b.id] ?? { item_type: "component", sku: "", name: "", qty: 1, uom: "kg", backflush: false, auto_confirm: false };
        const set = (patch: any) => setIt({ ...it, [b.id]: { ...n, ...patch } });
        return (
          <div key={b.id} className="glass-panel space-y-2 rounded-2xl p-3">
            <div className="flex items-center justify-between">
              <div><span className="font-mono text-sm text-primary">{b.id}</span> <span className="text-xs text-muted-foreground">{b.sku} · v{b.version} · per {b.base_qty} {b.uom}</span></div>
              <div className="flex gap-1"><OverrideToggle table="boms" row={b} /><Del table="boms" id={b.id} /></div>
            </div>
            <Table cols={["Type", "Component", "Qty", "Backflush", "Auto-confirm", ""]} rows={mine} render={(i) => [
              i.item_type.replace("_", "-"), `${i.component_sku} · ${i.component_name}`, `${i.qty} ${i.uom}`, i.backflush ? "yes" : "—", i.auto_confirm ? "yes" : "—", <Del table="bom_items" id={i.id} />,
            ]} />
            <div className="flex flex-wrap items-center gap-2">
              <select className={inp} value={n.item_type} onChange={(e) => set({ item_type: e.target.value })}>
                <option value="component">component</option><option value="co_product">co-product</option><option value="by_product">by-product</option>
              </select>
              <input className={inp} placeholder="SKU" value={n.sku} onChange={(e) => set({ sku: e.target.value })} />
              <input className={inp} placeholder="Name" value={n.name} onChange={(e) => set({ name: e.target.value })} />
              <input className={`${inp} w-20`} type="number" value={n.qty} onChange={(e) => set({ qty: Number(e.target.value) })} />
              <input className={`${inp} w-16`} value={n.uom} onChange={(e) => set({ uom: e.target.value })} />
              <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={n.backflush} onChange={(e) => set({ backflush: e.target.checked })} />Backflush</label>
              <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={n.auto_confirm} onChange={(e) => set({ auto_confirm: e.target.checked })} />Auto-confirm</label>
              <button className={btn} disabled={!n.sku} onClick={() => wi.insert.mutate({ bom_id: b.id, organization_id: b.organization_id, item_type: n.item_type, component_sku: n.sku, component_name: n.name || n.sku, qty: n.qty, uom: n.uom, backflush: n.backflush, auto_confirm: n.auto_confirm, sequence: (mine.length + 1) * 10 }, { onSuccess: () => set({ sku: "", name: "" }), onError: (e) => toast.error(errMsg(e)) })}><Plus className="h-3.5 w-3.5" />Item</button>
            </div>
          </div>
        );
      })}
      {lc.pager}
    </div>
  );
}

function Routings() {
  const { data = [] } = useRows("routings");
  const { data: ops = [] } = useRows("routing_operations", { order: "sequence", asc: true });
  const { data: wcs = [] } = useRows("work_centers");
  const { data: products = [] } = useProducts();
  const w = useWrite("routings");
  const wo = useWrite("routing_operations");
  const [f, setF] = useState({ product_id: "", version: "1" });
  const [op, setOp] = useState<Record<string, any>>({});
  const lc = useListControls(data, { exportName: "routings", dateKey: "created_at" as never });
  return (
    <div className="space-y-3">
      <div className="glass-panel flex flex-wrap gap-2 rounded-2xl p-3">
        <select className={inp} value={f.product_id} onChange={(e) => setF({ ...f, product_id: e.target.value })}>
          <option value="">Product…</option>{products.map((p) => <option key={p.id} value={p.id}>{p.sku} · {p.name}</option>)}
        </select>
        <input className={inp} placeholder="Version" value={f.version} onChange={(e) => setF({ ...f, version: e.target.value })} />
        <button className={btn} disabled={!f.product_id} onClick={() => {
          const p = products.find((x) => x.id === f.product_id)!;
          w.insert.mutate({ id: `RT-${p.sku}-${f.version}`, product_id: p.id, sku: p.sku, version: f.version }, { onSuccess: () => toast.success("Routing added"), onError: (e) => toast.error(errMsg(e)) });
        }}><Plus className="h-3.5 w-3.5" />Add routing</button>
      </div>
      {lc.toolbar}
      {lc.visible.map((r: any) => {
        const mine = ops.filter((o: any) => o.routing_id === r.id);
        const n = op[r.id] ?? { name: "", work_center_id: "", setup_min: 0, run_min_per_unit: 0, work_instructions: "" };
        const set = (patch: any) => setOp({ ...op, [r.id]: { ...n, ...patch } });
        return (
          <div key={r.id} className="glass-panel space-y-2 rounded-2xl p-3">
            <div className="flex items-center justify-between">
              <div><span className="font-mono text-sm text-primary">{r.id}</span> <span className="text-xs text-muted-foreground">{r.sku} · v{r.version}</span></div>
              <div className="flex gap-1"><OverrideToggle table="routings" row={r} /><Del table="routings" id={r.id} /></div>
            </div>
            <Table cols={["Seq", "Operation", "Work center", "Setup / run", "Work instructions", ""]} rows={mine} render={(o) => [
              o.sequence, o.name, o.work_center_id ?? "—", `${o.setup_min} min / ${o.run_min_per_unit} min·unit`, <span className="whitespace-pre-wrap">{o.work_instructions ?? "—"}</span>, <Del table="routing_operations" id={o.id} />,
            ]} />
            <div className="flex flex-wrap items-center gap-2">
              <input className={inp} placeholder="Operation name" value={n.name} onChange={(e) => set({ name: e.target.value })} />
              <select className={inp} value={n.work_center_id} onChange={(e) => set({ work_center_id: e.target.value })}>
                <option value="">Work center…</option>{wcs.map((c: any) => <option key={c.id} value={c.id}>{c.id} · {c.name}</option>)}
              </select>
              <input className={`${inp} w-20`} type="number" title="Setup minutes" value={n.setup_min} onChange={(e) => set({ setup_min: Number(e.target.value) })} />
              <input className={`${inp} w-20`} type="number" title="Run minutes per unit" value={n.run_min_per_unit} onChange={(e) => set({ run_min_per_unit: Number(e.target.value) })} />
              <input className={`${inp} min-w-[240px] flex-1`} placeholder="Work instructions for the operator" value={n.work_instructions} onChange={(e) => set({ work_instructions: e.target.value })} />
              <button className={btn} disabled={!n.name} onClick={() => wo.insert.mutate({ routing_id: r.id, organization_id: r.organization_id, sequence: (mine.length + 1) * 10, name: n.name, work_center_id: n.work_center_id || null, setup_min: n.setup_min, run_min_per_unit: n.run_min_per_unit, work_instructions: n.work_instructions || null }, { onSuccess: () => set({ name: "", work_instructions: "" }), onError: (e) => toast.error(errMsg(e)) })}><Plus className="h-3.5 w-3.5" />Operation</button>
            </div>
          </div>
        );
      })}
      {lc.pager}
    </div>
  );
}

function Versions() {
  const { data = [] } = useRows("production_versions");
  const { data: boms = [] } = useRows("boms");
  const { data: routings = [] } = useRows("routings");
  const { data: products = [] } = useProducts();
  const w = useWrite("production_versions");
  const [f, setF] = useState({ product_id: "", version: "0001", description: "", bom_id: "", routing_id: "", valid_from: "", valid_to: "", is_default: false });
  const p = products.find((x) => x.id === f.product_id);
  const lc = useListControls(data, { exportName: "production-versions", dateKey: "created_at" as never });
  return (
    <div className="space-y-3">
      <div className="glass-panel flex flex-wrap gap-2 rounded-2xl p-3">
        <select className={inp} value={f.product_id} onChange={(e) => setF({ ...f, product_id: e.target.value })}>
          <option value="">Product…</option>{products.map((x) => <option key={x.id} value={x.id}>{x.sku} · {x.name}</option>)}
        </select>
        <input className={`${inp} w-20`} placeholder="Version" value={f.version} onChange={(e) => setF({ ...f, version: e.target.value })} />
        <input className={inp} placeholder="Scenario (e.g. Line 2 alt. recipe)" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
        <select className={inp} value={f.bom_id} onChange={(e) => setF({ ...f, bom_id: e.target.value })}>
          <option value="">BOM…</option>{boms.filter((b: any) => !p || b.sku === p.sku).map((b: any) => <option key={b.id} value={b.id}>{b.id}</option>)}
        </select>
        <select className={inp} value={f.routing_id} onChange={(e) => setF({ ...f, routing_id: e.target.value })}>
          <option value="">Routing…</option>{routings.filter((r: any) => !p || r.sku === p.sku).map((r: any) => <option key={r.id} value={r.id}>{r.id}</option>)}
        </select>
        <input className={inp} type="date" value={f.valid_from} onChange={(e) => setF({ ...f, valid_from: e.target.value })} title="Valid from" />
        <input className={inp} type="date" value={f.valid_to} onChange={(e) => setF({ ...f, valid_to: e.target.value })} title="Valid to" />
        <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={f.is_default} onChange={(e) => setF({ ...f, is_default: e.target.checked })} />Default</label>
        <button className={btn} disabled={!p || !f.bom_id || !f.routing_id} onClick={() => w.insert.mutate({
          id: `PV-${p!.sku}-${f.version}`, product_id: p!.id, sku: p!.sku, version: f.version, description: f.description || null,
          bom_id: f.bom_id, routing_id: f.routing_id, valid_from: f.valid_from || null, valid_to: f.valid_to || null, is_default: f.is_default,
        }, { onSuccess: () => toast.success("Production version added"), onError: (e) => toast.error(errMsg(e)) })}><Plus className="h-3.5 w-3.5" />Add</button>
      </div>
      {lc.toolbar}
      <Table cols={["ID", "Material", "Scenario", "BOM", "Routing", "Valid", "Default", ""]} rows={lc.visible} render={(r) => [
        <span className="font-mono">{r.id}</span>, r.sku, r.description ?? "—", r.bom_id ?? "—", r.routing_id ?? "—",
        `${r.valid_from ?? "…"} → ${r.valid_to ?? "…"}`, r.is_default ? "yes" : "—",
        <div className="flex gap-1"><OverrideToggle table="production_versions" row={r} /><Del table="production_versions" id={r.id} /></div>,
      ]} />
      {lc.pager}
    </div>
  );
}

function SyncLog() {
  const { data = [] } = useRows("erp_sync_log");
  const lc = useListControls(data, { exportName: "erp-sync-log", dateKey: "created_at" as never, searchKeys: ["entity", "erp_id", "status", "message"] as never });
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">ERP systems send records to <span className="font-mono">/api/mes/v1/erp/&#123;materials | work-centers | boms | routings | production-versions | batch-numbers | production-orders&#125;</span> with the company's data-feed key, and read results from <span className="font-mono">/api/mes/v1/erp/&#123;confirmations | goods-receipts | consumptions | activities&#125;</span>.</p>
      {lc.toolbar}
      <Table cols={["When", "Entity", "ERP ID", "Result", "Message"]} rows={lc.visible} render={(r) => [
        new Date(r.created_at).toLocaleString(), r.entity, <span className="font-mono">{r.erp_id}</span>,
        <span className={r.status === "error" ? "text-destructive" : r.status === "skipped" ? "text-warning" : "text-success"}>{r.status}</span>, r.message ?? "",
      ]} />
      {lc.pager}
    </div>
  );
}
