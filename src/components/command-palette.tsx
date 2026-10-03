import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { supabase } from "@/integrations/supabase/client";
import { overview, planning, execution, monitoring, workforce, platform } from "@/components/app-sidebar";
import { Search as SearchIcon, Plus, ArrowRight } from "lucide-react";

type Hit = { id: string; group: string; title: string; subtitle?: string; path: string };

const PAGES = [
  ...overview.map((p) => ({ ...p, group: "Overview" })),
  ...planning.map((p) => ({ ...p, group: "Planning" })),
  ...execution.map((p) => ({ ...p, group: "Execution" })),
  ...monitoring.map((p) => ({ ...p, group: "Monitoring" })),
  ...workforce.map((p) => ({ ...p, group: "Workforce" })),
  ...platform.map((p) => ({ ...p, group: "Platform" })),
  { title: "My profile", url: "/profile", icon: ArrowRight, group: "Account" },
];

const QUICK = [
  { label: "New production order", path: "/production-orders" },
  { label: "Log downtime event", path: "/downtime" },
  { label: "Request an approval", path: "/approvals" },
  { label: "Assign a role", path: "/access" },
  { label: "Create a role", path: "/roles" },
];

type Src = {
  group: string;
  table: string;
  cols: string;
  search: string[];
  title: (r: any) => string;
  sub?: (r: any) => string;
  path: (r: any) => string;
};

const SOURCES: Src[] = [
  { group: "Production orders", table: "production_orders", cols: "id,number,product_name,status,lot_number", search: ["id", "number", "product_name", "lot_number"], title: (r) => `${r.number ?? r.id} · ${r.product_name ?? ""}`, sub: (r) => r.status, path: (r) => `/production-orders/${r.id}` },
  { group: "Products", table: "products", cols: "id,sku,name,type", search: ["id", "sku", "name"], title: (r) => `${r.sku} · ${r.name}`, sub: (r) => r.type, path: (r) => `/products/${r.id}` },
  { group: "Lines", table: "lines", cols: "id,name,plant,status", search: ["id", "name"], title: (r) => `${r.id} · ${r.name}`, sub: (r) => `${r.plant ?? ""} · ${r.status}`, path: (r) => `/lines/${r.id}` },
  { group: "Stations", table: "stations", cols: "id,name,line_id,status", search: ["id", "name"], title: (r) => `${r.id} · ${r.name}`, sub: (r) => `${r.line_id} · ${r.status}`, path: (r) => `/stations/${r.id}` },
  { group: "Machines", table: "machines", cols: "id,name,protocol,status", search: ["id", "name"], title: (r) => `${r.id} · ${r.name}`, sub: (r) => `${r.protocol} · ${r.status}`, path: (r) => `/machines/${r.id}` },
  { group: "Material lots", table: "material_lots", cols: "id,lot_number,name,sku,status", search: ["id", "lot_number", "name", "sku"], title: (r) => `${r.lot_number} · ${r.name ?? r.sku}`, sub: (r) => r.status, path: (r) => `/material-lots/${r.id}` },
  { group: "Nonconformances", table: "nonconformances", cols: "id,description,status,production_order_id", search: ["id", "description"], title: (r) => `${r.id} · ${r.description ?? ""}`, sub: (r) => r.status, path: (r) => `/nonconformance/${r.id}` },
  { group: "Downtime", table: "downtime_events", cols: "id,line_name,reason_code,status", search: ["id", "reason_code", "line_name"], title: (r) => `${r.id} · ${r.reason_code}`, sub: (r) => `${r.line_name} · ${r.status}`, path: (r) => `/record/downtime/${r.id}` },
  { group: "Tools", table: "tools", cols: "id,code,name,status", search: ["id", "code", "name"], title: (r) => `${r.code} · ${r.name}`, sub: (r) => r.status, path: (r) => `/record/tool/${r.id}` },
  { group: "Approvals", table: "approval_requests", cols: "id,kind,summary,status", search: ["summary", "ref_id"], title: (r) => r.summary ?? r.id, sub: (r) => `${r.kind} · ${r.status}`, path: (r) => `/record/approval/${r.id}` },
  { group: "People", table: "mes_users", cols: "id,name,email,role", search: ["name", "email", "id"], title: (r) => r.name, sub: (r) => `${r.role ?? ""} ${r.email ?? ""}`, path: (r) => `/users/${r.id}` },
  { group: "Skills", table: "skills", cols: "id,code,name", search: ["code", "name"], title: (r) => `${r.code} · ${r.name}`, path: (r) => `/skills/${r.id}` },
];

export function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const q = query.trim().replace(/[%,()]/g, " ").trim();
    if (!open || q.length < 2) {
      setHits([]);
      return;
    }
    setLoading(true);
    const t = setTimeout(async () => {
      const res = await Promise.all(
        SOURCES.map(async (s) => {
          const { data } = await (supabase.from(s.table as any) as any)
            .select(s.cols)
            .or(s.search.map((c) => `${c}.ilike.%${q}%`).join(","))
            .limit(5);
          return (data ?? []).map((r: any) => ({
            id: `${s.table}-${r.id}`,
            group: s.group,
            title: s.title(r),
            subtitle: s.sub?.(r),
            path: s.path(r),
          }));
        }),
      );
      setHits(res.flat());
      setLoading(false);
    }, 200);
    return () => clearTimeout(t);
  }, [query, open]);

  const grouped = useMemo(() => {
    const m: Record<string, Hit[]> = {};
    for (const h of hits) (m[h.group] ||= []).push(h);
    return m;
  }, [hits]);

  const ql = query.trim().toLowerCase();
  const pages = ql ? PAGES.filter((p) => `${p.title} ${p.group}`.toLowerCase().includes(ql)).slice(0, 8) : PAGES.slice(0, 10);

  const go = (path: string) => {
    onOpenChange(false);
    setQuery("");
    navigate({ to: path as any });
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput
        placeholder="Search orders, lots, lines, stations, machines, people, pages…"
        value={query}
        onValueChange={setQuery}
      />
      <CommandList className="max-h-[520px]">
        {!ql && (
          <>
            <CommandGroup heading="Quick actions">
              {QUICK.map((a) => (
                <CommandItem key={a.label} value={`quick ${a.label}`} onSelect={() => go(a.path)}>
                  <Plus className="mr-2 h-4 w-4 text-primary" />
                  {a.label}
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
          </>
        )}
        {pages.length > 0 && (
          <CommandGroup heading="Pages">
            {pages.map((p) => (
              <CommandItem key={p.url + p.title} value={`page ${p.title} ${query}`} onSelect={() => go(p.url)}>
                <p.icon className="mr-2 h-4 w-4 text-muted-foreground" />
                <span>{p.title}</span>
                <span className="ml-auto text-[10px] uppercase tracking-wider text-muted-foreground">{p.group}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        {ql.length >= 2 && loading && (
          <div className="flex items-center gap-2 px-4 py-4 text-sm text-muted-foreground">
            <SearchIcon className="h-4 w-4 animate-pulse" /> Searching records…
          </div>
        )}
        {ql.length >= 2 && !loading && hits.length === 0 && pages.length === 0 && (
          <CommandEmpty>No matches for “{query}”</CommandEmpty>
        )}
        {Object.entries(grouped).map(([g, items]) => (
          <CommandGroup key={g} heading={g}>
            {items.map((h) => (
              <CommandItem key={h.id} value={`${h.id} ${h.title} ${query}`} onSelect={() => go(h.path)}>
                <div className="min-w-0">
                  <div className="truncate text-sm">{h.title}</div>
                  {h.subtitle && <div className="truncate text-[11px] text-muted-foreground">{h.subtitle}</div>}
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        ))}
      </CommandList>
      <div className="flex items-center justify-between border-t border-border/60 px-3 py-2 text-[10px] text-muted-foreground">
        <span>↑↓ to move · Enter to open · Esc to close</span>
        <span>Ctrl / ⌘ + K</span>
      </div>
    </CommandDialog>
  );
}
