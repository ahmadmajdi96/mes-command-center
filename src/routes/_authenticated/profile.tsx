import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Mail, Phone, ShieldCheck, Briefcase, User as UserIcon, KeyRound } from "lucide-react";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({
    meta: [
      { title: "My profile · Cortanex MES" },
      { name: "description", content: "Manage your Cortanex MES account details, contact information and password." },
      { property: "og:title", content: "My profile · Cortanex MES" },
      { property: "og:description", content: "Manage your MES account details and password." },
      { property: "og:type", content: "profile" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const { user } = Route.useRouteContext();
  const queryClient = useQueryClient();

  const { data: profile, isLoading } = useQuery({
    queryKey: ["my-profile", user.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: roles } = useQuery({
    queryKey: ["my-roles", user.id],
    queryFn: async () => {
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
      return (data ?? []).map((r) => r.role as string);
    },
  });

  const [form, setForm] = useState({ full_name: "", job_title: "", phone: "", avatar_url: "" });
  useEffect(() => {
    if (profile) {
      setForm({
        full_name: profile.full_name ?? "",
        job_title: profile.job_title ?? "",
        phone: profile.phone ?? "",
        avatar_url: profile.avatar_url ?? "",
      });
    }
  }, [profile]);

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("profiles")
        .upsert({ id: user.id, email: user.email, ...form });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Profile saved");
      queryClient.invalidateQueries({ queryKey: ["my-profile", user.id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const changePassword = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
        // @ts-expect-error current_password is supported by Lovable Cloud auth
        current_password: currentPassword,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Password updated");
      setCurrentPassword("");
      setNewPassword("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const name = form.full_name || user.email || "User";
  const initials = name.split(/[\s@.]+/).filter(Boolean).map((p) => p[0]).join("").slice(0, 2).toUpperCase();

  const field = "h-10 w-full rounded-lg border border-border/60 bg-background/50 px-3 text-sm focus:border-primary/50 focus:outline-none";
  const label = "text-[11px] uppercase tracking-wider text-muted-foreground";

  return (
    <div className="space-y-6">
      <div className="glass-panel rounded-2xl p-5">
        <div className="flex flex-wrap items-center gap-4">
          {form.avatar_url ? (
            <img src={form.avatar_url} alt={name} className="h-16 w-16 rounded-2xl object-cover" />
          ) : (
            <div className="grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-primary to-info text-lg font-bold text-primary-foreground shadow-[var(--shadow-glow)]">
              {initials}
            </div>
          )}
          <div className="min-w-0">
            <h1 className="font-display text-2xl font-semibold tracking-tight">{name}</h1>
            <p className="text-xs text-muted-foreground">{form.job_title || "—"}</p>
            <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
              <span className="inline-flex items-center gap-1.5 rounded-md border border-border/60 bg-background/40 px-2 py-0.5 text-muted-foreground">
                <Mail className="h-3 w-3" /> {user.email}
              </span>
              {(roles ?? []).map((r) => (
                <span key={r} className="inline-flex items-center gap-1 rounded-md border border-primary/40 bg-primary/10 px-2 py-0.5 uppercase tracking-wider text-primary">
                  <ShieldCheck className="h-3 w-3" /> {r}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <form
          onSubmit={(e) => { e.preventDefault(); save.mutate(); }}
          className="glass-panel space-y-3 rounded-2xl p-4"
        >
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
            <UserIcon className="h-3 w-3" /> Account details
          </div>
          {isLoading ? (
            <div className="text-xs text-muted-foreground">Loading…</div>
          ) : (
            <>
              <label className="block">
                <span className={label}>Full name</span>
                <input className={`${field} mt-1`} value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
              </label>
              <label className="block">
                <span className={label}>Job title</span>
                <div className="relative mt-1">
                  <Briefcase className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <input className={`${field} pl-8`} value={form.job_title} onChange={(e) => setForm({ ...form, job_title: e.target.value })} />
                </div>
              </label>
              <label className="block">
                <span className={label}>Mobile</span>
                <div className="relative mt-1">
                  <Phone className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <input className={`${field} pl-8`} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                </div>
              </label>
              <label className="block">
                <span className={label}>Avatar image URL</span>
                <input className={`${field} mt-1`} value={form.avatar_url} onChange={(e) => setForm({ ...form, avatar_url: e.target.value })} placeholder="https://…" />
              </label>
              <button
                type="submit"
                disabled={save.isPending}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 disabled:opacity-60"
              >
                {save.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Save changes
              </button>
            </>
          )}
        </form>

        <form
          onSubmit={(e) => { e.preventDefault(); changePassword.mutate(); }}
          className="glass-panel space-y-3 rounded-2xl p-4"
        >
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
            <KeyRound className="h-3 w-3" /> Change password
          </div>
          <label className="block">
            <span className={label}>Current password</span>
            <input type="password" required autoComplete="current-password" className={`${field} mt-1`} value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
          </label>
          <label className="block">
            <span className={label}>New password</span>
            <input type="password" required minLength={6} autoComplete="new-password" className={`${field} mt-1`} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
          </label>
          <button
            type="submit"
            disabled={changePassword.isPending}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-border/60 bg-card/60 px-4 text-sm font-medium transition hover:border-primary/50 disabled:opacity-60"
          >
            {changePassword.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Update password
          </button>
        </form>
      </div>
    </div>
  );
}
