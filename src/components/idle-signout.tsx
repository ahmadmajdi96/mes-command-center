import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/** Signs the person out after the company's idle time; warns 60 seconds before. */
export function IdleSignout() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: minutes = 15 } = useQuery({
    queryKey: ["idle-minutes"],
    staleTime: 300_000,
    queryFn: async () => {
      const { data } = await supabase.from("approval_settings" as never).select("idle_signout_minutes").limit(1).maybeSingle();
      return Number((data as { idle_signout_minutes?: number } | null)?.idle_signout_minutes ?? 15);
    },
  });
  const last = useRef(Date.now());
  const [left, setLeft] = useState<number | null>(null);

  useEffect(() => {
    const bump = () => { last.current = Date.now(); };
    const evs = ["mousemove", "keydown", "pointerdown", "touchstart", "scroll"];
    evs.forEach((e) => window.addEventListener(e, bump, { passive: true }));
    const t = setInterval(async () => {
      const remain = minutes * 60_000 - (Date.now() - last.current);
      if (remain <= 0) {
        clearInterval(t);
        await qc.cancelQueries(); qc.clear();
        await supabase.auth.signOut();
        navigate({ to: "/auth", replace: true });
      } else setLeft(remain <= 60_000 ? Math.ceil(remain / 1000) : null);
    }, 1000);
    return () => { clearInterval(t); evs.forEach((e) => window.removeEventListener(e, bump)); };
  }, [minutes, navigate, qc]);

  if (left == null) return null;
  return (
    <div className="fixed inset-x-0 bottom-4 z-[60] mx-auto w-fit rounded-xl border border-warning/50 bg-card px-4 py-3 text-sm shadow-lg">
      No activity — signing out in {left}s. <button className="ml-2 text-primary underline" onClick={() => { last.current = Date.now(); setLeft(null); }}>Stay signed in</button>
    </div>
  );
}
