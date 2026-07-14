import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Trash2, Plus, ShieldAlert, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import {
  useWasteReasons,
  useUpsertWasteReason,
  useDeleteWasteReason,
} from "@/lib/hmi-db";

export const Route = createFileRoute("/waste-reasons")({
  head: () => ({
    meta: [
      { title: "Waste Reasons · Cortanex MES" },
      { name: "description", content: "Manage the global catalog of scrap/waste reason codes used by HMI and operator apps." },
    ],
  }),
  component: WasteReasonsPage,
});

const CATEGORIES = ["quality", "process", "material", "equipment", "safety", "other"];

function WasteReasonsPage() {
  const { data: reasons = [] } = useWasteReasons();
  const upsert = useUpsertWasteReason();
  const del = useDeleteWasteReason();

  const [code, setCode] = useState("");
  const [label, setLabel] = useState("");
  const [category, setCategory] = useState("quality");

  async function add() {
    if (!code.trim() || !label.trim()) return toast.error("Code and label required");
    await upsert.mutateAsync({
      code: code.trim().toUpperCase().replace(/\s+/g, "_"),
      label: label.trim(),
      category,
    });
    setCode(""); setLabel("");
    toast.success("Reason saved");
  }

  return (
    <div className="space-y-5">
      <div>
        <Link to="/settings" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3 w-3" /> Settings
        </Link>
        <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight">Waste / Scrap Reasons</h1>
        <p className="text-xs text-muted-foreground">Global catalog. Per-station subsets are configured from the HMI setup page.</p>
      </div>

      <div className="glass-panel rounded-2xl p-4">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Add new reason</div>
        <div className="mt-2 grid gap-2 md:grid-cols-[160px_1fr_180px_auto]">
          <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="CODE_NAME" className="rounded-lg border border-border/60 bg-background/60 px-3 py-1.5 font-mono text-xs" />
          <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Human-readable label" className="rounded-lg border border-border/60 bg-background/60 px-3 py-1.5 text-xs" />
          <select value={category} onChange={(e) => setCategory(e.target.value)} className="rounded-lg border border-border/60 bg-background/60 px-3 py-1.5 text-xs">
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <button onClick={add} className="inline-flex items-center gap-1.5 rounded-lg border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs text-primary hover:bg-primary/20">
            <Plus className="h-3.5 w-3.5" /> Add
          </button>
        </div>
      </div>

      <div className="glass-panel rounded-2xl p-4">
        <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
          <ShieldAlert className="h-3 w-3" /> Catalog · {reasons.length}
        </div>
        <table className="mt-2 w-full text-xs">
          <thead className="text-[10px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-2 py-1 text-left">Code</th>
              <th className="px-2 py-1 text-left">Label</th>
              <th className="px-2 py-1 text-left">Category</th>
              <th className="px-2 py-1"></th>
            </tr>
          </thead>
          <tbody>
            {reasons.map((r) => (
              <tr key={r.id} className="border-t border-border/40">
                <td className="px-2 py-1.5 font-mono">{r.code}</td>
                <td className="px-2 py-1.5">{r.label}</td>
                <td className="px-2 py-1.5"><span className="rounded border border-border/60 bg-background/60 px-1.5 py-0.5 text-[10px] uppercase tracking-wider">{r.category}</span></td>
                <td className="px-2 py-1.5 text-right">
                  <button onClick={() => del.mutate(r.id)} className="text-destructive hover:text-destructive/80" title="Delete">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
