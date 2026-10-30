import { createFileRoute, Link } from "@tanstack/react-router";
import { Factory, Cpu, Activity, HardHat, MonitorCog, ListChecks, GitBranch, Boxes, ShieldCheck, Wrench } from "lucide-react";

export const Route = createFileRoute("/_authenticated/engineering")({
  head: () => ({
    meta: [
      { title: "Engineering Portal · Cortanex MES" },
      { name: "description", content: "Configure lines, workstations, machines, operator apps, HMI runtime and change control." },
      { property: "og:title", content: "Engineering Portal · Cortanex MES" },
      { property: "og:description", content: "Engineering and configuration workspace, separate from daily operations." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: EngineeringPortal,
});

const SECTIONS = [
  {
    title: "Plant layout",
    items: [
      { title: "Production Lines", url: "/lines", icon: Factory, desc: "Create lines, set targets, plants and station flow." },
      { title: "Workstations", url: "/stations", icon: Cpu, desc: "Station setup, recipes, waste reasons and assignments." },
      { title: "Machines", url: "/machines", icon: Activity, desc: "Machine records, protocols, connection modes and safety sign-off." },
    ],
  },
  {
    title: "Floor apps",
    items: [
      { title: "Operator App Config", url: "/operator", icon: HardHat, desc: "Per-station operator app setup and preview." },
      { title: "HMI Runtime Config", url: "/hmi", icon: MonitorCog, desc: "HMI screens, variables and runtime behaviour per station." },
    ],
  },
  {
    title: "Process definition",
    items: [
      { title: "Step Templates", url: "/step-templates", icon: ListChecks, desc: "Reusable step definitions with validation." },
      { title: "Work Instructions", url: "/work-instructions", icon: ListChecks, desc: "Versioned instructions operators must confirm." },
      { title: "Routing Rules", url: "/routing-rules", icon: GitBranch, desc: "Dynamic routing and skip rules." },
    ],
  },
  {
    title: "Change management",
    items: [
      { title: "BOM & Routing Versions", url: "/master-data", icon: Boxes, desc: "Draft → approve → activate changes to masters." },
      { title: "Approvals & Signatures", url: "/approvals", icon: ShieldCheck, desc: "Sign off version changes with e-signatures." },
    ],
  },
] as const;

function EngineeringPortal() {
  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
          <Wrench className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Engineering Portal</h1>
          <p className="text-sm text-muted-foreground">Configuration and change control, kept apart from day-to-day operations.</p>
        </div>
      </div>
      {SECTIONS.map((s) => (
        <section key={s.title} className="space-y-3">
          <h2 className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">{s.title}</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {s.items.map((i) => (
              <Link key={i.url} to={i.url} className="group rounded-xl border border-border/60 bg-card/60 p-4 transition hover:border-primary/40 hover:bg-primary/5">
                <div className="flex items-center gap-2 font-medium">
                  <i.icon className="h-4 w-4 text-primary" />
                  {i.title}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{i.desc}</p>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
