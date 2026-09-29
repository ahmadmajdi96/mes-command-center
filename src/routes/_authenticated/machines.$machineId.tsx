import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, Trash2 } from "lucide-react";
import { useRows, useWrite, errMsg } from "@/lib/execution-db";
import { PROTOCOLS, protocolName, type Machine, type MachineTag, type MachineCommand } from "@/lib/machines";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { DRIVERS } from "@/lib/mes/machine-drivers";
import { testMachineConnection, pollMachine, sendMachineCommand } from "@/lib/mes/machines.functions";

export const Route = createFileRoute("/_authenticated/machines/$machineId")({
  head: ({ params }) => ({
    meta: [
      { title: `Machine ${params.machineId} — Cortanex MES` },
      { name: "description", content: "Machine tags, readings and commands." },
      { property: "og:title", content: `Machine ${params.machineId}` },
      { property: "og:description", content: "Machine tags, readings and commands." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});

const inp = "rounded-lg border border-border/60 bg-background px-2 py-1";

function Page() {
  const { machineId } = Route.useParams();
  const { data: ms = [], isLoading } = useRows<Machine>("machines", { eq: { id: machineId } });
  const m = ms[0];
  if (isLoading) return <div className="p-6">Loading…</div>;
  if (!m) return <div className="space-y-3 p-6"><Back /><p>Machine not found.</p></div>;
  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center gap-3"><Back /><div><h1 className="text-2xl font-semibold">{m.name}</h1>
        <p className="text-sm text-muted-foreground">{m.id} · {protocolName(m.protocol)} · {m.endpoint || "no address"} · <span className="capitalize">{m.connection_mode}</span> · {m.status}</p></div></div>
      <Settings m={m} />
      <DriverPanel m={m} />
      <div className="grid gap-4 lg:grid-cols-2"><Readings m={m} /><Commands m={m} /></div>
    </div>
  );
}

function Back() {
  return <Link to="/machines" className="rounded-lg border border-border/60 p-2" aria-label="Back"><ArrowLeft className="h-4 w-4" /></Link>;
}

function Settings({ m }: { m: Machine }) {
  const w = useWrite("machines");
  const { data: stations = [] } = useRows<{ id: string; name: string }>("stations", { order: "name", asc: true });
  const [f, setF] = useState({ ...m });
  const [msg, setMsg] = useState("");
  const save = async () => {
    setMsg("");
    try { await w.update.mutateAsync({ id: m.id, patch: { name: f.name, vendor: f.vendor, model: f.model, protocol: f.protocol, endpoint: f.endpoint, station_id: f.station_id || null, connection_mode: f.connection_mode, tags: f.tags, commands: f.commands, notes: f.notes } }); setMsg("Saved"); }
    catch (e) { setMsg(errMsg(e)); }
  };
  const hint = PROTOCOLS.find((p) => p.key === f.protocol);
  const setTag = (i: number, p: Partial<MachineTag>) => setF({ ...f, tags: f.tags.map((t, j) => (j === i ? { ...t, ...p } : t)) });
  const setCmd = (i: number, p: Partial<MachineCommand>) => setF({ ...f, commands: f.commands.map((t, j) => (j === i ? { ...t, ...p } : t)) });
  const num = (v: string) => (v === "" ? null : Number(v));
  return (
    <section className="glass-panel space-y-3 rounded-2xl p-4 text-sm">
      <h2 className="font-semibold">Connection</h2>
      <div className="grid gap-2 md:grid-cols-4">
        <input aria-label="Name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} className={inp} />
        <input aria-label="Vendor" placeholder="Vendor" value={f.vendor ?? ""} onChange={(e) => setF({ ...f, vendor: e.target.value })} className={inp} />
        <input aria-label="Model" placeholder="Model" value={f.model ?? ""} onChange={(e) => setF({ ...f, model: e.target.value })} className={inp} />
        <select aria-label="Protocol" value={f.protocol} onChange={(e) => setF({ ...f, protocol: e.target.value })} className={inp}>{PROTOCOLS.map((p) => <option key={p.key} value={p.key}>{p.name}</option>)}</select>
        <input aria-label="Address" placeholder={hint?.hint} value={f.endpoint ?? ""} onChange={(e) => setF({ ...f, endpoint: e.target.value })} className={`${inp} md:col-span-2`} />
        <select aria-label="Station" value={f.station_id ?? ""} onChange={(e) => setF({ ...f, station_id: e.target.value })} className={inp}><option value="">No station</option>{stations.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
        <select aria-label="Mode" value={f.connection_mode} onChange={(e) => setF({ ...f, connection_mode: e.target.value as Machine["connection_mode"] })} className={inp}><option value="simulated">Simulated</option><option value="manual">Manual entry</option><option value="edge">Edge box</option></select>
      </div>
      <h3 className="font-medium">Tags (values read from the machine)</h3>
      {f.tags.map((t, i) => (
        <div key={i} className="flex flex-wrap items-center gap-2">
          <input aria-label="Tag name" placeholder="Name" value={t.name} onChange={(e) => setTag(i, { name: e.target.value })} className={inp} />
          <input aria-label="Tag address" placeholder={hint?.addr} value={t.address ?? ""} onChange={(e) => setTag(i, { address: e.target.value })} className={inp} />
          <input aria-label="Unit" placeholder="Unit" value={t.unit ?? ""} onChange={(e) => setTag(i, { unit: e.target.value })} className={`${inp} w-20`} />
          <input aria-label="Min" type="number" placeholder="Min" value={t.min ?? ""} onChange={(e) => setTag(i, { min: num(e.target.value) })} className={`${inp} w-24`} />
          <input aria-label="Max" type="number" placeholder="Max" value={t.max ?? ""} onChange={(e) => setTag(i, { max: num(e.target.value) })} className={`${inp} w-24`} />
          <label className="flex items-center gap-1"><input type="checkbox" checked={!!t.hold_on_breach} onChange={(e) => setTag(i, { hold_on_breach: e.target.checked })} />Hold station if outside</label>
          <button aria-label="Remove tag" onClick={() => setF({ ...f, tags: f.tags.filter((_, j) => j !== i) })}><Trash2 className="h-4 w-4" /></button>
        </div>
      ))}
      <button onClick={() => setF({ ...f, tags: [...f.tags, { name: "", unit: "" }] })} className="rounded-lg border border-border/60 px-3 py-1">Add tag</button>
      <h3 className="font-medium">Commands (what may be sent to the machine)</h3>
      {f.commands.map((c, i) => (
        <div key={i} className="flex flex-wrap items-center gap-2">
          <input aria-label="Command name" placeholder="e.g. Start, Stop, Set speed" value={c.name} onChange={(e) => setCmd(i, { name: e.target.value })} className={inp} />
          <input aria-label="Command address" placeholder={hint?.addr} value={c.address ?? ""} onChange={(e) => setCmd(i, { address: e.target.value })} className={inp} />
          <input aria-label="Parameters" placeholder="Parameters, e.g. speed" value={c.params ?? ""} onChange={(e) => setCmd(i, { params: e.target.value })} className={inp} />
          <label className="flex items-center gap-1"><input type="checkbox" checked={!!c.safety} onChange={(e) => setCmd(i, { safety: e.target.checked })} />Safety-relevant (needs reason)</label>
          <button aria-label="Remove command" onClick={() => setF({ ...f, commands: f.commands.filter((_, j) => j !== i) })}><Trash2 className="h-4 w-4" /></button>
        </div>
      ))}
      <button onClick={() => setF({ ...f, commands: [...f.commands, { name: "" }] })} className="rounded-lg border border-border/60 px-3 py-1">Add command</button>
      <div className="flex items-center gap-3"><button onClick={save} className="rounded-lg bg-primary px-4 py-2 text-primary-foreground">Save</button>{msg && <span className={msg === "Saved" ? "text-success" : "text-destructive"}>{msg}</span>}</div>
    </section>
  );
}

function Readings({ m }: { m: Machine }) {
  const { data: rows = [] } = useRows<any>("machine_readings", { eq: { machine_id: m.id } });
  const w = useWrite("machine_readings");
  const [tag, setTag] = useState(m.tags[0]?.name ?? "");
  const [val, setVal] = useState("");
  const [err, setErr] = useState("");
  const send = async (payload: Record<string, unknown>[]) => {
    setErr("");
    try { for (const p of payload) await w.record.mutateAsync({ machine_id: m.id, organization_id: m.organization_id, ...p }); }
    catch (e) { setErr(errMsg(e)); }
  };
  const poll = useServerFn(pollMachine);
  const qc = useQueryClient();
  const [frames, setFrames] = useState<{ tag: string; raw: string; quality: string }[]>([]);
  const simulate = async (force = false) => {
    setErr("");
    try { const r = await poll({ data: { machineId: m.id, forceOutOfLimits: force } }); setFrames(r.frames); qc.invalidateQueries(); }
    catch (e) { setErr(errMsg(e)); }
  };
  return (
    <section className="glass-panel space-y-3 rounded-2xl p-4 text-sm">
      <h2 className="font-semibold">Readings</h2>
      <div className="flex flex-wrap gap-2">
        <select aria-label="Tag" value={tag} onChange={(e) => setTag(e.target.value)} className={inp}>{m.tags.map((t) => <option key={t.name} value={t.name}>{t.name}</option>)}</select>
        <input aria-label="Value" placeholder="Value" value={val} onChange={(e) => setVal(e.target.value)} className={`${inp} w-28`} />
        <button disabled={!tag || val === ""} onClick={() => send([{ tag, ...(isNaN(Number(val)) ? { text_value: val } : { value: Number(val) }), source: "manual" }]).then(() => setVal(""))} className="rounded-lg border border-border/60 px-3 py-1 disabled:opacity-50">Record</button>
        {m.connection_mode === "simulated" && <>
          <button disabled={!m.tags.length} onClick={() => simulate()} className="rounded-lg border border-border/60 px-3 py-1 disabled:opacity-50">Read via {protocolName(m.protocol)}</button>
          <button disabled={!m.tags.length} onClick={() => simulate(true)} className="rounded-lg border border-border/60 px-3 py-1 disabled:opacity-50" title="Mock device returns values above the max limit">Read out-of-limit test</button></>}
      </div>
      {frames.length > 0 && <div className="space-y-1 rounded-lg bg-muted/30 p-2 font-mono text-[10px]" aria-label="Wire frames">{frames.map((f, i) => <div key={i}><b>{f.tag}</b> [{f.quality}] {f.raw}</div>)}</div>}
      {!m.tags.length && <p className="text-muted-foreground">Add tags under Connection first.</p>}
      {err && <p className="text-destructive">{err}</p>}
      <div className="max-h-96 overflow-y-auto">
        <table className="w-full text-xs"><thead><tr className="text-left text-muted-foreground"><th>Time</th><th>Tag</th><th>Value</th><th>Limits</th><th>Source</th><th>By</th></tr></thead>
          <tbody>{rows.slice(0, 200).map((r) => (
            <tr key={r.id} className="border-t border-border/40"><td>{new Date(r.created_at).toLocaleString()}</td><td>{r.tag}</td><td>{r.value ?? r.text_value} {r.unit ?? ""}</td>
              <td className={r.in_limits === false ? "text-destructive" : "text-success"}>{r.in_limits == null ? "—" : r.in_limits ? "OK" : "Outside"}</td><td>{r.source}</td><td>{r.actor_name}</td></tr>
          ))}</tbody></table>
      </div>
    </section>
  );
}

function Commands({ m }: { m: Machine }) {
  const { data: rows = [] } = useRows<any>("machine_commands", { eq: { machine_id: m.id } });
  const w = useWrite("machine_commands");
  const [cmd, setCmd] = useState(m.commands[0]?.name ?? "");
  const [params, setParams] = useState("");
  const [reason, setReason] = useState("");
  const [err, setErr] = useState("");
  const def = m.commands.find((c) => c.name === cmd);
  const sendCmd = useServerFn(sendMachineCommand);
  const qc = useQueryClient();
  const send = async () => {
    setErr("");
    if (def?.safety && !reason.trim()) return setErr("This command is safety-relevant: give a reason.");
    if (!confirm(`Send "${cmd}" to ${m.name}?`)) return;
    try {
      await sendCmd({ data: { machineId: m.id, command: cmd, value: params || undefined, reason: reason || undefined } });
      qc.invalidateQueries();
      setParams(""); setReason("");
    } catch (e) { setErr(errMsg(e)); }
  };
  const mark = (id: string, status: string) => w.update.mutateAsync({ id, patch: { status, completed_at: ["acknowledged", "rejected", "failed"].includes(status) ? new Date().toISOString() : null } }).catch((e) => setErr(errMsg(e)));
  return (
    <section className="glass-panel space-y-3 rounded-2xl p-4 text-sm">
      <h2 className="font-semibold">Commands</h2>
      <div className="flex flex-wrap gap-2">
        <select aria-label="Command" value={cmd} onChange={(e) => setCmd(e.target.value)} className={inp}>{m.commands.map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}</select>
        {def?.params && <input aria-label="Command value" placeholder={def.params} value={params} onChange={(e) => setParams(e.target.value)} className={`${inp} w-28`} />}
        <input aria-label="Reason" placeholder={def?.safety ? "Reason (required)" : "Reason"} value={reason} onChange={(e) => setReason(e.target.value)} className={`${inp} flex-1`} />
        <button disabled={!cmd} onClick={send} className="rounded-lg bg-primary px-3 py-1 text-primary-foreground disabled:opacity-50">Send</button>
      </div>
      {!m.commands.length && <p className="text-muted-foreground">Add commands under Connection first.</p>}
      {m.connection_mode === "edge" && <p className="text-muted-foreground">Commands wait as "queued" until the edge box picks them up.</p>}
      {err && <p className="text-destructive">{err}</p>}
      <div className="max-h-96 overflow-y-auto">
        <table className="w-full text-xs"><thead><tr className="text-left text-muted-foreground"><th>Time</th><th>Command</th><th>Reason</th><th>Status</th><th>Device answer</th><th>By</th><th /></tr></thead>
          <tbody>{rows.slice(0, 200).map((r) => (
            <tr key={r.id} className="border-t border-border/40"><td>{new Date(r.created_at).toLocaleString()}</td><td>{r.command}{r.params?.value ? ` = ${r.params.value}` : ""}</td><td>{r.reason}</td>
              <td className={r.status === "acknowledged" ? "text-success" : ["rejected", "failed"].includes(r.status) ? "text-destructive" : "text-warning"}>{r.status}</td><td className="max-w-xs truncate font-mono text-[10px]" title={r.result ?? ""}>{r.result}</td><td>{r.actor_name}</td>
              <td>{m.connection_mode === "manual" && ["queued", "sent"].includes(r.status) && (
                <span className="flex gap-1"><button onClick={() => mark(r.id, "acknowledged")} className="underline">Done</button><button onClick={() => mark(r.id, "failed")} className="underline">Failed</button></span>)}</td></tr>
          ))}</tbody></table>
      </div>
    </section>
  );
}

function DriverPanel({ m }: { m: Machine }) {
  const test = useServerFn(testMachineConnection);
  const [r, setR] = useState<Awaited<ReturnType<typeof testMachineConnection>> | null>(null);
  const [err, setErr] = useState("");
  const d = DRIVERS[m.protocol];
  return (
    <section className="glass-panel space-y-2 rounded-2xl p-4 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold">Protocol driver · {protocolName(m.protocol)}</h2>
        <button onClick={async () => { setErr(""); try { setR(await test({ data: { machineId: m.id } })); } catch (e) { setErr(errMsg(e)); } }} className="rounded-lg border border-border/60 px-3 py-1">Test connection</button>
      </div>
      {d && <p className="text-xs text-muted-foreground">Type: {d.family} · address format <code>{d.endpointHelp}</code> · data point format <code>{d.addressHelp}</code>. {m.connection_mode === "simulated" ? "Talking to a mock device that answers like a real one." : m.connection_mode === "edge" ? "The edge box does the real I/O using the same driver settings." : "Values and command results are entered by hand."}</p>}
      {err && <p className="text-destructive">{err}</p>}
      {r && <div className="space-y-1 text-xs">
        <p className={r.ok ? "text-success" : "text-destructive"}>{r.ok ? "Connection settings valid" : "Connection settings have problems"} · {r.driver} via {r.transport}{r.handshake ? ` · ${r.handshake}` : ""}</p>
        <ul>{r.checks.map((c, i) => <li key={i} className={c.ok ? "text-muted-foreground" : "text-destructive"}>{c.ok ? "✓" : "✗"} {c.item}{c.error ? ` — ${c.error}` : ""}</li>)}</ul>
      </div>}
    </section>
  );
}
