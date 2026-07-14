import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, Save, ClipboardList, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { useProducts } from "@/lib/products-db";
import { useMes } from "@/lib/mes-store";
import {
  useRecipesForProduct, useUpsertRecipe, type RecipeVariable,
} from "@/lib/hmi-db";

export const Route = createFileRoute("/recipes")({
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
  const store = useMes();
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
  async function save() {
    if (!productId || !stationId) return;
    await upsert.mutateAsync({
      product_id: productId,
      station_id: stationId,
      variables: vars,
      target_cycle_sec: cycle === "" ? null : Number(cycle),
      instructions: instructions || null,
    });
    toast.success("Recipe saved");
  }

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
          <button onClick={addVar} className="inline-flex items-center gap-1 rounded-lg border border-primary/40 bg-primary/10 px-2 py-1 text-xs text-primary hover:bg-primary/20">
            <Plus className="h-3 w-3" /> Add variable
          </button>
        </div>

        <div className="mt-3 space-y-2">
          {vars.map((v, i) => (
            <div key={i} className="grid gap-2 rounded-lg border border-border/40 bg-background/40 p-2 md:grid-cols-[130px_1fr_120px_120px_90px_60px_60px_auto]">
              <input value={v.key} onChange={(e) => update(i, { key: e.target.value })} placeholder="key" className="h-8 rounded border border-border/60 bg-background/60 px-2 font-mono text-xs" />
              <input value={v.label} onChange={(e) => update(i, { label: e.target.value })} placeholder="Label" className="h-8 rounded border border-border/60 bg-background/60 px-2 text-xs" />
              <select value={v.direction} onChange={(e) => update(i, { direction: e.target.value as never })} className="h-8 rounded border border-border/60 bg-background/60 px-1 text-xs">
                <option value="input">input</option>
                <option value="output">output</option>
                <option value="reading">reading</option>
              </select>
              <select value={v.type} onChange={(e) => update(i, { type: e.target.value as never })} className="h-8 rounded border border-border/60 bg-background/60 px-1 text-xs">
                <option value="number">number</option>
                <option value="text">text</option>
                <option value="boolean">boolean</option>
                <option value="select">select</option>
              </select>
              <input value={v.unit ?? ""} onChange={(e) => update(i, { unit: e.target.value })} placeholder="unit" className="h-8 rounded border border-border/60 bg-background/60 px-2 font-mono text-xs" />
              <input type="number" value={v.min ?? ""} onChange={(e) => update(i, { min: e.target.value === "" ? undefined : Number(e.target.value) })} placeholder="min" className="h-8 rounded border border-border/60 bg-background/60 px-2 font-mono text-xs" />
              <input type="number" value={v.max ?? ""} onChange={(e) => update(i, { max: e.target.value === "" ? undefined : Number(e.target.value) })} placeholder="max" className="h-8 rounded border border-border/60 bg-background/60 px-2 font-mono text-xs" />
              <div className="flex items-center gap-1">
                <label className="inline-flex items-center gap-1 text-[10px]">
                  <input type="checkbox" checked={!!v.required} onChange={(e) => update(i, { required: e.target.checked })} /> req
                </label>
                <button onClick={() => remove(i)} className="text-destructive" title="Remove"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
              {v.type === "select" && (
                <input
                  className="md:col-span-8 h-8 rounded border border-border/60 bg-background/60 px-2 text-xs"
                  value={(v.options ?? []).join(",")}
                  onChange={(e) => update(i, { options: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
                  placeholder="Options (comma-separated)"
                />
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
            <input type="number" value={cycle} onChange={(e) => setCycle(e.target.value === "" ? "" : Number(e.target.value))} className="mt-1 h-9 w-full rounded-lg border border-border/60 bg-background/60 px-2 font-mono text-xs" />
          </label>
          <label className="block">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Operator instructions</div>
            <textarea value={instructions} onChange={(e) => setInstructions(e.target.value)} rows={2} className="mt-1 w-full rounded-lg border border-border/60 bg-background/60 p-2 text-xs" />
          </label>
        </div>

        <div className="mt-3">
          <button onClick={save} disabled={!productId || !stationId} className="inline-flex items-center gap-1.5 rounded-lg border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs text-primary hover:bg-primary/20 disabled:opacity-50">
            <Save className="h-3.5 w-3.5" /> Save recipe
          </button>
        </div>
      </div>
    </div>
  );
}
