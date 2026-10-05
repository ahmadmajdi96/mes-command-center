import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, Save, ClipboardList, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { useProducts } from "@/lib/products-db";
import { useMyOrg } from "@/lib/wip-db";
import { useRows } from "@/lib/execution-db";
import { DecimalInput } from "@/components/decimal-input";
import {
  useRecipesForProduct, useUpsertRecipe, type RecipeVariable,
} from "@/lib/hmi-db";

export const Route = createFileRoute("/_authenticated/recipes")({
  head: () => ({
    meta: [
      { title: "Product × Station Recipes · Cortanex MES" },
      { name: "description", content: "Define input/output variables per product & station. Drives dynamic HMI and Operator forms." },
    ],
  }),
  component: RecipesPage,
});

function RecipesPage() {
  const { data: products = [] } = useProducts();
  // Stations come from the database so a recipe always points at a real station.
  const { data: dbStations = [] } = useRows<any>("stations", { order: "sequence", asc: true });
  const store = { stations: dbStations as { id: string; name: string; type: string }[] };
  const [productId, setProductId] = useState<string>("");
  const [stationId, setStationId] = useState<string>("");

  useEffect(() => {
    if (!productId && products[0]) setProductId(products[0].id);
  }, [products, productId]);
  useEffect(() => {
    if (!stationId && store.stations[0]) setStationId(store.stations[0].id);
  }, [store.stations, stationId]);

  const { data: recipes = [] } = useRecipesForProduct(productId);
  const current = useMemo(() => recipes.find((r) => r.station_id === stationId), [recipes, stationId]);
  const upsert = useUpsertRecipe();
  const { data: org } = useMyOrg();
  const [errs, setErrs] = useState<Record<string, string>>({});

  const [vars, setVars] = useState<RecipeVariable[]>([]);
  const [cycle, setCycle] = useState<number | "">("");
  const [instructions, setInstructions] = useState("");

  useEffect(() => {
    setVars(((current?.variables as unknown as RecipeVariable[]) ?? []));
    setCycle(current?.target_cycle_sec ?? "");
    setInstructions(current?.instructions ?? "");
  }, [current]);

  function addVar() {
    setVars((s) => [...s, { key: `var_${s.length + 1}`, label: "New variable", direction: "reading", type: "number", required: false }]);
  }
  function update(i: number, patch: Partial<RecipeVariable>) {
    setVars((s) => s.map((v, j) => (j === i ? { ...v, ...patch } : v)));
  }
  function remove(i: number) {
    setVars((s) => s.filter((_, j) => j !== i));
  }
  function validate(list: RecipeVariable[]) {
    const e: Record<string, string> = {};
    const seen = new Set<string>();
    list.forEach((v, i) => {
      const k = (v.key ?? "").trim();
      if (!k) e[`${i}.key`] = "Key is required";
      else if (seen.has(k)) e[`${i}.key`] = "Key used twice";
      seen.add(k);
      if (!(v.label ?? "").trim()) e[`${i}.label`] = "Label is required";
      if (v.min != null && v.min < 0) e[`${i}.min`] = "Min cannot be negative";
      if (v.max != null && v.max < 0) e[`${i}.max`] = "Max cannot be negative";
      if (v.min != null && v.max != null && v.min > v.max) e[`${i}.max`] = "Max must be ≥ min";
      if (v.type === "select" && !(v.options ?? []).length) e[`${i}.options`] = "Add at least one option";
    });
    if (cycle !== "" && Number(cycle) < 0) e.cycle = "Cycle cannot be negative";
    return e;
  }
  useEffect(() => { if (Object.keys(errs).length) setErrs(validate(vars)); }, [vars, cycle]);

  async function save() {
    if (!productId || !stationId) { toast.error("Pick a product and a station first"); return; }
    const e = validate(vars);
    setErrs(e);
    if (Object.keys(e).length) { toast.error(`Fix ${Object.keys(e).length} field${Object.keys(e).length === 1 ? "" : "s"} before saving`); return; }
    try {
      const clean = vars.map((v) => ({ ...v, key: v.key.trim(), label: v.label.trim() }));
      await upsert.mutateAsync({
        product_id: productId,
        station_id: stationId,
        variables: clean,
        target_cycle_sec: cycle === "" ? null : Number(cycle),
        instructions: instructions || null,
        ...(org ? { organization_id: org } : {}),
      } as never);
      toast.success("Recipe saved");
    } catch (err) {
      toast.error(`Not saved — ${(err as Error)?.message ?? "please try again"}`);
    }
  }
  const fe = (k: string) => errs[k] ? <div className="mt-0.5 text-[10px] text-destructive">{errs[k]}</div> : null;
  const bad = (k: string) => (errs[k] ? " border-destructive/60" : "");
  const noMinus = (e: React.KeyboardEvent) => { if (e.key === "-") e.preventDefault(); };

  return (
    <div className="space-y-5">
      <div>
        <Link to="/products" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3 w-3" /> Products
        </Link>
        <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight">Product × Station Recipes</h1>
        <p className="text-xs text-muted-foreground">Define the input/output variables shown in the HMI and Operator apps for each product on each station.</p>
      </div>

      <div className="glass-panel rounded-2xl p-4">
        <div className="grid gap-2 md:grid-cols-2">
          <label className="block">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Product</div>
            <select value={productId} onChange={(e) => setProductId(e.target.value)} className="mt-1 h-9 w-full rounded-lg border border-border/60 bg-background/60 px-2 text-xs">
              {products.map((p) => <option key={p.id} value={p.id}>{p.sku} · {p.name}</option>)}
            </select>
          </label>
          <label className="block">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Station</div>
            <select value={stationId} onChange={(e) => setStationId(e.target.value)} className="mt-1 h-9 w-full rounded-lg border border-border/60 bg-background/60 px-2 text-xs">
              {store.stations.map((s) => <option key={s.id} value={s.id}>{s.id} · {s.name} ({(s.type as string) === "semi_auto" ? "semi-auto" : s.type})</option>)}
            </select>
          </label>
        </div>
      </div>

      <div className="glass-panel rounded-2xl p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
            <ClipboardList className="h-3 w-3" /> Variables · {vars.length}
          </div>
          <button type="button" onClick={addVar} className="inline-flex items-center gap-1 rounded-lg border border-primary/40 bg-primary/10 px-2 py-1 text-xs text-primary hover:bg-primary/20">
            <Plus className="h-3 w-3" /> Add variable
          </button>
        </div>

        <div className="mt-3 space-y-2">
          {vars.map((v, i) => (
            <div key={i} className="grid items-start gap-2 rounded-lg border border-border/40 bg-background/40 p-2 md:grid-cols-[130px_1fr_110px_110px_80px_80px_80px_auto]">
              <div><input aria-label="Key" value={v.key} onChange={(e) => update(i, { key: e.target.value })} placeholder="key" className={"h-8 w-full rounded border border-border/60 bg-background/60 px-2 font-mono text-xs" + bad(`${i}.key`)} />{fe(`${i}.key`)}</div>
              <div><input aria-label="Label" value={v.label} onChange={(e) => update(i, { label: e.target.value })} placeholder="Label" className={"h-8 w-full rounded border border-border/60 bg-background/60 px-2 text-xs" + bad(`${i}.label`)} />{fe(`${i}.label`)}</div>
              <select aria-label="Direction" value={v.direction} onChange={(e) => update(i, { direction: e.target.value as never })} className="h-8 rounded border border-border/60 bg-background/60 px-1 text-xs">
                <option value="input">input</option>
                <option value="output">output</option>
                <option value="reading">reading</option>
              </select>
              <select aria-label="Type" value={v.type} onChange={(e) => update(i, { type: e.target.value as never })} className="h-8 rounded border border-border/60 bg-background/60 px-1 text-xs">
                <option value="number">number</option>
                <option value="text">text</option>
                <option value="boolean">boolean</option>
                <option value="select">select</option>
              </select>
              <input aria-label="Unit" value={v.unit ?? ""} onChange={(e) => update(i, { unit: e.target.value })} placeholder="unit" className="h-8 rounded border border-border/60 bg-background/60 px-2 font-mono text-xs" />
              <div><DecimalInput aria-label="Min" value={v.min} onValue={(n) => update(i, { min: n })} placeholder="min" className={"h-8 w-full rounded border border-border/60 bg-background/60 px-2 font-mono text-xs" + bad(`${i}.min`)} />{fe(`${i}.min`)}</div>
              <div><DecimalInput aria-label="Max" value={v.max} onValue={(n) => update(i, { max: n })} placeholder="max" className={"h-8 w-full rounded border border-border/60 bg-background/60 px-2 font-mono text-xs" + bad(`${i}.max`)} />{fe(`${i}.max`)}</div>
              <div className="flex h-8 items-center gap-4">
                <label className="inline-flex cursor-pointer items-center gap-1.5 rounded px-1.5 py-1 text-[11px] hover:bg-card/60">
                  <input type="checkbox" className="h-3.5 w-3.5" checked={!!v.required} onChange={(e) => update(i, { required: e.target.checked })} /> Required
                </label>
                <span className="h-5 w-px bg-border/60" aria-hidden />
                <button type="button" onClick={() => { if (window.confirm(`Remove variable "${v.label || v.key}"?`)) remove(i); }} aria-label={`Remove ${v.label || v.key}`} className="grid h-8 w-8 place-items-center rounded border border-destructive/30 text-destructive hover:bg-destructive/10" title="Remove variable"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
              {v.type === "select" && (<div className="md:col-span-8">
                <input
                  className={"w-full h-8 rounded border border-border/60 bg-background/60 px-2 text-xs" + bad(`${i}.options`)}
                  value={(v.options ?? []).join(",")}
                  onChange={(e) => update(i, { options: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
                  placeholder="Options (comma-separated)"
                />{fe(`${i}.options`)}</div>
              )}
            </div>
          ))}
          {vars.length === 0 && (
            <div className="rounded-lg border border-dashed border-border/60 p-4 text-center text-xs text-muted-foreground">
              No variables yet. Click <b>Add variable</b> to build the form for this product on this station.
            </div>
          )}
        </div>

        <div className="mt-4 grid gap-2 md:grid-cols-[160px_1fr]">
          <label className="block">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Target cycle (sec)</div>
            <input type="number" min={0} onKeyDown={noMinus} value={cycle} onChange={(e) => setCycle(e.target.value === "" ? "" : Number(e.target.value))} className={"mt-1 h-9 w-full rounded-lg border border-border/60 bg-background/60 px-2 font-mono text-xs" + bad("cycle")} />{fe("cycle")}
          </label>
          <label className="block">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Operator instructions</div>
            <textarea value={instructions} onChange={(e) => setInstructions(e.target.value)} rows={2} className="mt-1 w-full rounded-lg border border-border/60 bg-background/60 p-2 text-xs" />
          </label>
        </div>

        <div className="mt-3">
          <button type="button" onClick={save} disabled={upsert.isPending} className="inline-flex items-center gap-1.5 rounded-lg border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs text-primary hover:bg-primary/20 disabled:opacity-50">
            <Save className="h-3.5 w-3.5" /> {upsert.isPending ? "Saving…" : "Save recipe"}
          </button>
        </div>
      </div>
    </div>
  );
}
