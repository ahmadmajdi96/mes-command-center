import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { FileText, Printer } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { KINDS } from "@/lib/record-kinds";
import { PageHead, Field, ghost } from "@/components/qp-ui";
import { useMes } from "@/lib/mes-store";

export const Route = createFileRoute("/_authenticated/record/$kind/$id")({
  head: ({ params }) => ({
    meta: [
      { title: `${KINDS[params.kind]?.title ?? "Record"} ${params.id} · Cortanex MES` },
      { name: "description", content: "Full details, related records and change history." },
      { property: "og:title", content: `${KINDS[params.kind]?.title ?? "Record"} · Cortanex MES` },
      { property: "og:description", content: "Full details, related records and change history." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RecordPage,
});

const label = (k: string) => k.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
const show = (v: unknown) => {
  if (v == null || v === "") return "—";
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (typeof v === "object") return <pre className="whitespace-pre-wrap text-[11px]">{JSON.stringify(v, null, 2)}</pre>;
  const s = String(v);
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) return new Date(s).toLocaleString();
  return s;
};

function RecordPage() {
  const { kind, id } = Route.useParams();
  if (kind === "assignment") return <AssignmentDetail id={id} />;
  const cfg = KINDS[kind];
  const main = useQuery({
    queryKey: ["record", kind, id],
    enabled: !!cfg,
    queryFn: async () => {
      const { data, error } = await supabase.from(cfg.table as never).select("*").eq(cfg.key, id).maybeSingle();
      if (error) throw error;
      return data as Record<string, unknown> | null;
    },
  });
  if (!cfg) return <div className="p-8 text-sm text-muted-foreground">Unknown record type. <Link to="/" className="text-primary">Home</Link></div>;
  const row = main.data;
  // waste events store the reason code, not its id
  const fkValue = (r: { fk: string }) => (kind === "waste_reason" && r.fk === "reason_code" ? String(row?.code ?? "") : id);

  return (
    <div className="space-y-5">
      <PageHead back={cfg.back} backLabel={cfg.backLabel} icon={<FileText className="h-5 w-5 text-primary" />} title={`${cfg.title} ${id}`} desc="All details, linked records and history.">
        <button className={ghost} onClick={() => window.print()}><Printer className="h-3.5 w-3.5" />Print</button>
      </PageHead>
      {main.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {!main.isLoading && !row && <div className="glass-panel rounded-2xl p-6 text-sm text-muted-foreground">This record doesn't exist or you don't have access to it.</div>}
      {row && (
        <div className="glass-panel grid gap-2 rounded-2xl p-4 sm:grid-cols-2 lg:grid-cols-3">
          {Object.entries(row).filter(([k]) => !(cfg.hide ?? []).includes(k) && k !== "organization_id").map(([k, v]) => <Field key={k} l={label(k)} v={show(v)} />)}
        </div>
      )}
      {row && cfg.related.map((r) => <RelatedTable key={r.title + r.table} r={r} value={fkValue(r)} />)}
    </div>
  );
}

function RelatedTable({ r, value }: { r: { title: string; table: string; fk: string; cols: string[]; order?: string }; value: string }) {
  const q = useQuery({
    queryKey: ["record-rel", r.table, r.fk, value],
    queryFn: async () => {
      const { data, error } = await supabase.from(r.table as never).select("*").eq(r.fk, value).order(r.order ?? r.cols[0], { ascending: false }).limit(500);
      if (error) throw error;
      return (data ?? []) as Record<string, unknown>[];
    },
  });
  const rows = q.data ?? [];
  return (
    <div className="glass-panel rounded-2xl p-4">
      <h2 className="mb-2 text-sm font-semibold">{r.title} <span className="text-muted-foreground">({rows.length})</span></h2>
      <div className="overflow-x-auto"><table className="w-full text-xs">
        <thead className="text-[10px] uppercase text-muted-foreground"><tr>{r.cols.map((c) => <th key={c} className="py-2 pr-3 text-left">{label(c)}</th>)}</tr></thead>
        <tbody>
          {rows.map((x, i) => <tr key={i} className="border-t border-border/40">{r.cols.map((c) => <td key={c} className="py-2 pr-3">{show(x[c])}</td>)}</tr>)}
          {!q.isLoading && rows.length === 0 && <tr><td colSpan={r.cols.length} className="py-4 text-center text-muted-foreground">Nothing recorded.</td></tr>}
        </tbody>
      </table></div>
    </div>
  );
}

function AssignmentDetail({ id }: { id: string }) {
  const store = useMes();
  const a = store.assignments.find((x) => x.id === id);
  const u = a ? store.users.find((x) => x.id === a.userId) : undefined;
  const dt = store.downtime.filter((d) => d.assignmentId === id);
  return (
    <div className="space-y-5">
      <PageHead back="/assignments" backLabel="Assignments" icon={<FileText className="h-5 w-5 text-primary" />} title={`Assignment ${id}`} desc="Who works where, and what happened during the assignment." />
      {!a ? <div className="glass-panel rounded-2xl p-6 text-sm text-muted-foreground">Assignment not found.</div> : (
        <>
          <div className="glass-panel grid gap-2 rounded-2xl p-4 sm:grid-cols-3">
            {Object.entries(a).map(([k, v]) => <Field key={k} l={label(k)} v={show(v)} />)}
            <Field l="Person" v={u?.name} />
          </div>
          <div className="glass-panel rounded-2xl p-4 text-xs">
            <h2 className="mb-2 text-sm font-semibold">Downtime during this assignment ({dt.length})</h2>
            {dt.map((d) => <div key={d.id} className="border-t border-border/40 py-2"><Link to="/record/$kind/$id" params={{ kind: "downtime", id: d.id }} className="text-primary">{d.id}</Link> · {d.reasonCode} · {d.durationMin}m · {d.status}</div>)}
            {dt.length === 0 && <p className="text-muted-foreground">None.</p>}
          </div>
        </>
      )}
    </div>
  );
}
