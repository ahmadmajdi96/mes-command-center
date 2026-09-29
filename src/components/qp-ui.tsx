import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";
import { useRows } from "@/lib/execution-db";

export const inp = "h-9 w-full rounded-lg border border-border/60 bg-card/60 px-2 text-xs focus:border-primary/50 focus:outline-none";
export const btn = "flex h-9 items-center gap-1 rounded-lg bg-primary px-3 text-xs font-medium text-primary-foreground disabled:opacity-50";
export const ghost = "flex h-8 items-center gap-1 rounded-lg border border-border/60 px-2 text-[11px] hover:text-foreground disabled:opacity-40";
export const lbl = "space-y-1 text-[11px] text-muted-foreground";
export const th = "py-2 text-left";

export function PageHead({ back, backLabel, icon, title, desc, children }: { back: string; backLabel: string; icon: ReactNode; title: string; desc: string; children?: ReactNode }) {
  return (
    <div className="space-y-2">
      <Link to={back as never} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"><ArrowLeft className="h-3.5 w-3.5" /> {backLabel}</Link>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 font-display text-2xl font-semibold">{icon}{title}</h1>
          <p className="text-sm text-muted-foreground">{desc}</p>
        </div>
        {children}
      </div>
    </div>
  );
}

/** Step names known from routings and orders, for suggestions. */
export function StepNames() {
  const { data: r = [] } = useRows<any>("routing_operations", { order: "sequence", asc: true });
  const { data: o = [] } = useRows<any>("order_operations", { order: "sequence", asc: true });
  const names = Array.from(new Set([...r, ...o].map((x) => x.name))).sort();
  return <datalist id="step-names">{names.map((n) => <option key={n} value={n} />)}</datalist>;
}

export function ProductSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { data: products = [] } = useRows<any>("products", { order: "name", asc: true });
  return (
    <select className={inp} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">Any product</option>
      {products.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
    </select>
  );
}

export const Field = ({ l, v }: { l: string; v: ReactNode }) => (
  <div className="rounded-lg border border-border/40 bg-background/30 p-2"><div className="text-[10px] uppercase text-muted-foreground">{l}</div><div className="mt-0.5 text-sm">{v ?? "—"}</div></div>
);

export const fmt = (s?: string | null) => (s ? new Date(s).toLocaleString() : "—");
