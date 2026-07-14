import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ScanLine, Check, Trash2, Pause, Zap, Cpu, Hand } from "lucide-react";
import { toast } from "sonner";
import { useMes } from "@/lib/mes-store";
import { useUnit, useProcessUnitAtStation } from "@/lib/units-db";
import { useProductionOrder } from "@/lib/production-orders-db";
import {
  useRecipe, type RecipeVariable,
  useStationWasteReasons, useWasteReasons,
  useLogWaste, useLogReading, useOpenHold, useHmiRealtime,
} from "@/lib/hmi-db";
import { EvidenceUploader } from "@/components/evidence-uploader";

export const Route = createFileRoute("/operator/$stationId")({
  head: ({ params }) => ({ meta: [{ title: `Operator · ${params.stationId} · Cortanex MES` }] }),
  component: OperatorApp,
  notFoundComponent: () => <div className="p-8 text-sm">Station not found.</div>,
});

function OperatorApp() {
  const { stationId } = Route.useParams();
  const store = useMes();
  const station = store.stations.find((s) => s.id === stationId);
  if (!station) throw notFound();
  const line = store.lines.find((l) => l.id === station.lineId);
  useHmiRealtime(stationId);

  const semi = (station.type as string) === "semi_auto";
  const auto = station.type === "automatic";
  const [mode, setMode] = useState<"auto" | "manual">(auto || semi ? "auto" : "manual");
  const [uid, setUid] = useState<string | null>(null);
  const [uidInput, setUidInput] = useState("");
  const { data: unit } = useUnit(uid ?? undefined);
  const { data: po } = useProductionOrder(unit?.production_order_id ?? undefined);
  const { data: recipe } = useRecipe(unit?.product_id ?? undefined, stationId);
  const vars = useMemo(() => (recipe?.variables as unknown as RecipeVariable[]) ?? [], [recipe]);
  const [values, setValues] = useState<Record<string, string | number | boolean>>({});
  useEffect(() => {
    const s: Record<string, string | number | boolean> = {};
    for (const v of vars) if (v.direction !== "output") s[v.key] = v.default ?? (v.type === "number" ? 0 : v.type === "boolean" ? false : "");
    setValues(s);
  }, [vars]);

  const { data: allowed = [] } = useStationWasteReasons(stationId);
  const { data: all = [] } = useWasteReasons();
  const options = allowed.length ? allowed : all;
  const process = useProcessUnitAtStation();
  const logReading = useLogReading();
  const logWaste = useLogWaste();
  const openHold = useOpenHold();

  const [wasteOpen, setWasteOpen] = useState(false);
  const [wasteReason, setWasteReason] = useState("");
  const [wasteNotes, setWasteNotes] = useState("");
  const [wasteFiles, setWasteFiles] = useState<string[]>([]);

  const [holdOpen, setHoldOpen] = useState(false);
  const [holdType, setHoldType] = useState<"qc" | "maintenance">("qc");
  const [holdReason, setHoldReason] = useState("");
  const [holdFiles, setHoldFiles] = useState<string[]>([]);

  function scan() {
    if (!uidInput.trim()) return;
    setUid(uidInput.trim());
    setUidInput("");
  }
  async function pass() {
    if (!uid) return;
    const ev = await process.mutateAsync({ unit_uid: uid, station_id: stationId, station_name: station!.name, line_id: line?.id, event: "processed", result: "pass" });
    await logReading.mutateAsync({ unit_uid: uid, station_id: stationId, unit_event_id: ev.id, mode, variables: values });
    toast.success(`PASS · ${uid}`);
    setUid(null);
  }
  async function scrap() {
    const r = options.find((x) => x.id === wasteReason);
    if (!r || !uid) return toast.error("Pick a reason");
    await logWaste.mutateAsync({
      unit_uid: uid, station_id: stationId, station_name: station!.name, line_id: line?.id,
      production_order_id: po?.id ?? null, lot_number: po?.lot_number ?? null,
      reason_code: r.code, reason_label: r.label, reason_category: r.category,
      notes: wasteNotes, evidence_urls: wasteFiles,
    });
    toast.error(`WASTE · ${uid}`);
    setWasteOpen(false); setWasteReason(""); setWasteNotes(""); setWasteFiles([]); setUid(null);
  }
  async function submitHold() {
    if (!holdReason.trim()) return toast.error("Enter reason");
    await openHold.mutateAsync({ station_id: stationId, hold_type: holdType, reason: holdReason, evidence_urls: holdFiles });
    toast.warning("Station on hold");
    setHoldOpen(false); setHoldReason(""); setHoldFiles([]);
  }

  const Icon = auto ? Cpu : semi ? Zap : Hand;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex items-center justify-between">
        <Link to="/operator" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3 w-3" /> Stations
        </Link>
        {semi && (
          <div className="inline-flex rounded-lg border border-border/60 bg-background/60 p-0.5 text-xs">
            {(["auto", "manual"] as const).map((m) => (
              <button key={m} onClick={() => setMode(m)} className={`rounded-md px-3 py-1 uppercase tracking-wider ${mode === m ? "bg-primary/15 text-primary" : "text-muted-foreground"}`}>{m}</button>
            ))}
          </div>
        )}
      </div>

      <div className="glass-panel rounded-2xl p-5">
        <div className="flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-xl border border-primary/40 bg-primary/10 text-primary"><Icon className="h-6 w-6" /></div>
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-xl font-semibold">{station.name}</h1>
            <p className="text-xs text-muted-foreground"><span className="font-mono">{station.id}</span> · {line?.name}</p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <ScanLine className="h-5 w-5 text-primary" />
          <input
            value={uidInput} onChange={(e) => setUidInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && scan()}
            placeholder="Scan unit UID…"
            className="flex-1 min-w-[220px] rounded-lg border border-primary/30 bg-background px-3 py-3 font-mono text-base"
            autoFocus
          />
          <button onClick={scan} className="rounded-lg border border-primary/40 bg-primary/10 px-4 py-3 text-sm font-medium text-primary">Load</button>
        </div>

        {uid && unit && (
          <div className="mt-4 rounded-xl border border-border/40 bg-background/40 p-3">
            <div className="grid gap-2 text-sm md:grid-cols-3">
              <div><div className="text-[10px] uppercase tracking-wider text-muted-foreground">Unit</div><div className="font-mono">{unit.uid}</div></div>
              <div><div className="text-[10px] uppercase tracking-wider text-muted-foreground">Product</div><div>{unit.product_name}</div></div>
              <div><div className="text-[10px] uppercase tracking-wider text-muted-foreground">Lot</div><div className="font-mono">{unit.lot_number}</div></div>
              {po && (
                <>
                  <div><div className="text-[10px] uppercase tracking-wider text-muted-foreground">Order</div><div className="font-mono">{po.number}</div></div>
                  <div><div className="text-[10px] uppercase tracking-wider text-muted-foreground">Qty</div><div className="font-mono">{Number(po.qty_produced)}/{Number(po.qty)} {po.uom}</div></div>
                  <div><div className="text-[10px] uppercase tracking-wider text-muted-foreground">Status</div><div>{po.status}</div></div>
                </>
              )}
            </div>

            {vars.length > 0 && (
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {vars.map((v) => (
                  <label key={v.key} className="block">
                    <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-muted-foreground">
                      <span>{v.label}{v.required && <span className="text-destructive"> *</span>}</span>
                      <span className="font-mono">{v.unit ?? ""}</span>
                    </div>
                    {v.type === "boolean" ? (
                      <button type="button" onClick={() => setValues((s) => ({ ...s, [v.key]: !s[v.key] }))} className={`mt-1 h-10 w-full rounded-lg border text-sm ${values[v.key] ? "border-success/40 bg-success/10 text-success" : "border-border/60 bg-background/60"}`} disabled={v.direction === "output" || (mode === "auto" && v.direction === "input")}>
                        {values[v.key] ? "YES" : "NO"}
                      </button>
                    ) : v.type === "select" ? (
                      <select value={String(values[v.key] ?? "")} onChange={(e) => setValues((s) => ({ ...s, [v.key]: e.target.value }))} className="mt-1 h-10 w-full rounded-lg border border-border/60 bg-background/60 px-2 text-sm">
                        <option value="">—</option>
                        {(v.options ?? []).map((o) => <option key={o} value={o}>{o}</option>)}
                      </select>
                    ) : (
                      <input
                        type={v.type === "number" ? "number" : "text"}
                        min={v.min} max={v.max}
                        value={String(values[v.key] ?? "")}
                        onChange={(e) => setValues((s) => ({ ...s, [v.key]: v.type === "number" ? Number(e.target.value) : e.target.value }))}
                        disabled={v.direction === "output" || (mode === "auto" && v.direction === "input")}
                        className="mt-1 h-10 w-full rounded-lg border border-border/60 bg-background/60 px-2 font-mono text-sm disabled:opacity-50"
                      />
                    )}
                  </label>
                ))}
              </div>
            )}

            <div className="mt-4 grid gap-2 sm:grid-cols-3">
              <button onClick={pass} className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-success/40 bg-success/10 px-3 py-3 text-sm font-medium text-success hover:bg-success/20">
                <Check className="h-4 w-4" /> Pass unit
              </button>
              <button onClick={() => setWasteOpen(true)} className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-3 text-sm font-medium text-destructive hover:bg-destructive/20">
                <Trash2 className="h-4 w-4" /> Waste
              </button>
              <button onClick={() => setHoldOpen(true)} className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-warning/40 bg-warning/10 px-3 py-3 text-sm font-medium text-warning hover:bg-warning/20">
                <Pause className="h-4 w-4" /> Hold station
              </button>
            </div>
          </div>
        )}
      </div>

      {wasteOpen && (
        <Modal title={`Waste ${uid}`} onClose={() => setWasteOpen(false)}>
          <select value={wasteReason} onChange={(e) => setWasteReason(e.target.value)} className="h-10 w-full rounded-lg border border-border/60 bg-background/60 px-2 text-sm">
            <option value="">— select reason —</option>
            {options.map((r) => <option key={r.id} value={r.id}>[{r.category}] {r.label}</option>)}
          </select>
          <textarea value={wasteNotes} onChange={(e) => setWasteNotes(e.target.value)} rows={3} placeholder="Notes" className="w-full rounded-lg border border-border/60 bg-background/60 p-2 text-sm" />
          <EvidenceUploader value={wasteFiles} onChange={setWasteFiles} prefix={`waste/${stationId}`} label="Evidence" />
          <div className="flex justify-end gap-2">
            <button onClick={() => setWasteOpen(false)} className="rounded-lg border border-border/60 px-3 py-2 text-sm">Cancel</button>
            <button onClick={scrap} className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">Confirm waste</button>
          </div>
        </Modal>
      )}

      {holdOpen && (
        <Modal title="Put station on hold" onClose={() => setHoldOpen(false)}>
          <select value={holdType} onChange={(e) => setHoldType(e.target.value as never)} className="h-10 w-full rounded-lg border border-border/60 bg-background/60 px-2 text-sm">
            <option value="qc">QC review</option>
            <option value="maintenance">Maintenance</option>
          </select>
          <input value={holdReason} onChange={(e) => setHoldReason(e.target.value)} placeholder="Reason" className="h-10 w-full rounded-lg border border-border/60 bg-background/60 px-2 text-sm" />
          <EvidenceUploader value={holdFiles} onChange={setHoldFiles} prefix={`hold/${stationId}`} label="Evidence" />
          <div className="flex justify-end gap-2">
            <button onClick={() => setHoldOpen(false)} className="rounded-lg border border-border/60 px-3 py-2 text-sm">Cancel</button>
            <button onClick={submitHold} className="rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-warning">Put on hold</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-background/70 p-4 backdrop-blur">
      <div className="w-full max-w-md space-y-3 rounded-2xl border border-border/60 bg-card p-4 shadow-xl">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-lg font-semibold">{title}</h3>
          <button onClick={onClose} className="text-muted-foreground">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}
