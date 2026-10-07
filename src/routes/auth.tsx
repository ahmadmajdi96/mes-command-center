import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { signInWithLockout } from "@/lib/mes/auth.functions";
import { PASSWORD_RULES, passwordOk } from "@/lib/password-rules";
import { Factory, Loader2, Lock, Mail, User as UserIcon } from "lucide-react";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Sign in · Cortanex MES" },
      { name: "description", content: "Sign in to Cortanex MES to access shop-floor execution, OEE, traceability and quality holds." },
      { property: "og:title", content: "Sign in · Cortanex MES" },
      { property: "og:description", content: "Secure access to Cortanex Manufacturing Execution System." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup" | "forgot">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/", replace: true });
    });
  }, [navigate]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setNotice(null);
    try {
      if (mode === "signin") {
        const r = await signInWithLockout({ data: { email, password } });
        if (!r.ok) throw new Error(r.error);
        const { error } = await supabase.auth.setSession({ access_token: r.access_token, refresh_token: r.refresh_token });
        if (error) throw error;
        toast.success("Welcome back");
        navigate({ to: "/", replace: true });
      } else if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` });
        if (error) throw error;
        setNotice("If that email has an account, a reset link is on its way. Check your inbox.");
      } else {
        if (!passwordOk(password)) throw new Error("Password doesn't meet the rules below");
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { full_name: fullName || email.split("@")[0] },
          },
        });
        if (error) throw error;
        if (data.session) {
          toast.success("Account created");
          navigate({ to: "/", replace: true });
        } else {
          setNotice("Check your email to confirm your account, then sign in.");
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong";
      setNotice(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-screen place-items-center bg-background px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-primary to-info text-primary-foreground shadow-[var(--shadow-glow)]">
            <Factory className="h-5 w-5" />
          </div>
          <div>
            <h1 className="font-display text-xl font-semibold tracking-tight">Cortanex MES</h1>
            <p className="text-xs text-muted-foreground">Manufacturing Execution System</p>
          </div>
        </div>

        <div className="glass-panel rounded-2xl p-6">
          <div className="mb-4 flex gap-1 rounded-lg border border-border/60 bg-background/40 p-1 text-xs">
            {(["signin", "signup"] as const).map((m) => (
              <button
                key={m}
                onClick={() => { setMode(m); setNotice(null); }}
                className={`flex-1 rounded-md px-3 py-1.5 font-medium transition ${
                  mode === m ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {m === "signin" ? "Sign in" : "Create account"}
              </button>
            ))}
          </div>

          <form onSubmit={onSubmit} className="space-y-3">
            {mode === "signup" && (
              <label className="block">
                <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Full name</span>
                <div className="relative mt-1">
                  <UserIcon className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <input
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Faisal A."
                    className="h-10 w-full rounded-lg border border-border/60 bg-background/50 pl-8 pr-3 text-sm focus:border-primary/50 focus:outline-none"
                  />
                </div>
              </label>
            )}

            <label className="block">
              <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Email</span>
              <div className="relative mt-1">
                <Mail className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  className="h-10 w-full rounded-lg border border-border/60 bg-background/50 pl-8 pr-3 text-sm focus:border-primary/50 focus:outline-none"
                />
              </div>
            </label>

            {mode !== "forgot" && <label className="block">
              <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Password</span>
              <div className="relative mt-1">
                <Lock className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="password"
                  required
                  minLength={mode === "signup" ? 10 : 1}
                  autoComplete={mode === "signin" ? "current-password" : "new-password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="h-10 w-full rounded-lg border border-border/60 bg-background/50 pl-8 pr-3 text-sm focus:border-primary/50 focus:outline-none"
                />
              </div>
              {mode === "signup" && (
                <ul className="mt-2 space-y-0.5 text-[11px]">
                  {PASSWORD_RULES.map((r) => (
                    <li key={r.label} className={r.test(password) ? "text-success" : "text-muted-foreground"}>{r.test(password) ? "✓" : "•"} {r.label}</li>
                  ))}
                </ul>
              )}
            </label>}

            {mode === "signin" && (
              <button type="button" onClick={() => { setMode("forgot"); setNotice(null); }} className="text-[11px] text-primary hover:underline">Forgot password?</button>
            )}
            {mode === "forgot" && (
              <button type="button" onClick={() => { setMode("signin"); setNotice(null); }} className="text-[11px] text-primary hover:underline">Back to sign in</button>
            )}

            {notice && (
              <div className="rounded-lg border border-border/60 bg-background/40 p-2 text-xs text-muted-foreground">
                {notice}
              </div>
            )}

            <button
              type="submit"
              disabled={busy}
              className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-primary text-sm font-medium text-primary-foreground transition hover:bg-primary/90 disabled:opacity-60"
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              {mode === "signin" ? "Sign in" : mode === "forgot" ? "Send reset link" : "Create account"}
            </button>
          </form>

          <p className="mt-4 text-center text-[11px] text-muted-foreground">
            5 wrong passwords lock the account for 15 minutes.
          </p>
        </div>
      </div>
    </div>
  );
}
