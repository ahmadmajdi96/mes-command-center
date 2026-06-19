import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Factory,
  ClipboardList,
  PlayCircle,
  GitBranch,
  AlertOctagon,
  Activity,
  ShieldCheck,
  Settings,
  Boxes,
  Users,
  UserCog,
  ListChecks,
  History,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

const overview = [
  { title: "Control Center", url: "/", icon: LayoutDashboard },
  { title: "Production Lines", url: "/lines", icon: Factory },
];

const execution = [
  { title: "Work Orders", url: "/work-orders", icon: ClipboardList },
  { title: "Operator Console", url: "/execution", icon: PlayCircle },
  { title: "Step Templates", url: "/step-templates", icon: ListChecks },
  { title: "Genealogy", url: "/genealogy", icon: GitBranch },
];

const monitoring = [
  { title: "Andon / Downtime", url: "/downtime", icon: AlertOctagon },
  { title: "Telemetry", url: "/telemetry", icon: Activity },
  { title: "Quality Holds", url: "/quality", icon: ShieldCheck },
];

const workforce = [
  { title: "Users", url: "/users", icon: Users },
  { title: "Assignments", url: "/assignments", icon: UserCog },
];

const platform = [
  { title: "Master Data", url: "/master-data", icon: Boxes },
  { title: "Audit Log", url: "/audit", icon: History },
  { title: "Settings", url: "/settings", icon: Settings },
];

export function AppSidebar() {
  const path = useRouterState({ select: (r) => r.location.pathname });
  const isActive = (url: string) => (url === "/" ? path === "/" : path.startsWith(url));

  const renderGroup = (label: string, items: typeof overview) => (
    <SidebarGroup>
      <SidebarGroupLabel className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/70">
        {label}
      </SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => {
            const active = isActive(item.url);
            return (
              <SidebarMenuItem key={item.url}>
                <SidebarMenuButton
                  asChild
                  isActive={active}
                  className="data-[active=true]:bg-primary/10 data-[active=true]:text-primary data-[active=true]:border data-[active=true]:border-primary/30 rounded-lg h-10"
                >
                  <Link to={item.url} className="flex items-center gap-3">
                    <item.icon className="h-4 w-4 shrink-0" />
                    <span className="truncate">{item.title}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarHeader className="p-4">
        <Link to="/" className="flex items-center gap-2.5">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-primary to-info text-primary-foreground shadow-[var(--shadow-glow)]">
            <Factory className="h-5 w-5" />
          </div>
          <div className="flex min-w-0 flex-col leading-tight group-data-[collapsible=icon]:hidden">
            <span className="text-sm font-semibold tracking-tight">Cortanex MES</span>
            <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              Shop Floor · v1.0
            </span>
          </div>
        </Link>
      </SidebarHeader>
      <SidebarContent className="px-2">
        {renderGroup("Overview", overview)}
        {renderGroup("Execution", execution)}
        {renderGroup("Monitoring", monitoring)}
        {renderGroup("Workforce", workforce)}
        {renderGroup("Platform", platform)}
      </SidebarContent>
      <SidebarFooter className="p-3">
        <div className="rounded-xl border border-border/60 bg-card/60 p-3 group-data-[collapsible=icon]:hidden">
          <div className="flex items-center gap-2 text-xs">
            <span className="status-dot animate-pulse-glow text-success" />
            <span className="font-medium">Edge gateway online</span>
          </div>
          <p className="mt-1 text-[10px] text-muted-foreground">
            6 plants · 24 lines streaming
          </p>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
