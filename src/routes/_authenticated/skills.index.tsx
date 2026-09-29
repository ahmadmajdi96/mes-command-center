import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { GraduationCap, Plus } from "lucide-react";
import { useRows, useWrite, errMsg } from "@/lib/execution-db";
import { useMyOrg } from "@/lib/wip-db";
import { useCan } from "@/lib/access";
import { useListControls } from "@/components/list-controls";
import { PageHead, inp, btn, lbl, th } from "@/components/qp-ui";

export const Route = createFileRoute("/_authenticated/skills/")({
  head: () => ({ meta: [
    { title: "Skills & Certifications · Cortanex MES" },
    { name: "description", content: "Operator skills, certifications with expiry, and the steps that require them." },
    { property: "og:title", content: "Skills & Certifications · Cortanex MES" },
    { property: "og:description", content: "Block unqualified operators from starting steps." },
  ] }),
  component: SkillsPage,
});

export function certState(expires?: string | null) {
  if (!expires) return { label: "No expiry", cls: "text-success" };
  const days = Math.floor((new Date(expires).getTime() - Date.now()) / 86_400_000);
  if (days < 0) return { label: `Expired ${-days} d ago`, cls: "text-destructive" };
  if (days <= 30) return { label: `Expires in ${days} d`, cls: "text-warning" };
  return { label: `Valid until ${expires}`, cls: "text-success" };
}

function SkillsPage() {
  const nav = useNavigate();
  const { data: org } = useMyOrg();
  const canEdit = useCan("masterdata.write");
  const { data: skills = [] } = useRows<any>("skills", { order: "code", asc: true });
  const { data: certs = [] } = useRows<any>("operator_skills");
  const { data: reqs = [] } = useRows<any>("skill_requirements");
  const { data: people = [] } = useRows<any>("mes_users", { order: "name", asc: true });
  const w = useWrite("skills");
  const [f, setF] = useState({ code: "", name: "", validity_months: "12", description: "" });

  const skillRows = useMemo(() => skills.map((s) => ({
    ...s, holders: certs.filter((c) => c.skill_id === s.id).length,
    expired: certs.filter((c) => c.skill_id === s.id && c.expires_at && new Date(c.expires_at) < new Date()).length,
    steps: reqs.filter((r) => r.skill_id === s.id).map((r) => r.operation_name).join(", "),
  })), [skills, certs, reqs]);
  const certRows = useMemo(() => certs.map((c) => ({
    ...c, person: people.find((p) => p.id === c.mes_user_id)?.name ?? c.mes_user_id,
    skill: skills.find((s) => s.id === c.skill_id)?.name ?? "", state: certState(c.expires_at).label,
  })), [certs, people, skills]);
  const ls = useListControls(skillRows, { searchKeys: ["code", "name", "description", "steps"], dateKey: "created_at", exportName: "skills" });
  const lc = useListControls(certRows, { searchKeys: ["person", "skill", "level", "certificate_ref", "state", "certified_by_name"], dateKey: "created_at", exportName: "certifications" });

  const add = async () => {
    if (!f.code.trim() || !f.name.trim()) return toast.error("Code and name are required");
    try {
      await w.insert.mutateAsync({ organization_id: org, code: f.code.trim().toUpperCase(), name: f.name.trim(), description: f.description.trim() || null, validity_months: f.validity_months ? Number(f.validity_months) : null });
      toast.success("Skill added"); setF({ code: "", name: "", validity_months: "12", description: "" });
    } catch (e) { toast.error(errMsg(e)); }
  };

  return (
    <div className="space-y-6">
      <PageHead back="/users" backLabel="People" icon={<GraduationCap className="h-5 w-5 text-primary" />} title="Skills & certifications"
        desc="Define skills, certify operators with an expiry date, and link skills to steps. A person without a valid certificate cannot start that step." />
      {canEdit && (
        <div className="glass-panel grid gap-3 rounded-2xl p-5 sm:grid-cols-5">
          <label className={lbl}>Code<input className={inp} value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} placeholder="MILL-OP" /><span>Short unique code.</span></label>
          <label className={lbl}>Name<input className={inp} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Roller mill operator" /><span>Shown to operators.</span></label>
          <label className={lbl}>Valid for (months)<input className={inp} type="number" value={f.validity_months} onChange={(e) => setF({ ...f, validity_months: e.target.value })} /><span>Empty = never expires.</span></label>
          <label className={lbl}>Description<input className={inp} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /><span>Optional.</span></label>
          <div className="flex items-start pt-5"><button className={btn} onClick={add} disabled={w.insert.isPending}><Plus className="h-3.5 w-3.5" />Add skill</button></div>
        </div>
      )}
      <div className="glass-panel rounded-2xl p-5">
        <h2 className="mb-2 font-semibold">Skills</h2>
        {ls.toolbar}
        <div className="mt-3 overflow-x-auto"><table className="w-full text-xs">
          <thead className="text-[10px] uppercase text-muted-foreground"><tr><th className={th}>Code</th><th className="text-left">Name</th><th className="text-left">Required at steps</th><th className="text-right">Holders</th><th className="text-right">Expired</th><th className="text-left">Validity</th></tr></thead>
          <tbody>{ls.visible.map((s) => (
            <tr key={s.id} className="cursor-pointer border-t border-border/40 hover:bg-muted/30" onClick={() => nav({ to: "/skills/$skillId", params: { skillId: s.id } })}>
              <td className="py-2 font-mono text-primary">{s.code}</td><td>{s.name}</td><td>{s.steps || "—"}</td>
              <td className="text-right font-mono">{s.holders}</td><td className={`text-right font-mono ${s.expired ? "text-destructive" : ""}`}>{s.expired}</td>
              <td>{s.validity_months ? `${s.validity_months} months` : "No expiry"}</td>
            </tr>))}
            {ls.visible.length === 0 && <tr><td colSpan={6} className="py-6 text-center text-muted-foreground">No skills yet.</td></tr>}
          </tbody></table></div>
        <div className="mt-3">{ls.pager}</div>
      </div>
      <div className="glass-panel rounded-2xl p-5">
        <h2 className="mb-2 font-semibold">All certifications</h2>
        {lc.toolbar}
        <div className="mt-3 overflow-x-auto"><table className="w-full text-xs">
          <thead className="text-[10px] uppercase text-muted-foreground"><tr><th className={th}>Person</th><th className="text-left">Skill</th><th className="text-left">Level</th><th className="text-left">Certified</th><th className="text-left">Status</th><th className="text-left">Certificate</th></tr></thead>
          <tbody>{lc.visible.map((c) => (
            <tr key={c.id} className="border-t border-border/40">
              <td className="py-2"><Link to="/users/$userId" params={{ userId: c.mes_user_id }} className="text-primary">{c.person}</Link></td>
              <td><Link to="/skills/$skillId" params={{ skillId: c.skill_id }} className="hover:text-primary">{c.skill}</Link></td>
              <td>{c.level}</td><td>{c.certified_at}</td><td className={certState(c.expires_at).cls}>{c.state}</td><td>{c.certificate_ref ?? "—"}</td>
            </tr>))}
            {lc.visible.length === 0 && <tr><td colSpan={6} className="py-6 text-center text-muted-foreground">No certifications yet.</td></tr>}
          </tbody></table></div>
        <div className="mt-3">{lc.pager}</div>
      </div>
    </div>
  );
}
