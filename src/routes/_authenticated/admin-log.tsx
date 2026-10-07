import { createFileRoute } from "@tanstack/react-router";
import { History } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHead } from "@/components/qp-ui";
import { useListControls } from "@/components/list-controls";

export const Route = createFileRoute("/_authenticated/admin-log")({
  head: () => ({ meta: [
    { title: "Admin activity · Cortanex MES" },
    { name: "description", content: "Who changed roles, permissions and role grants, and when." },
    { property: "og:title", content: "Admin activity · Cortanex MES" },
    { property: "og:description", content: "Permanent record of access changes." },
  ] }),
  component: AdminLog,
});

function AdminLog() {
  const { data: rows = [] } = useQuery({
    queryKey: ["admin-log"],
    queryFn: async () => {
      const { data, error } = await supabase.from("audit_entries").select("id, at, actor_name, entity, entity_id, action, summary")
        .in("entity", ["roles", "role_permissions", "user_role_grants"]).order("at", { ascending: false }).limit(2000);
      if (error) throw error;
      return data ?? [];
    },
  });
  const ls = useListControls(rows as any[], { searchKeys: ["actor_name", "entity", "entity_id", "action", "summary"], dateKey: "at", exportName: "admin-activity" });
  return (
    <div className="space-y-6">
      <PageHead back="/roles" backLabel="Roles & permissions" icon={<History className="h-5 w-5 text-primary" />} title="Admin activity"
        desc="Every change to roles, permissions and who holds which role is recorded here automatically and cannot be edited." />
      <div className="glass-panel rounded-2xl p-5">
        {ls.toolbar}
        <table className="mt-3 w-full text-xs"><thead className="text-[10px] uppercase text-muted-foreground"><tr><th className="py-1 text-left">When</th><th className="text-left">Who</th><th className="text-left">Change</th><th className="text-left">What</th></tr></thead>
          <tbody>{ls.visible.map((r: any) => <tr key={r.id} className="border-t border-border/40"><td className="py-1.5">{new Date(r.at).toLocaleString()}</td><td>{r.actor_name}</td><td className="uppercase text-[10px]">{r.action}</td><td>{r.summary}</td></tr>)}
            {ls.visible.length === 0 && <tr><td colSpan={4} className="py-6 text-center text-muted-foreground">No access changes recorded yet.</td></tr>}</tbody></table>
        {ls.pager}
      </div>
    </div>
  );
}
