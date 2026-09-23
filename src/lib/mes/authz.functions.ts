import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type AccessGrant = {
  role_key: string;
  scope_kind: string;
  scope_id: string | null;
};

export type MyAccess = {
  userId: string;
  email: string | null;
  displayName: string | null;
  permissions: string[];
  grants: AccessGrant[];
};

/** The signed-in person's effective permissions and scopes. Derived server-side only. */
export const getMyAccess = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MyAccess> => {
    const { supabase, userId, claims } = context;
    const now = Date.now();

    const { data: rawGrants } = await supabase
      .from("user_role_grants")
      .select("role_key, scope_kind, scope_id, effective_from, effective_to")
      .eq("user_id", userId);

    const grants = (rawGrants ?? []).filter(
      (g) =>
        (!g.effective_from || new Date(g.effective_from).getTime() <= now) &&
        (!g.effective_to || new Date(g.effective_to).getTime() > now),
    );

    let permissions: string[] = [];
    if (grants.length > 0) {
      const { data: perms } = await supabase
        .from("role_permissions")
        .select("permission_key")
        .in(
          "role_key",
          Array.from(new Set(grants.map((g) => g.role_key))),
        );
      permissions = Array.from(new Set((perms ?? []).map((p) => p.permission_key)));
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", userId)
      .maybeSingle();

    return {
      userId,
      email: (claims as { email?: string } | null)?.email ?? null,
      displayName: profile?.full_name ?? null,
      permissions,
      grants: grants.map((g) => ({
        role_key: g.role_key,
        scope_kind: g.scope_kind,
        scope_id: g.scope_id ?? null,
      })),
    };
  });

export type PersonWithAccess = {
  user_id: string;
  email: string | null;
  full_name: string | null;
  active: boolean;
  grants: AccessGrant[];
};

/** Admin view: everyone with a login account plus their scoped role grants. */
export const listPeopleWithAccess = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PersonWithAccess[]> => {
    const { data: allowed } = await context.supabase.rpc("can_admin_users", {
      _user_id: context.userId,
    });
    if (!allowed) throw new Error("You do not have permission to manage people");

    const { data: profiles } = await context.supabase
      .from("profiles")
      .select("id, email, full_name")
      .order("email");
    const { data: grants } = await context.supabase
      .from("user_role_grants")
      .select("user_id, role_key, scope_kind, scope_id");
    const { data: workforce } = await context.supabase
      .from("mes_users")
      .select("auth_user_id, active");

    const activeById = new Map(
      (workforce ?? [])
        .filter((w) => w.auth_user_id)
        .map((w) => [w.auth_user_id as string, w.active]),
    );

    return (profiles ?? []).map((p) => ({
      user_id: p.id,
      email: p.email ?? null,
      full_name: p.full_name ?? null,
      active: activeById.get(p.id) ?? true,
      grants: (grants ?? [])
        .filter((g) => g.user_id === p.id)
        .map((g) => ({ role_key: g.role_key, scope_kind: g.scope_kind, scope_id: g.scope_id ?? null })),
    }));
  });

/** Grant a role to a person, limited to a scope. */
export const grantRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string; roleKey: string; scopeKind: string; scopeId?: string | null }) => {
    if (!d.userId || !d.roleKey) throw new Error("A person and a role are required");
    const kinds = ["global", "org", "site", "area", "line", "station"];
    if (!kinds.includes(d.scopeKind)) throw new Error("Unknown scope");
    if (d.scopeKind !== "global" && !d.scopeId) throw new Error("This scope needs a specific site, line or station");
    return d;
  })
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("user_role_grants").insert({
      user_id: data.userId,
      role_key: data.roleKey,
      scope_kind: data.scopeKind,
      scope_id: data.scopeKind === "global" ? null : data.scopeId!,
      granted_by: context.userId,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Withdraw a role grant. */
export const revokeRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string; roleKey: string; scopeKind: string; scopeId?: string | null }) => d)
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("user_role_grants")
      .delete()
      .eq("user_id", data.userId)
      .eq("role_key", data.roleKey)
      .eq("scope_kind", data.scopeKind);
    q = data.scopeId ? q.eq("scope_id", data.scopeId) : q.is("scope_id", null);
    const { error } = await q;
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Suspend or reactivate a person's workforce record. */
export const setPersonActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string; active: boolean }) => d)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("mes_users")
      .update({ active: data.active })
      .eq("auth_user_id", data.userId);
    if (error) throw new Error(error.message);
    if (!data.active) {
      // Suspension ends every effective grant immediately.
      await context.supabase
        .from("user_role_grants")
        .update({ effective_to: new Date().toISOString() })
        .eq("user_id", data.userId)
        .is("effective_to", null);
    }
    return { ok: true };
  });

export const listScopeOptions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const [{ data: sites }, { data: lines }, { data: stations }, { data: roles }] = await Promise.all([
      context.supabase.from("sites").select("id, name"),
      context.supabase.from("lines").select("id, name"),
      context.supabase.from("stations").select("id, name"),
      context.supabase.from("roles").select("key, label").order("label"),
    ]);
    return {
      sites: sites ?? [],
      lines: lines ?? [],
      stations: stations ?? [],
      roles: roles ?? [],
    };
  });
