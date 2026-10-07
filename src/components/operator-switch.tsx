import { useEffect, useState } from "react";
import { toast } from "sonner";
import { UserRoundCheck, UserRoundPlus, X } from "lucide-react";
import { useRows } from "@/lib/execution-db";
import { setOperatorPin, verifyOperatorPin } from "@/lib/mes/pin.functions";
import { btn, ghost, inp } from "@/components/qp-ui";

const KEY = "mes-active-operator";
export type ActiveOperator = { id: string; name: string };

export function useActiveOperator(): [ActiveOperator | null, (o: ActiveOperator | null) => void] {
  const [op, setOp] = useState<ActiveOperator | null>(() => {
    try { const raw = localStorage.getItem(KEY); return raw ? JSON.parse(raw) : null; } catch { return null; }
  });
  const set = (o: ActiveOperator | null) => {
    setOp(o);
    try { o ? localStorage.setItem(KEY, JSON.stringify(o)) : localStorage.removeItem(KEY); } catch { /* ignore */ }
    window.dispatchEvent(new Event("mes-operator-changed"));
  };
  useEffect(() => {
    const on = () => { try { const raw = localStorage.getItem(KEY); setOp(raw ? JSON.parse(raw) : null); } catch { setOp(null); } };
    window.addEventListener("mes-operator-changed", on);
    return () => window.removeEventListener("mes-operator-changed", on);
  }, []);
  return [op, set];
}

/** Chip showing the operator currently signed in on this shared device, with a PIN switch dialog. */
export function OperatorSwitch() {
  const [op, setOp] = useActiveOperator();
  const { data: profiles = [] } = useRows<any>("profiles", { order: "full_name", asc: true });
  const [open, setOpen] = useState(false);
  const [pick, setPick] = useState("");
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);

  const switchTo = async () => {
    if (!pick || !pin) return toast.error("Pick a person and enter their PIN");
    setBusy(true);
    try {
      const r = await verifyOperatorPin({ data: { user_id: pick, pin } });
      if (!r.ok) return toast.error(r.error ?? "Wrong PIN");
      setOp({ id: pick, name: r.name ?? "Operator" });
      toast.success(`Now working as ${r.name}`);
      setOpen(false); setPin(""); setPick("");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Could not verify PIN"); }
    finally { setBusy(false); }
  };

  return (
    <>
      <button className={ghost + " flex items-center gap-1.5"} onClick={() => setOpen(true)} title="Switch the operator working on this device">
        <UserRoundCheck className="h-3.5 w-3.5 text-primary" />
        {op ? <span>Working as <b>{op.name}</b></span> : <span>Switch operator</span>}
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setOpen(false)}>
          <div className="glass-panel w-full max-w-sm space-y-3 rounded-2xl p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-sm font-semibold"><UserRoundPlus className="h-4 w-4 text-primary" />Switch operator</h3>
              <button className={ghost} onClick={() => setOpen(false)}><X className="h-4 w-4" /></button>
            </div>
            <p className="text-xs text-muted-foreground">On a shared station, the person starting work enters their PIN so actions are recorded under their name.</p>
            <label className="block text-xs">Person
              <select className={inp} value={pick} onChange={(e) => setPick(e.target.value)}>
                <option value="">Choose…</option>
                {profiles.map((p: any) => <option key={p.id} value={p.id}>{p.full_name || p.email}</option>)}
              </select>
            </label>
            <label className="block text-xs">PIN
              <input className={inp} type="password" inputMode="numeric" autoComplete="off" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 8))} placeholder="4–8 digits" />
            </label>
            <div className="flex gap-2">
              <button className={btn} disabled={busy} onClick={switchTo}>{busy ? "Checking…" : "Start working"}</button>
              {op && <button className={ghost} onClick={() => { setOp(null); setOpen(false); toast.success("Operator cleared"); }}>Clear</button>}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/** Small form for the Profile page so each person can set their own PIN. */
export function SetMyPin() {
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try {
      await setOperatorPin({ data: { pin } });
      toast.success("Your station PIN is set");
      setPin("");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Could not save PIN"); }
    finally { setBusy(false); }
  };
  return (
    <label className="block text-xs">Station PIN (for shared screens)
      <div className="flex gap-2">
        <input className={inp} type="password" inputMode="numeric" autoComplete="off" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 8))} placeholder="4–8 digits" />
        <button className={btn} disabled={busy || pin.length < 4} onClick={save}>{busy ? "Saving…" : "Set PIN"}</button>
      </div>
      <span className="text-muted-foreground">Used to switch operator on shared station screens. Never shared with anyone.</span>
    </label>
  );
}
