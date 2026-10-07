import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { PASSWORD_RULES, passwordOk } from "@/lib/password-rules";

export const Route = createFileRoute("/reset-password")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Set a new password · Cortanex MES" },
      { name: "description", content: "Choose a new password for your Cortanex MES account." },
      { property: "og:title", content: "Set a new password · Cortanex MES" },
      { property: "og:description", content: "Reset your Cortanex MES password." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ResetPassword,
});

function ResetPassword() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((e) => { if (e === "PASSWORD_RECOVERY" || e === "SIGNED_IN") setReady(true); });
    supabase.auth.getSession().then(({ data: s }) => { if (s.session) setReady(true); });
    return () => data.subscription.unsubscribe();
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!passwordOk(pw)) return toast.error("Password doesn't meet the rules");
    if (pw !== pw2) return toast.error("The two passwords don't match");
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Password changed");
    navigate({ to: "/", replace: true });
  }

  const inp = "mt-1 h-10 w-full rounded-lg border border-border/60 bg-background/50 px-3 text-sm focus:border-primary/50 focus:outline-none";
  return (
    <div className="grid min-h-screen place-items-center bg-background px-4">
      <form onSubmit={save} className="glass-panel w-full max-w-md space-y-3 rounded-2xl p-6">
        <h1 className="font-display text-xl font-semibold">Set a new password</h1>
        {!ready ? (
          <p className="text-sm text-muted-foreground">Open this page from the link in your reset email. If the link expired, request a new one from the sign-in page.</p>
        ) : (
          <>
            <label className="block text-[11px] uppercase tracking-wider text-muted-foreground">New password
              <input type="password" autoComplete="new-password" className={inp} value={pw} onChange={(e) => setPw(e.target.value)} /></label>
            <ul className="space-y-0.5 text-[11px]">
              {PASSWORD_RULES.map((r) => <li key={r.label} className={r.test(pw) ? "text-success" : "text-muted-foreground"}>{r.test(pw) ? "✓" : "•"} {r.label}</li>)}
            </ul>
            <label className="block text-[11px] uppercase tracking-wider text-muted-foreground">Repeat password
              <input type="password" autoComplete="new-password" className={inp} value={pw2} onChange={(e) => setPw2(e.target.value)} /></label>
            {pw2 && pw !== pw2 && <p className="text-xs text-destructive">The two passwords don't match</p>}
            <button disabled={busy || !passwordOk(pw) || pw !== pw2} className="h-10 w-full rounded-lg bg-primary text-sm font-medium text-primary-foreground disabled:opacity-60">Save password</button>
          </>
        )}
      </form>
    </div>
  );
}
