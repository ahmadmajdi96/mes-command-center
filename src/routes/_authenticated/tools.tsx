import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, Wrench } from "lucide-react";
import { useRows, useWrite, errMsg } from "@/lib/execution-db";
import { useMyOrg } from "@/lib/wip-db";
import { useCan } from "@/lib/access";
import { useListControls } from "@/components/list-controls";
import { toolState } from "@/lib/tools";
import { PageHead, inp, btn, ghost, lbl, th, fmt } from "@/components/qp-ui";

export const Route = createFileRoute("/_authenticated/tools")({
  head: () => ({ meta: [
    { title: "Tools · Cortanex MES" },
    { name: "description", content: "Tools and gauges with calibration dates and use limits; expired or worn tools are blocked." },
    { property: "og:title", content: "Tools · Cortanex MES" },
    { property: "og:description", content: "Track tool use per step and block expired or worn tools." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: ToolsPage,
});


function ToolsPage() {
  const { data: org } = useMyOrg();
  const canEdit = useCan("masterdata.write");
  const { data: tools = [] } = useRows<any>("tools", { order: "code", asc: true });
  const { data: usages = [] } = useRows<any>("tool_usages");
  const { data: stations = [] } = useRows<any>("stations", { order: "name", asc: true });
  const { data: ops = [] } = useRows<any>("order_operations");
  const w = useWrite("tools");
  const [f, setF] = useState({ code: "", name: "", kind: "tool", station_id: "", calibration_due: "", max_uses: "" });

  const rows = useMemo(() => tools.map((t) => ({ ...t, state: toolState(t).label, station: stations.find((s) => s.id === t.station_id)?.name ?? "" })), [tools, stations]);
  const lt = useListControls(rows, { searchKeys: ["code", "name", "kind", "station", "state"], dateKey: "created_at", exportName: "tools" });
  const urows = useMemo(() => usages.map((u) => ({ ...u, tool: tools.find((t) => t.id === u.tool_id)?.code ?? u.tool_id, step: ops.find((o) => o.id === u.order_operation_id)?.name ?? "" })), [usages, tools, ops]);
  const lu = useListControls(urows, { searchKeys: ["tool", "step", "used_by_name"], dateKey: "created_at", exportName: "tool-usage" });

  const add = async () => {
    if (!f.code.trim() || !f.name.trim()) return toast.error("Code and name are required");
    try {
      await w.insert.mutateAsync({ organization_id: org, code: f.code.trim().toUpperCase(), name: f.name.trim(), kind: f.kind, station_id: f.station_id || null,
        calibration_due: f.calibration_due || null, max_uses: f.max_uses ? Number(f.max_uses) : null });
      toast.success("Tool added"); setF({ code: "", name: "", kind: "tool", station_id: "", calibration_due: "", max_uses: "" });
    } catch (e) { toast.error(errMsg(e)); }
  };
  const setStatus = async (id: string, status: string, extra: Record<string, unknown> = {}) => {
    try { await w.update.mutateAsync({ id, patch: { status, ...extra } }); toast.success("Updated"); } catch (e) { toast.error(errMsg(e)); }
  };

  return (
    <div className="space-y-6">
      <PageHead back="/stations" backLabel="Stations" icon={<Wrench className="h-5 w-5 text-primary" />} title="Tools & gauges"
        desc="Operators record which tool they use on each step. Tools that are out of service, past calibration or at their use limit are blocked. Worn tools are reported to the maintenance portal." />
      {canEdit && (
        <div className="glass-panel grid gap-3 rounded-2xl p-5 sm:grid-cols-7">
          <label className={lbl}>Code<input className={inp} value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} placeholder="GAUGE-01" /><span>Unique code.</span></label>
          <label className={lbl}>Name<input className={inp} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Moisture meter" /><span>Shown to operators.</span></label>
          <label className={lbl}>Type<select className={inp} value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}><option value="tool">Tool</option><option value="gauge">Gauge</option><option value="fixture">Fixture</option><option value="die">Die / sieve</option></select><span>Kind of tool.</span></label>
          <label className={lbl}>Station<select className={inp} value={f.station_id} onChange={(e) => setF({ ...f, station_id: e.target.value })}><option value="">Any</option>{stations.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select><span>Where it lives.</span></label>
          <label className={lbl}>Calibration due<input className={inp} type="date" value={f.calibration_due} onChange={(e) => setF({ ...f, calibration_due: e.target.value })} /><span>Blocked after.</span></label>
          <label className={lbl}>Use limit<input className={inp} type="number" value={f.max_uses} onChange={(e) => setF({ ...f, max_uses: e.target.value })} /><span>Empty = no limit.</span></label>
          <div className="flex items-start pt-5"><button className={btn} onClick={add}><Plus className="h-3.5 w-3.5" />Add tool</button></div>
        </div>)}
      <div className="glass-panel rounded-2xl p-5">
        <h2 className="mb-2 font-semibold">Tools</h2>
        {lt.toolbar}
        <div className="mt-3 overflow-x-auto"><table className="w-full text-xs">
          <thead className="text-[10px] uppercase text-muted-foreground"><tr><th className={th}>Code</th><th className="text-left">Name</th><th className="text-left">Type</th><th className="text-left">Station</th><th className="text-left">Calibration due</th><th className="text-right">Uses</th><th className="text-left">State</th><th /></tr></thead>
          <tbody>{lt.visible.map((t) => (
            <tr key={t.id} className="border-t border-border/40">
              <td className="py-2 font-mono text-primary">{t.code}</td><td>{t.name}</td><td>{t.kind}</td><td>{t.station || "—"}</td><td>{t.calibration_due ?? "—"}</td>
              <td className="text-right">{t.uses}{t.max_uses ? ` / ${t.max_uses}` : ""}</td><td className={toolState(t).cls}>{t.state}</td>
              <td className="text-right">{canEdit && (<div className="flex justify-end gap-1">
                {t.status === "active" ? <button className={ghost} onClick={() => setStatus(t.id, "out_of_service")}>Take out of service</button>
                  : <button className={ghost} onClick={() => setStatus(t.id, "active", { uses: 0 })}>Return to service</button>}</div>)}</td>
            </tr>))}
            {lt.visible.length === 0 && <tr><td colSpan={8} className="py-6 text-center text-muted-foreground">No tools yet.</td></tr>}</tbody>
        </table></div>
        {lt.pager}
      </div>
      <div className="glass-panel rounded-2xl p-5">
        <h2 className="mb-2 font-semibold">Usage history</h2>
        {lu.toolbar}
        <div className="mt-3 overflow-x-auto"><table className="w-full text-xs">
          <thead className="text-[10px] uppercase text-muted-foreground"><tr><th className={th}>When</th><th className="text-left">Tool</th><th className="text-left">Step</th><th className="text-left">By</th></tr></thead>
          <tbody>{lu.visible.map((u) => <tr key={u.id} className="border-t border-border/40"><td className="py-2">{fmt(u.created_at)}</td><td className="font-mono">{u.tool}</td><td>{u.step || "—"}</td><td>{u.used_by_name ?? "—"}</td></tr>)}
            {lu.visible.length === 0 && <tr><td colSpan={4} className="py-6 text-center text-muted-foreground">No usage recorded.</td></tr>}</tbody>
        </table></div>
        {lu.pager}
      </div>
    </div>
  );
}
