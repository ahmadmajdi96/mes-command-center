import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft, ScanLine, Cpu, Hand, Zap, ShieldAlert, Wrench, Trash2,
  Play, Check, X, AlertOctagon, Pause, RotateCw, ClipboardList,
} from "lucide-react";
import { toast } from "sonner";
import { useMes } from "@/lib/mes-store";
import { useUnit, useProcessUnitAtStation } from "@/lib/units-db";
import { useProductionOrder } from "@/lib/production-orders-db";
import { useProduct } from "@/lib/products-db";
import {
  useRecipe, type RecipeVariable,
  useStationWasteReasons, useWasteReasons, useSetStationWasteReasons,
  useLogWaste, useLogReading,
  useStationHolds, useOpenHold, useCloseHold,
  useHmiRealtime,
} from "@/lib/hmi-db";
import { EvidenceUploader } from "@/components/evidence-uploader";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/hmi/$stationId")({
  head: ({ params }) => ({
    meta: [
      { title: `HMI · ${params.stationId} · Cortanex MES` },
      { name: "description", content: "Dynamic Human-Machine Interface: readings, waste, hold-for-QC/maintenance, evidence uploads." },
    ],
  }),
  component: HmiStation,
  notFoundComponent: () => <div className="p-8 text-sm text-muted-foreground">Station not found.</div>,
});

function HmiStation() {
  const { stationId } = Route.useParams();
  const store = useMes();
  const station = store.stations.find((s) => s.id === stationId);
  if (!station) throw notFound();
  const line = store.lines.find((l) => l.id === station.lineId);
  useHmiRealtime(stationId);

  const isSemi = (station.type as string) === "semi_auto";
  const isAuto = station.type === "automatic";

  const [mode, setMode] = useState<"auto" | "manual">(isAuto || isSemi ? "auto" : "manual");
  const [uidInput, setUidInput] = useState("");
  const [activeUid, setActiveUid] = useState<string | null>(null);

  const { data: unit } = useUnit(activeUid ?? undefined);
  const { data: po } = useProductionOrder(unit?.production_order_id ?? undefined);
  const { data: product } = useProduct(unit?.product_id ?? undefined);
  const { data: recipe } = useRecipe(unit?.product_id ?? undefined, stationId);
  const { data: openHolds = [] } = useStationHolds(stationId, true);
  const { data: allowedReasons = [] } = useStationWasteReasons(stationId);
  const { data: allReasons = [] } = useWasteReasons();
  const setStationReasons = useSetStationWasteReasons();
  const process = useProcessUnitAtStation();
  const logWaste = useLogWaste();
  const logReading = useLogReading();
  const openHold = useOpenHold();
  const closeHold = useCloseHold();

  const variables = useMemo(() => (recipe?.variables as unknown as RecipeVariable[]) ?? [], [recipe]);
  const [values, setValues] = useState<Record<string, string | number | boolean>>({});
  useEffect(() => {
    const seed: Record<string, string | number | boolean> = {};
    for (const v of variables) {
      if (v.direction === "input" || v.direction === "reading") {
        seed[v.key] = (v.default ?? (v.type === "boolean" ? false : v.type === "number" ? 0 : "")) as never;
      }
    }
    setValues(seed);
  }, [variables]);

  function scan() {
    const v = uidInput.trim();
    if (!v) return;
    setActiveUid(v);
    setUidInput("");
  }

  async function startOp() {
    if (!activeUid) return toast.error("Scan a unit first");
    await process.mutateAsync({
      unit_uid: activeUid, station_id: stationId, station_name: station!.name, line_id: line?.id,
      event: "started",
    });
    toast.success("Operation started");
  }

  async function completeOp() {
    if (!activeUid) return toast.error("Scan a unit first");
    // Validate required inputs
    for (const v of variables) {
      if ((v.direction === "input" || v.direction === "reading") && v.required && (values[v.key] === "" || values[v.key] === undefined)) {
        return toast.error(`Missing: ${v.label}`);
      }
      if (v.type === "number" && (v.min !== undefined || v.max !== undefined)) {
        const n = Number(values[v.key]);
        if (!Number.isNaN(n)) {
          if (v.min !== undefined && n < v.min) return toast.error(`${v.label} below min ${v.min}`);
          if (v.max !== undefined && n > v.max) return toast.error(`${v.label} above max ${v.max}`);
        }
      }
    }
    const ev = await process.mutateAsync({
      unit_uid: activeUid, station_id: stationId, station_name: station!.name, line_id: line?.id,
      event: "processed", result: "pass",
    });
    await logReading.mutateAsync({
      unit_uid: activeUid, station_id: stationId, unit_event_id: ev.id, mode, variables: values,
    });
    toast.success(`Unit ${activeUid} processed`);
    setActiveUid(null);
  }

  return (
    <div className="space-y-4">
      <div>
        <Link to="/hmi" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3 w-3" /> All stations
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <div className={`grid h-11 w-11 place-items-center rounded-xl border ${
            isAuto ? "border-primary/40 bg-primary/10 text-primary"
            : isSemi ? "border-warning/40 bg-warning/10 text-warning"
            : "border-accent/40 bg-accent/10 text-accent"
          }`}>
            {isAuto ? <Cpu className="h-5 w-5" /> : isSemi ? <Zap className="h-5 w-5" /> : <Hand className="h-5 w-5" />}
          </div>
          <div className="min-w-0">
            <h1 className="font-display text-xl font-semibold tracking-tight">HMI · {station.name}</h1>
            <p className="text-xs text-muted-foreground">
              <span className="font-mono">{station.id}</span> · {isSemi ? "semi-auto" : station.type} · {line?.name ?? "—"}
            </p>
          </div>
          {isSemi && (
            <div className="ml-auto inline-flex rounded-lg border border-border/60 bg-background/60 p-0.5 text-xs">
              {(["auto", "manual"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`rounded-md px-3 py-1 uppercase tracking-wider ${
                    mode === m ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          )}
          {openHolds.length > 0 && (
            <span className="rounded-full border border-destructive/40 bg-destructive/10 px-2 py-0.5 text-[10px] uppercase tracking-wider text-destructive">
              {openHolds.length} hold(s) open
            </span>
          )}
        </div>
      </div>

      {/* Scan / unit context */}
      <div className="glass-panel rounded-2xl p-4">
        <div className="flex flex-wrap items-center gap-2">
          <ScanLine className="h-4 w-4 text-primary" />
          <input
            value={uidInput}
            onChange={(e) => setUidInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && scan()}
            placeholder="Scan or type Unit UID (e.g. LOT-…-U00001)"
            className="flex-1 min-w-[220px] rounded-lg border border-border/60 bg-background/60 px-3 py-2 font-mono text-sm"
            autoFocus
          />
          <button onClick={scan} className="rounded-lg border border-primary/40 bg-primary/10 px-3 py-2 text-xs font-medium text-primary hover:bg-primary/20">
            Load unit
          </button>
          {activeUid && (
            <button onClick={() => setActiveUid(null)} className="rounded-lg border border-border/60 px-3 py-2 text-xs">
              Clear
            </button>
          )}
        </div>

        {activeUid && unit && (
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            <Ctx label="Unit" mono value={unit.uid} extra={`serial ${unit.serial} · ${unit.status}`} />
            <Ctx label="Product" value={unit.product_name} extra={`SKU ${unit.sku}`} />
            <Ctx label="Lot / PO" mono value={unit.lot_number} extra={po?.number ?? "—"} />
            {po && (
              <>
                <Ctx label="Customer" value={po.customer_name ?? "—"} extra={po.customer_id ?? undefined} />
                <Ctx label="Qty" mono value={`${Number(po.qty_produced).toLocaleString()} / ${Number(po.qty).toLocaleString()} ${po.uom}`} />
                <Ctx label="Order status" value={po.status} />
              </>
            )}
            {product?.description && <div className="md:col-span-3 text-xs text-muted-foreground">{product.description}</div>}
          </div>
        )}
        {activeUid && !unit && <div className="mt-3 text-xs text-destructive">No unit found for UID {activeUid}</div>}
      </div>

      {/* Dynamic recipe form */}
      {activeUid && unit && (
        <div className="glass-panel rounded-2xl p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
              <ClipboardList className="h-3 w-3" /> Recipe · {variables.length} variable(s)
              {isSemi && <span className="ml-2 text-warning">mode: {mode}</span>}
            </div>
            {recipe?.target_cycle_sec && (
              <span className="text-[11px] text-muted-foreground">Target cycle: {recipe.target_cycle_sec}s</span>
            )}
          </div>
          {variables.length === 0 ? (
            <div className="mt-2 rounded-lg border border-dashed border-border/60 p-3 text-xs text-muted-foreground">
              No recipe configured for this product+station.{" "}
              <Link to="/recipes" className="text-primary hover:underline">Configure now</Link>
            </div>
          ) : (
            <div className="mt-3 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {variables.map((v) => (
                <VariableField
                  key={v.key} v={v} value={values[v.key]}
                  disabled={mode === "auto" && v.direction === "input"}
                  onChange={(x) => setValues((s) => ({ ...s, [v.key]: x }))}
                />
              ))}
            </div>
          )}
          {recipe?.instructions && (
            <div className="mt-3 rounded-lg border border-border/40 bg-background/40 p-2 text-xs">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Instructions</div>
              <div className="mt-1 whitespace-pre-wrap">{recipe.instructions}</div>
            </div>
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            <button onClick={startOp} className="inline-flex items-center gap-1.5 rounded-lg border border-info/40 bg-info/10 px-3 py-1.5 text-xs text-info hover:bg-info/20">
              <Play className="h-3.5 w-3.5" /> Start
            </button>
            <button onClick={completeOp} className="inline-flex items-center gap-1.5 rounded-lg border border-success/40 bg-success/10 px-3 py-1.5 text-xs text-success hover:bg-success/20">
              <Check className="h-3.5 w-3.5" /> Complete & log
            </button>
            <WasteButton
              stationId={stationId} stationName={station.name} lineId={line?.id}
              unitUid={activeUid} po={po ?? null}
              onDone={() => setActiveUid(null)}
            />
          </div>
        </div>
      )}

      {/* Station holds */}
      <div className="grid gap-4 lg:grid-cols-2">
        <HoldPanel stationId={stationId} openHolds={openHolds} onOpen={openHold.mutateAsync} onClose={closeHold.mutateAsync} />
        <ReasonsAdmin stationId={stationId} allowed={allowedReasons} all={allReasons} onSave={setStationReasons.mutateAsync} />
      </div>
    </div>
  );
}

function VariableField({
  v, value, onChange, disabled,
}: {
  v: RecipeVariable;
  value: string | number | boolean | undefined;
  onChange: (x: string | number | boolean) => void;
  disabled?: boolean;
}) {
  const outputOnly = v.direction === "output";
  return (
    <label className="block">
      <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-muted-foreground">
        <span>{v.label}{v.required && <span className="text-destructive"> *</span>}</span>
        <span className="font-mono">{v.unit ?? ""}</span>
      </div>
      {v.type === "boolean" ? (
        <button
          type="button"
          disabled={disabled || outputOnly}
          onClick={() => onChange(!(value as boolean))}
          className={`mt-1 h-8 w-full rounded-lg border text-xs ${
            value ? "border-success/40 bg-success/10 text-success" : "border-border/60 bg-background/60"
          } disabled:opacity-50`}
        >
          {value ? "TRUE" : "FALSE"}
        </button>
      ) : v.type === "select" ? (
        <select
          disabled={disabled || outputOnly}
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
          className="mt-1 h-8 w-full rounded-lg border border-border/60 bg-background/60 px-2 text-xs disabled:opacity-50"
        >
          <option value="">—</option>
          {(v.options ?? []).map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      ) : (
        <input
          type={v.type === "number" ? "number" : "text"}
          min={v.min} max={v.max}
          disabled={disabled || outputOnly}
          value={String(value ?? "")}
          onChange={(e) => onChange(v.type === "number" ? Number(e.target.value) : e.target.value)}
          className="mt-1 h-8 w-full rounded-lg border border-border/60 bg-background/60 px-2 font-mono text-xs disabled:opacity-50"
        />
      )}
      <div className="mt-0.5 text-[9px] text-muted-foreground">
        {v.direction}
        {v.type === "number" && (v.min !== undefined || v.max !== undefined) && (
          <> · [{v.min ?? "–"} … {v.max ?? "–"}]</>
        )}
      </div>
    </label>
  );
}

function Ctx({ label, value, extra, mono }: { label: string; value: string; extra?: string; mono?: boolean }) {
  return (
    <div className="rounded-lg border border-border/40 bg-background/40 p-2.5">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`${mono ? "font-mono" : ""} text-sm`}>{value}</div>
      {extra && <div className="mt-0.5 text-[10px] text-muted-foreground">{extra}</div>}
    </div>
  );
}

function WasteButton({
  stationId, stationName, lineId, unitUid, po, onDone,
}: {
  stationId: string; stationName: string; lineId?: string;
  unitUid: string; po: { id: string; lot_number: string } | null;
  onDone: () => void;
}) {
  const { data: allowed = [] } = useStationWasteReasons(stationId);
  const { data: all = [] } = useWasteReasons();
  const options = allowed.length ? allowed : all;
  const [open, setOpen] = useState(false);
  const [reasonId, setReasonId] = useState("");
  const [notes, setNotes] = useState("");
  const [evidence, setEvidence] = useState<string[]>([]);
  const log = useLogWaste();

  async function submit() {
    const r = options.find((x) => x.id === reasonId);
    if (!r) return toast.error("Pick a reason");
    await log.mutateAsync({
      unit_uid: unitUid, station_id: stationId, station_name: stationName, line_id: lineId,
      production_order_id: po?.id ?? null, lot_number: po?.lot_number ?? null,
      reason_code: r.code, reason_label: r.label, reason_category: r.category,
      notes, evidence_urls: evidence,
    });
    toast.error(`Unit ${unitUid} sent to waste`);
    setOpen(false); setReasonId(""); setNotes(""); setEvidence([]);
    onDone();
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className="inline-flex items-center gap-1.5 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-1.5 text-xs text-destructive hover:bg-destructive/20">
        <Trash2 className="h-3.5 w-3.5" /> Send to waste
      </button>
      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-background/70 p-4 backdrop-blur">
          <div className="w-full max-w-md rounded-2xl border border-border/60 bg-card p-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-lg font-semibold">Waste unit {unitUid}</h3>
              <button onClick={() => setOpen(false)}><X className="h-4 w-4" /></button>
            </div>
            <div className="mt-3 space-y-3">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Reason</div>
                <select value={reasonId} onChange={(e) => setReasonId(e.target.value)} className="mt-1 h-9 w-full rounded-lg border border-border/60 bg-background/60 px-2 text-xs">
                  <option value="">— select —</option>
                  {options.map((r) => <option key={r.id} value={r.id}>[{r.category}] {r.label}</option>)}
                </select>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Notes</div>
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className="mt-1 w-full rounded-lg border border-border/60 bg-background/60 p-2 text-xs" />
              </div>
              <EvidenceUploader value={evidence} onChange={setEvidence} prefix={`waste/${stationId}`} label="Evidence photos / files" />
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setOpen(false)} className="rounded-lg border border-border/60 px-3 py-1.5 text-xs">Cancel</button>
              <button onClick={submit} className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-1.5 text-xs text-destructive hover:bg-destructive/20">Confirm waste</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function HoldPanel({
  stationId, openHolds, onOpen, onClose,
}: {
  stationId: string;
  openHolds: import("@/lib/hmi-db").StationHold[];
  onOpen: (v: { station_id: string; hold_type: "qc" | "maintenance" | "other"; reason: string; evidence_urls?: string[] }) => Promise<unknown>;
  onClose: (v: { id: string; resolution_notes?: string; evidence_urls?: string[] }) => Promise<unknown>;
}) {
  const [type, setType] = useState<"qc" | "maintenance" | "other">("qc");
  const [reason, setReason] = useState("");
  const [evidence, setEvidence] = useState<string[]>([]);
  const [closingId, setClosingId] = useState<string | null>(null);
  const [resNotes, setResNotes] = useState("");
  const [resEvidence, setResEvidence] = useState<string[]>([]);

  async function submit() {
    if (!reason.trim()) return toast.error("Enter a reason");
    await onOpen({ station_id: stationId, hold_type: type, reason, evidence_urls: evidence });
    toast.warning(`Station on hold: ${type}`);
    setReason(""); setEvidence([]);
  }

  return (
    <div className="glass-panel rounded-2xl p-4">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
        <Pause className="h-3 w-3" /> Machine hold (QC / maintenance)
      </div>
      <div className="mt-3 grid gap-2 md:grid-cols-[140px_1fr] items-start">
        <select value={type} onChange={(e) => setType(e.target.value as never)} className="h-8 rounded-lg border border-border/60 bg-background/60 px-2 text-xs">
          <option value="qc">QC</option>
          <option value="maintenance">Maintenance</option>
          <option value="other">Other</option>
        </select>
        <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why is the station on hold?" className="h-8 rounded-lg border border-border/60 bg-background/60 px-2 text-xs" />
      </div>
      <div className="mt-2"><EvidenceUploader value={evidence} onChange={setEvidence} prefix={`hold/${stationId}`} label="Attach evidence" /></div>
      <div className="mt-2">
        <button onClick={submit} className="inline-flex items-center gap-1.5 rounded-lg border border-warning/40 bg-warning/10 px-3 py-1.5 text-xs text-warning hover:bg-warning/20">
          <AlertOctagon className="h-3.5 w-3.5" /> Put station on hold
        </button>
      </div>

      <div className="mt-4">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Open holds · {openHolds.length}</div>
        {openHolds.length === 0 ? (
          <div className="mt-1 text-xs text-muted-foreground">None. Station clear.</div>
        ) : (
          <div className="mt-1 space-y-2">
            {openHolds.map((h) => (
              <div key={h.id} className="rounded-lg border border-warning/30 bg-warning/5 p-2">
                <div className="flex items-center justify-between text-xs">
                  <div>
                    <span className="rounded border border-warning/40 bg-warning/10 px-1.5 py-0.5 font-mono text-[10px] uppercase text-warning">{h.hold_type}</span>
                    <span className="ml-2">{h.reason}</span>
                  </div>
                  <span className="text-[10px] text-muted-foreground">{new Date(h.opened_at).toLocaleString()}</span>
                </div>
                {closingId === h.id ? (
                  <div className="mt-2 space-y-2">
                    <textarea value={resNotes} onChange={(e) => setResNotes(e.target.value)} placeholder="Resolution notes" rows={2} className="w-full rounded-lg border border-border/60 bg-background/60 p-2 text-xs" />
                    <EvidenceUploader value={resEvidence} onChange={setResEvidence} prefix={`hold/${stationId}/resolution`} label="Resolution evidence" />
                    <div className="flex justify-end gap-2">
                      <button onClick={() => setClosingId(null)} className="rounded-lg border border-border/60 px-2 py-1 text-[11px]">Cancel</button>
                      <button
                        onClick={async () => {
                          await onClose({ id: h.id, resolution_notes: resNotes, evidence_urls: resEvidence });
                          toast.success("Hold cleared");
                          setClosingId(null); setResNotes(""); setResEvidence([]);
                        }}
                        className="rounded-lg border border-success/40 bg-success/10 px-2 py-1 text-[11px] text-success"
                      >
                        <Check className="mr-1 inline h-3 w-3" /> Clear hold
                      </button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => setClosingId(h.id)} className="mt-1.5 text-[11px] text-primary hover:underline">Resolve →</button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ReasonsAdmin({
  stationId, allowed, all, onSave,
}: {
  stationId: string;
  allowed: import("@/lib/hmi-db").WasteReason[];
  all: import("@/lib/hmi-db").WasteReason[];
  onSave: (v: { station_id: string; reason_ids: string[] }) => Promise<unknown>;
}) {
  const [ids, setIds] = useState<string[]>([]);
  useEffect(() => setIds(allowed.map((r) => r.id)), [allowed]);
  const toggle = (id: string) => setIds((s) => s.includes(id) ? s.filter((x) => x !== id) : [...s, id]);
  return (
    <div className="glass-panel rounded-2xl p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
          <ShieldAlert className="h-3 w-3" /> Waste reasons allowed here
        </div>
        <Link to="/waste-reasons" className="text-[11px] text-primary hover:underline">Global catalog →</Link>
      </div>
      <p className="mt-1 text-[11px] text-muted-foreground">Leave empty to allow all global reasons.</p>
      <div className="mt-2 max-h-56 space-y-1 overflow-auto pr-1">
        {all.map((r) => (
          <label key={r.id} className="flex items-center gap-2 rounded border border-border/40 bg-background/40 px-2 py-1 text-xs">
            <input type="checkbox" checked={ids.includes(r.id)} onChange={() => toggle(r.id)} />
            <span className="font-mono text-[10px] text-muted-foreground">{r.code}</span>
            <span className="flex-1">{r.label}</span>
            <span className="rounded border border-border/60 px-1 text-[9px] uppercase tracking-wider">{r.category}</span>
          </label>
        ))}
      </div>
      <button onClick={() => onSave({ station_id: stationId, reason_ids: ids }).then(() => toast.success("Saved"))} className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs text-primary">
        <Check className="h-3.5 w-3.5" /> Save
      </button>
    </div>
  );
}
