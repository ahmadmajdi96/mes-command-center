import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { GraduationCap, Plus, Trash2 } from "lucide-react";
import { useRows, useWrite, errMsg } from "@/lib/execution-db";
import { useCan, useAccess } from "@/lib/access";
import { PageHead, inp, btn, ghost, lbl, th, Field, StepNames, ProductSelect } from "@/components/qp-ui";
import { certState } from "./skills.index";

export const Route = createFileRoute("/_authenticated/skills/$skillId")({
  head: () => ({ meta: [
    { title: "Skill detail · Cortanex MES" },
    { name: "description", content: "Certified operators and required steps for one skill." },
    { property: "og:title", content: "Skill detail · Cortanex MES" },
    { property: "og:description", content: "Certifications and step requirements." },
  ] }),
  component: SkillDetail,
});

const addMonths = (d: string, m: number) => { const x = new Date(d); x.setMonth(x.getMonth() + m); return x.toISOString().slice(0, 10); };

function SkillDetail() {
  const { skillId } = Route.useParams();
  const canEdit = useCan("masterdata.write");
  const me = useAccess();
  const { data: skills = [] } = useRows<any>("skills", { eq: { id: skillId } });
  const skill = skills[0];
  const { data: certs = [] } = useRows<any>("operator_skills", { eq: { skill_id: skillId } });
  const { data: reqs = [] } = useRows<any>("skill_requirements", { eq: { skill_id: skillId } });
  const { data: people = [] } = useRows<any>("mes_users", { order: "name", asc: true });
  const { data: products = [] } = useRows<any>("products");
  const wc = useWrite("operator_skills"), wr = useWrite("skill_requirements"), ws = useWrite("skills");
  const today = new Date().toISOString().slice(0, 10);
  const [c, setC] = useState({ mes_user_id: "", level: "qualified", certified_at: today, expires_at: "", certificate_ref: "" });
  const [r, setR] = useState({ operation_name: "", product_id: "" });
  if (!skill) return <div className="text-sm text-muted-foreground">Loading skill… <Link to="/skills" className="text-primary">Back to skills</Link></div>;
  const expiry = c.expires_at || (skill.validity_months ? addMonths(c.certified_at, skill.validity_months) : "");
  const t = async (fn: () => Promise<unknown>, ok: string) => { try { await fn(); toast.success(ok); } catch (e) { toast.error(errMsg(e)); } };

  return (
    <div className="space-y-6">
      <StepNames />
      <PageHead back="/skills" backLabel="Skills & certifications" icon={<GraduationCap className="h-5 w-5 text-primary" />} title={`${skill.code} · ${skill.name}`} desc={skill.description || "Skill used to qualify operators for steps."} />
      <div className="grid gap-2 sm:grid-cols-4">
        <Field l="Validity" v={skill.validity_months ? `${skill.validity_months} months` : "No expiry"} />
        <Field l="Holders" v={certs.length} />
        <Field l="Valid now" v={certs.filter((x) => !x.expires_at || new Date(x.expires_at) >= new Date(today)).length} />
        <Field l="Required at" v={reqs.length ? `${reqs.length} step rule(s)` : "Not required anywhere"} />
      </div>

      <div className="glass-panel space-y-3 rounded-2xl p-5">
        <h2 className="font-semibold">Certified operators</h2>
        {canEdit && (
          <div className="grid gap-2 sm:grid-cols-6">
            <label className={lbl}>Person<select className={inp} value={c.mes_user_id} onChange={(e) => setC({ ...c, mes_user_id: e.target.value })}><option value="">Choose…</option>{people.map((p: any) => <option key={p.id} value={p.id}>{p.name} · {p.role}</option>)}</select></label>
            <label className={lbl}>Level<select className={inp} value={c.level} onChange={(e) => setC({ ...c, level: e.target.value })}><option value="trainee">Trainee</option><option value="qualified">Qualified</option><option value="expert">Expert / trainer</option></select></label>
            <label className={lbl}>Certified on<input type="date" className={inp} value={c.certified_at} onChange={(e) => setC({ ...c, certified_at: e.target.value })} /></label>
            <label className={lbl}>Expires on<input type="date" className={inp} value={expiry} onChange={(e) => setC({ ...c, expires_at: e.target.value })} /><span>From validity unless changed.</span></label>
            <label className={lbl}>Certificate no.<input className={inp} value={c.certificate_ref} onChange={(e) => setC({ ...c, certificate_ref: e.target.value })} /></label>
            <div className="pt-5"><button className={btn} onClick={() => {
              if (!c.mes_user_id) return toast.error("Choose a person");
              t(() => wc.insert.mutateAsync({ organization_id: skill.organization_id, skill_id: skill.id, mes_user_id: c.mes_user_id, level: c.level, certified_at: c.certified_at, expires_at: expiry || null, certificate_ref: c.certificate_ref || null, certified_by_name: me.displayName || me.email }), "Operator certified");
            }}><Plus className="h-3.5 w-3.5" />Certify</button></div>
          </div>
        )}
        <table className="w-full text-xs">
          <thead className="text-[10px] uppercase text-muted-foreground"><tr><th className={th}>Person</th><th className="text-left">Level</th><th className="text-left">Certified</th><th className="text-left">Status</th><th className="text-left">Certificate</th><th className="text-left">By</th><th /></tr></thead>
          <tbody>{certs.map((x) => { const st = certState(x.expires_at); const p = people.find((y: any) => y.id === x.mes_user_id); return (
            <tr key={x.id} className="border-t border-border/40">
              <td className="py-2"><Link to="/users/$userId" params={{ userId: x.mes_user_id }} className="text-primary">{p?.name ?? x.mes_user_id}</Link></td>
              <td>{x.level}</td><td>{x.certified_at}</td><td className={st.cls}>{st.label}</td><td>{x.certificate_ref ?? "—"}</td><td>{x.certified_by_name ?? "—"}</td>
              <td className="text-right">{canEdit && <span className="flex justify-end gap-1">
                <button className={ghost} onClick={() => t(() => wc.update.mutateAsync({ id: x.id, patch: { certified_at: today, expires_at: skill.validity_months ? addMonths(today, skill.validity_months) : null } }), "Certification renewed")}>Renew</button>
                <button className={ghost} aria-label="Remove certification" onClick={() => t(() => wc.remove.mutateAsync(x.id), "Certification removed")}><Trash2 className="h-3 w-3" /></button></span>}</td>
            </tr>); })}
            {certs.length === 0 && <tr><td colSpan={7} className="py-4 text-center text-muted-foreground">Nobody holds this skill yet.</td></tr>}
          </tbody>
        </table>
      </div>

      <div className="glass-panel space-y-3 rounded-2xl p-5">
        <h2 className="font-semibold">Steps that require this skill</h2>
        {canEdit && (
          <div className="grid gap-2 sm:grid-cols-4">
            <label className={lbl}>Step name<input list="step-names" className={inp} value={r.operation_name} onChange={(e) => setR({ ...r, operation_name: e.target.value })} placeholder="Milling" /><span>Matches order steps with this name.</span></label>
            <label className={lbl}>Product<ProductSelect value={r.product_id} onChange={(v) => setR({ ...r, product_id: v })} /><span>Only for this product, or any.</span></label>
            <div className="pt-5"><button className={btn} onClick={() => {
              if (!r.operation_name.trim()) return toast.error("Enter a step name");
              t(() => wr.insert.mutateAsync({ organization_id: skill.organization_id, skill_id: skill.id, operation_name: r.operation_name.trim(), product_id: r.product_id || null }).then(() => setR({ operation_name: "", product_id: "" })), "Requirement added");
            }}><Plus className="h-3.5 w-3.5" />Require at step</button></div>
          </div>
        )}
        <ul className="space-y-1 text-xs">{reqs.map((x) => (
          <li key={x.id} className="flex items-center justify-between rounded-lg border border-border/40 px-2 py-1.5">
            <span><b>{x.operation_name}</b> · {x.product_id ? products.find((p: any) => p.id === x.product_id)?.name ?? x.product_id : "any product"}</span>
            {canEdit && <button className={ghost} aria-label="Remove requirement" onClick={() => t(() => wr.remove.mutateAsync(x.id), "Requirement removed")}><Trash2 className="h-3 w-3" /></button>}
          </li>))}
          {reqs.length === 0 && <li className="text-muted-foreground">No step requires this skill.</li>}
        </ul>
      </div>
      {canEdit && <button className={ghost} onClick={() => t(() => ws.update.mutateAsync({ id: skill.id, patch: { validity_months: skill.validity_months ? null : 12 } }), "Validity changed")}>{skill.validity_months ? "Make it never expire" : "Set 12-month validity"}</button>}
    </div>
  );
}
