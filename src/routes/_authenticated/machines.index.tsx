import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, Plus } from "lucide-react";
import { useRows, useWrite, errMsg } from "@/lib/execution-db";
import { PROTOCOLS, protocolName, type Machine } from "@/lib/machines";

export const Route = createFileRoute("/_authenticated/machines/")({
  head: () => ({
    meta: [
      { title: "Machines — Cortanex MES" },
      { name: "description", content: "Machines, protocols, live readings and commands." },
      { property: "og:title", content: "Machines — Cortanex MES" },
      { property: "og:description", content: "Machine read/command edge apps." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});

function Page() {
  const nav = useNavigate();
  const { data: machines = [] } = useRows<Machine>("machines");
  const { data: stations = [] } = useRows<{ id: string; name: string }>("stations", { order: "name", asc: true });
  const w = useWrite("machines");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ id: "", name: "", protocol: "opcua", endpoint: "", station_id: "", vendor: "", connection_mode: "simulated" });
  const [err, setErr] = useState("");
  const list = machines.filter((m) => !q || `${m.id} ${m.name} ${m.vendor} ${protocolName(m.protocol)}`.toLowerCase().includes(q.toLowerCase()));
  const create = async () => {
    setErr("");
    try {
      await w.insert.mutateAsync({ ...f, id: f.id || `MC-${Date.now().toString(36).toUpperCase()}`, station_id: f.station_id || null, tags: [], commands: [] });
      setOpen(false); nav({ to: "/machines/$machineId", params: { machineId: f.id || "" } }).catch(() => {});
    } catch (e) { setErr(errMsg(e)); }
  };
  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center gap-3">
        <Link to="/" className="rounded-lg border border-border/60 p-2" aria-label="Back"><ArrowLeft className="h-4 w-4" /></Link>
        <div className="flex-1"><h1 className="text-2xl font-semibold">Machines</h1><p className="text-sm text-muted-foreground">Read values from and send commands to line machines. Simulated or manual until an edge box is connected.</p></div>
        <button onClick={() => setOpen(!open)} className="flex items-center gap-1 rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground"><Plus className="h-4 w-4" />Add machine</button>
      </div>
      {open && (
        <div className="glass-panel grid gap-2 rounded-2xl p-4 text-sm md:grid-cols-3">
          {(["id", "name", "vendor", "endpoint"] as const).map((k) => (
            <input key={k} aria-label={k} placeholder={k === "id" ? "ID (optional)" : k === "endpoint" ? PROTOCOLS.find((p) => p.key === f.protocol)?.hint : k[0].toUpperCase() + k.slice(1)} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} className="rounded-lg border border-border/60 bg-background px-2 py-1" />
          ))}
          <select aria-label="Protocol" value={f.protocol} onChange={(e) => setF({ ...f, protocol: e.target.value })} className="rounded-lg border border-border/60 bg-background px-2 py-1">
            {PROTOCOLS.map((p) => <option key={p.key} value={p.key}>{p.name}</option>)}
          </select>
          <select aria-label="Station" value={f.station_id} onChange={(e) => setF({ ...f, station_id: e.target.value })} className="rounded-lg border border-border/60 bg-background px-2 py-1">
            <option value="">No station</option>{stations.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <select aria-label="Mode" value={f.connection_mode} onChange={(e) => setF({ ...f, connection_mode: e.target.value })} className="rounded-lg border border-border/60 bg-background px-2 py-1">
            <option value="simulated">Simulated</option><option value="manual">Manual entry</option><option value="edge">Edge box</option>
          </select>
          <button disabled={!f.name} onClick={create} className="rounded-lg bg-primary px-3 py-1 text-primary-foreground disabled:opacity-50">Create</button>
          {err && <div className="text-destructive md:col-span-3">{err}</div>}
        </div>
      )}
      <input aria-label="Search" placeholder="Search machines…" value={q} onChange={(e) => setQ(e.target.value)} className="w-full max-w-sm rounded-lg border border-border/60 bg-background px-3 py-2 text-sm" />
      <div className="glass-panel overflow-x-auto rounded-2xl">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-muted-foreground"><th className="p-3">Machine</th><th>Protocol</th><th>Station</th><th>Mode</th><th>Status</th><th>Last seen</th></tr></thead>
          <tbody>
            {list.map((m) => (
              <tr key={m.id} onClick={() => nav({ to: "/machines/$machineId", params: { machineId: m.id } })} className="cursor-pointer border-t border-border/40 hover:bg-muted/40">
                <td className="p-3"><div className="font-medium">{m.name}</div><div className="text-xs text-muted-foreground">{m.id}{m.vendor ? ` · ${m.vendor}` : ""}</div></td>
                <td>{protocolName(m.protocol)}</td>
                <td>{stations.find((s) => s.id === m.station_id)?.name ?? "—"}</td>
                <td className="capitalize">{m.connection_mode}</td>
                <td className={m.status === "online" ? "text-success" : "text-muted-foreground"}>{m.status}</td>
                <td>{m.last_seen_at ? new Date(m.last_seen_at).toLocaleString() : "—"}</td>
              </tr>
            ))}
            {!list.length && <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">No machines yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
