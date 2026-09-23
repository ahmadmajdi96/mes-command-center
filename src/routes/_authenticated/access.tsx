import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ShieldCheck, UserCheck, UserX, Trash2, Plus } from "lucide-react";
import {
  listPeopleWithAccess,
  listScopeOptions,
  grantRole,
  revokeRole,
  setPersonActive,
} from "@/lib/mes/authz.functions";
import { useCanAny } from "@/lib/access";

export const Route = createFileRoute("/_authenticated/access")({
  head: () => ({
    meta: [
      { title: "People & Access · Cortanex MES" },
      {
        name: "description",
        content: "Assign scoped roles to people and suspend accounts across sites, lines and stations.",
      },
      { property: "og:title", content: "People & Access · Cortanex MES" },
      {
        property: "og:description",
        content: "Scoped role assignment and account suspension for the Cortanex MES.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AccessPage,
});

const scopeKinds = ["global", "site", "line", "station"] as const;

function AccessPage() {
  const canAdmin = useCanAny(["users.admin", "platform.admin"]);
  const qc = useQueryClient();

  const people = useQuery({
    queryKey: ["people-access"],
    queryFn: () => listPeopleWithAccess(),
    enabled: canAdmin,
  });
  const options = useQuery({
    queryKey: ["scope-options"],
    queryFn: () => listScopeOptions(),
    enabled: canAdmin,
  });

  const [userId, setUserId] = useState("");
  const [roleKey, setRoleKey] = useState("");
  const [scopeKind, setScopeKind] = useState<(typeof scopeKinds)[number]>("site");
  const [scopeId, setScopeId] = useState("");

  const scopeChoices = useMemo(() => {
    if (!options.data) return [];
    if (scopeKind === "site") return options.data.sites.map((s) => ({ id: s.id, name: s.name }));
    if (scopeKind === "line") return options.data.lines.map((s) => ({ id: s.id, name: s.name }));
    if (scopeKind === "station") return options.data.stations.map((s) => ({ id: s.id, name: s.name }));
    return [];
  }, [options.data, scopeKind]);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["people-access"] });
    qc.invalidateQueries({ queryKey: ["my-access"] });
  };

  const grant = useMutation({
    mutationFn: () => grantRole({ data: { userId, roleKey, scopeKind, scopeId: scopeId || null } }),
    onSuccess: () => {
      toast.success("Role assigned");
      setRoleKey("");
      setScopeId("");
      refresh();
    },
    onError: (e: any) => toast.error(e?.message ?? "Could not assign the role"),
  });

  const revoke = useMutation({
    mutationFn: (v: { userId: string; roleKey: string; scopeKind: string; scopeId: string | null }) =>
      revokeRole({ data: v }),
    onSuccess: () => {
      toast.success("Role withdrawn");
      refresh();
    },
    onError: (e: any) => toast.error(e?.message ?? "Could not withdraw the role"),
  });

  const toggleActive = useMutation({
    mutationFn: (v: { userId: string; active: boolean }) => setPersonActive({ data: v }),
    onSuccess: (_d, v) => {
      toast.success(v.active ? "Account reactivated" : "Account suspended and all roles ended");
      refresh();
    },
    onError: (e: any) => toast.error(e?.message ?? "Could not change the account"),
  });

  if (!canAdmin) {
    return (
      <div className="glass-panel rounded-2xl p-8 text-center text-sm text-muted-foreground">
        <ShieldCheck className="mx-auto mb-3 h-6 w-6 text-warning" />
        Only administrators can manage people and access.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight">People &amp; Access</h1>
        <p className="text-sm text-muted-foreground">
          A person only sees what their roles allow, and only for the sites, lines or stations you choose.
        </p>
      </div>

      <div className="glass-panel space-y-3 rounded-2xl p-4">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">Assign a role</div>
        <div className="grid gap-3 md:grid-cols-5">
          <select
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            className="h-9 rounded-lg border border-border/60 bg-card/60 px-2 text-sm"
          >
            <option value="">Person…</option>
            {(people.data ?? []).map((p) => (
              <option key={p.user_id} value={p.user_id}>
                {p.full_name || p.email || p.user_id}
              </option>
            ))}
          </select>
          <select
            value={roleKey}
            onChange={(e) => setRoleKey(e.target.value)}
            className="h-9 rounded-lg border border-border/60 bg-card/60 px-2 text-sm"
          >
            <option value="">Role…</option>
            {(options.data?.roles ?? []).map((r) => (
              <option key={r.key} value={r.key}>
                {r.label}
              </option>
            ))}
          </select>
          <select
            value={scopeKind}
            onChange={(e) => {
              setScopeKind(e.target.value as (typeof scopeKinds)[number]);
              setScopeId("");
            }}
            className="h-9 rounded-lg border border-border/60 bg-card/60 px-2 text-sm"
          >
            {scopeKinds.map((k) => (
              <option key={k} value={k}>
                {k === "global" ? "Whole company" : k}
              </option>
            ))}
          </select>
          <select
            value={scopeId}
            onChange={(e) => setScopeId(e.target.value)}
            disabled={scopeKind === "global"}
            className="h-9 rounded-lg border border-border/60 bg-card/60 px-2 text-sm disabled:opacity-50"
          >
            <option value="">{scopeKind === "global" ? "—" : "Choose…"}</option>
            {scopeChoices.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <button
            onClick={() => grant.mutate()}
            disabled={!userId || !roleKey || grant.isPending || (scopeKind !== "global" && !scopeId)}
            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-gradient-to-br from-primary to-info px-3 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            <Plus className="h-3.5 w-3.5" />
            {grant.isPending ? "Assigning…" : "Assign"}
          </button>
        </div>
      </div>

      <div className="glass-panel overflow-hidden rounded-2xl">
        <table className="w-full text-sm">
          <thead className="bg-card/60 text-[10px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-left">Person</th>
              <th className="px-4 py-3 text-left">Roles &amp; scope</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {people.isLoading && (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-muted-foreground">
                  Loading people…
                </td>
              </tr>
            )}
            {(people.data ?? []).map((p) => (
              <tr key={p.user_id} className="border-t border-border/40 align-top">
                <td className="px-4 py-3">
                  <div className="font-medium">{p.full_name || "—"}</div>
                  <div className="text-[11px] text-muted-foreground">{p.email}</div>
                </td>
                <td className="px-4 py-3">
                  {p.grants.length === 0 ? (
                    <span className="text-xs text-muted-foreground">No access assigned</span>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {p.grants.map((g, i) => (
                        <span
                          key={i}
                          className="inline-flex items-center gap-1 rounded-md border border-border/60 bg-card/60 px-2 py-0.5 text-[11px]"
                        >
                          {g.role_key} · {g.scope_kind === "global" ? "all" : g.scope_id}
                          <button
                            title="Withdraw"
                            onClick={() =>
                              revoke.mutate({
                                userId: p.user_id,
                                roleKey: g.role_key,
                                scopeKind: g.scope_kind,
                                scopeId: g.scope_id,
                              })
                            }
                            className="text-muted-foreground hover:text-destructive"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-md border px-2 py-0.5 text-[10px] uppercase tracking-wider ${
                      p.active
                        ? "border-success/40 bg-success/10 text-success"
                        : "border-destructive/40 bg-destructive/10 text-destructive"
                    }`}
                  >
                    {p.active ? "active" : "suspended"}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => toggleActive.mutate({ userId: p.user_id, active: !p.active })}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 bg-card/60 px-2.5 py-1.5 text-xs"
                  >
                    {p.active ? <UserX className="h-3.5 w-3.5" /> : <UserCheck className="h-3.5 w-3.5" />}
                    {p.active ? "Suspend" : "Reactivate"}
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
