import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ShieldCheck, Plus, Copy, Trash2, Save, Lock, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAccess, useCanAny } from "@/lib/access";
import { exportRows } from "@/components/list-controls";

export const Route = createFileRoute("/_authenticated/roles")({
  head: () => ({
    meta: [
      { title: "Roles & Permissions · Cortanex MES" },
      { name: "description", content: "Create custom roles and choose exactly which permissions each one carries." },
      { property: "og:title", content: "Roles & Permissions · Cortanex MES" },
      { property: "og:description", content: "Flexible, fully editable role management for the Cortanex MES." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RolesPage,
});

type Role = { key: string; label: string; description: string | null; is_system: boolean; color: string | null };
type Perm = { key: string; description: string | null; category: string | null };

const db = (t: string) => supabase.from(t as any) as any;
const slug = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 40);

function RolesPage() {
  const canAdmin = useCanAny(["users.admin", "platform.admin"]);
  const { permissions: mine } = useAccess();
  const isPlatform = mine.includes("platform.admin");
  const qc = useQueryClient();

  const q = useQuery({
    queryKey: ["roles-admin"],
    enabled: canAdmin,
    queryFn: async () => {
      const [r, p, rp, g] = await Promise.all([
        db("roles").select("key,label,description,is_system,color").order("label"),
        db("permissions").select("key,description,category").order("key"),
        db("role_permissions").select("role_key,permission_key"),
        db("user_role_grants").select("role_key,effective_to"),
      ]);
      const map = new Map<string, Set<string>>();
      (rp.data ?? []).forEach((x: any) => (map.get(x.role_key) ?? map.set(x.role_key, new Set()).get(x.role_key)!).add(x.permission_key));
      const people = new Map<string, number>();
      (g.data ?? []).filter((x: any) => !x.effective_to || new Date(x.effective_to) > new Date()).forEach((x: any) => people.set(x.role_key, (people.get(x.role_key) ?? 0) + 1));
      return { roles: (r.data ?? []) as Role[], perms: (p.data ?? []) as Perm[], map, people };
    },
  });

  const [selKey, setSelKey] = useState<string>("");
  const [label, setLabel] = useState("");
  const [desc, setDesc] = useState("");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState("");
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState<"editor" | "matrix">("editor");

  const roles = q.data?.roles ?? [];
  const sel = roles.find((r) => r.key === selKey);
  useEffect(() => {
    if (!selKey && roles.length) setSelKey(roles[0].key);
  }, [roles, selKey]);
  useEffect(() => {
    if (!sel) return;
    setLabel(sel.label);
    setDesc(sel.description ?? "");
    setPicked(new Set(q.data?.map.get(sel.key) ?? []));
  }, [sel?.key, q.data]);

  const groups = useMemo(() => {
    const m: Record<string, Perm[]> = {};
    for (const p of q.data?.perms ?? []) {
      if (filter && !`${p.key} ${p.description ?? ""}`.toLowerCase().includes(filter.toLowerCase())) continue;
      (m[p.category ?? "Other"] ||= []).push(p);
    }
    return m;
  }, [q.data, filter]);

  const original = new Set(q.data?.map.get(selKey) ?? []);
  const dirty =
    !!sel && (label !== sel.label || desc !== (sel.description ?? "") || picked.size !== original.size || [...picked].some((k) => !original.has(k)));

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["roles-admin"] });
    qc.invalidateQueries({ queryKey: ["scope-options"] });
    qc.invalidateQueries({ queryKey: ["my-access"] });
  };

  const create = async (copyFrom?: Role) => {
    const name = prompt(copyFrom ? `Name for the copy of “${copyFrom.label}”` : "New role name", copyFrom ? `${copyFrom.label} (copy)` : "");
    if (!name?.trim()) return;
    let key = slug(name);
    if (!key) return toast.error("Use letters or numbers in the name");
    if (roles.some((r) => r.key === key)) key = `${key}_${Date.now().toString(36).slice(-4)}`;
    const { error } = await db("roles").insert({ key, label: name.trim(), description: copyFrom?.description ?? null, is_system: false });
    if (error) return toast.error(error.message);
    const perms = [...(copyFrom ? q.data?.map.get(copyFrom.key) ?? [] : [])].filter((p) => isPlatform || p !== "platform.admin");
    if (perms.length) {
      const r2 = await db("role_permissions").insert(perms.map((p) => ({ role_key: key, permission_key: p })));
      if (r2.error) toast.error(r2.error.message);
    }
    toast.success(`Role “${name.trim()}” created`);
    setSelKey(key);
    refresh();
  };

  const save = async () => {
    if (!sel) return;
    setBusy(true);
    try {
      if (label !== sel.label || desc !== (sel.description ?? "")) {
        if (!label.trim()) throw new Error("The role needs a name");
        const { error } = await db("roles").update({ label: label.trim(), description: desc.trim() || null }).eq("key", sel.key);
        if (error) throw error;
      }
      const add = [...picked].filter((k) => !original.has(k));
      const del = [...original].filter((k) => !picked.has(k));
      if (add.length) {
        const { error } = await db("role_permissions").insert(add.map((p) => ({ role_key: sel.key, permission_key: p })));
        if (error) throw error;
      }
      if (del.length) {
        const { error } = await db("role_permissions").delete().eq("role_key", sel.key).in("permission_key", del);
        if (error) throw error;
      }
      toast.success("Role saved — it applies to everyone holding it right away");
      refresh();
    } catch (e: any) {
      toast.error(e?.message ?? "Could not save the role");
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!sel || sel.is_system) return;
    if (!confirm(`Delete the role “${sel.label}”? This cannot be undone.`)) return;
    const { error } = await db("roles").delete().eq("key", sel.key);
    if (error) return toast.error(error.message);
    toast.success("Role deleted");
    setSelKey("");
    refresh();
  };

  const toggle = (k: string) => {
    const s = new Set(picked);
    s.has(k) ? s.delete(k) : s.add(k);
    setPicked(s);
  };
  const locked = (k: string) => k === "platform.admin" && !isPlatform;

  if (!canAdmin) {
    return (
      <div className="glass-panel rounded-2xl p-8 text-center text-sm text-muted-foreground">
        <ShieldCheck className="mx-auto mb-3 h-6 w-6 text-warning" />
        Only administrators can manage roles.
      </div>
    );
  }

  const btn = "inline-flex items-center gap-1.5 rounded-lg border border-border/60 bg-card/60 px-2.5 py-1.5 text-xs disabled:opacity-40";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Roles &amp; Permissions</h1>
          <p className="text-sm text-muted-foreground">
            Build any role you need, pick its permissions, then assign it to people for a site, line or station on People &amp; Access.
          </p>
        </div>
        <div className="flex gap-2">
          <button className={btn} onClick={() => setView(view === "editor" ? "matrix" : "editor")}>{view === "editor" ? "Compare all roles" : "Edit one role"}</button>
          <button
            className={btn}
            onClick={() =>
              exportRows(
                roles.map((r) => ({ role: r.label, key: r.key, built_in: r.is_system, people: q.data?.people.get(r.key) ?? 0, permissions: [...(q.data?.map.get(r.key) ?? [])].join(" ") })),
                "roles",
                "csv",
              )
            }
          >
            Export CSV
          </button>
          <button onClick={() => create()} className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-br from-primary to-info px-3 py-1.5 text-xs font-medium text-primary-foreground">
            <Plus className="h-3.5 w-3.5" /> New role
          </button>
        </div>
      </div>

      {view === "matrix" ? (
        <div className="glass-panel overflow-x-auto rounded-2xl">
          <table className="w-full text-xs">
            <thead className="bg-card/60 text-[10px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="sticky left-0 bg-card px-3 py-2 text-left">Permission</th>
                {roles.map((r) => <th key={r.key} className="px-2 py-2 text-center">{r.label}</th>)}
              </tr>
            </thead>
            <tbody>
              {(q.data?.perms ?? []).map((p) => (
                <tr key={p.key} className="border-t border-border/40">
                  <td className="sticky left-0 bg-card px-3 py-1.5 font-mono">{p.key}</td>
                  {roles.map((r) => (
                    <td key={r.key} className="text-center">{q.data?.map.get(r.key)?.has(p.key) ? <span className="text-success">●</span> : <span className="text-muted-foreground/30">·</span>}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
          <div className="glass-panel h-fit space-y-1 rounded-2xl p-2">
            {q.isLoading && <p className="p-4 text-xs text-muted-foreground">Loading roles…</p>}
            {roles.map((r) => (
              <button
                key={r.key}
                onClick={() => setSelKey(r.key)}
                className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm ${selKey === r.key ? "bg-primary/10 text-primary" : "hover:bg-card/60"}`}
              >
                <span className="min-w-0">
                  <span className="flex items-center gap-1.5 truncate font-medium">
                    {r.is_system && <Lock className="h-3 w-3 text-muted-foreground" />} {r.label}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {q.data?.map.get(r.key)?.size ?? 0} permissions · {q.data?.people.get(r.key) ?? 0} people
                  </span>
                </span>
              </button>
            ))}
          </div>

          {sel && (
            <div className="glass-panel space-y-4 rounded-2xl p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="grid flex-1 gap-2 sm:grid-cols-2">
                  <label className="text-xs">
                    <span className="text-muted-foreground">Role name</span>
                    <input value={label} onChange={(e) => setLabel(e.target.value)} className="mt-1 h-9 w-full rounded-lg border border-border/60 bg-card/60 px-2 text-sm" />
                  </label>
                  <label className="text-xs">
                    <span className="text-muted-foreground">Description</span>
                    <input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="What this role is for" className="mt-1 h-9 w-full rounded-lg border border-border/60 bg-card/60 px-2 text-sm" />
                  </label>
                  <p className="text-[11px] text-muted-foreground sm:col-span-2">
                    Key <span className="font-mono">{sel.key}</span> · {sel.is_system ? "built-in role (can be edited, not deleted)" : "custom role"} · held by {q.data?.people.get(sel.key) ?? 0} people
                  </p>
                </div>
                <div className="flex gap-1.5">
                  <button className={btn} onClick={() => create(sel)}><Copy className="h-3.5 w-3.5" /> Copy</button>
                  <button className={`${btn} text-destructive`} disabled={sel.is_system} onClick={remove} title={sel.is_system ? "Built-in roles can't be deleted" : "Delete role"}>
                    <Trash2 className="h-3.5 w-3.5" /> Delete
                  </button>
                  <button
                    onClick={save}
                    disabled={!dirty || busy}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-br from-primary to-info px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-40"
                  >
                    <Save className="h-3.5 w-3.5" /> {busy ? "Saving…" : "Save"}
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter permissions…" className="h-9 w-full rounded-lg border border-border/60 bg-card/60 pl-8 pr-2 text-sm" />
                </div>
                <span className="text-xs text-muted-foreground">{picked.size} selected</span>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                {Object.entries(groups).map(([cat, list]) => {
                  const all = list.filter((p) => !locked(p.key)).every((p) => picked.has(p.key));
                  return (
                    <div key={cat} className="rounded-xl border border-border/50 p-3">
                      <div className="mb-2 flex items-center justify-between">
                        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{cat}</span>
                        <button
                          className="text-[11px] text-primary"
                          onClick={() => {
                            const s = new Set(picked);
                            list.filter((p) => !locked(p.key)).forEach((p) => (all ? s.delete(p.key) : s.add(p.key)));
                            setPicked(s);
                          }}
                        >
                          {all ? "Clear all" : "Select all"}
                        </button>
                      </div>
                      <div className="space-y-1.5">
                        {list.map((p) => (
                          <label key={p.key} className={`flex items-start gap-2 text-sm ${locked(p.key) ? "opacity-50" : ""}`}>
                            <input type="checkbox" className="mt-1" checked={picked.has(p.key)} disabled={locked(p.key)} onChange={() => toggle(p.key)} />
                            <span>
                              <span className="font-mono text-xs">{p.key}</span>
                              {p.description && <span className="block text-[11px] text-muted-foreground">{p.description}</span>}
                              {locked(p.key) && <span className="block text-[11px] text-warning">Only a platform admin can change this</span>}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
