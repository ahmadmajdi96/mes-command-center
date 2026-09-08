import { createFileRoute, Outlet, redirect, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, Search, ChevronRight, LogOut, User as UserIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: AuthedLayout,
});

function initials(name: string) {
  return name
    .split(/[\s@.]+/)
    .filter(Boolean)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function TopBar() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: profile } = useQuery({
    queryKey: ["my-profile", user.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("full_name, job_title, avatar_url")
        .eq("id", user.id)
        .maybeSingle();
      return data;
    },
  });

  const { data: roles } = useQuery({
    queryKey: ["my-roles", user.id],
    queryFn: async () => {
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
      return (data ?? []).map((r) => r.role as string);
    },
  });

  const name = profile?.full_name || user.email || "User";
  const subtitle = profile?.job_title || roles?.[0] || "Member";

  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border/60 bg-background/70 px-4 backdrop-blur-xl">
      <SidebarTrigger className="text-muted-foreground hover:text-foreground" />
      <div className="hidden items-center gap-1.5 text-xs text-muted-foreground sm:flex">
        <span>Riyadh HQ</span>
        <ChevronRight className="h-3 w-3" />
        <span className="text-foreground">Plant 01</span>
        <ChevronRight className="h-3 w-3" />
        <span>Shift A · 06:00 → 14:00</span>
      </div>
      <div className="ml-auto flex items-center gap-2">
        <div className="relative hidden md:block">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            placeholder="Search WO, lot, line…"
            className="h-9 w-64 rounded-lg border border-border/60 bg-card/60 pl-8 pr-3 text-sm placeholder:text-muted-foreground/60 focus:border-primary/50 focus:outline-none"
          />
        </div>
        <button className="relative grid h-9 w-9 place-items-center rounded-lg border border-border/60 bg-card/60 text-muted-foreground transition hover:text-foreground">
          <Bell className="h-4 w-4" />
          <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-destructive" />
        </button>
        <Link
          to="/profile"
          className="flex items-center gap-2 rounded-lg border border-border/60 bg-card/60 px-2 py-1 transition hover:border-primary/50"
        >
          {profile?.avatar_url ? (
            <img src={profile.avatar_url} alt="" className="h-6 w-6 rounded-md object-cover" />
          ) : (
            <div className="grid h-6 w-6 place-items-center rounded-md bg-gradient-to-br from-primary to-info text-[10px] font-bold text-primary-foreground">
              {initials(name)}
            </div>
          )}
          <div className="hidden text-xs leading-tight sm:block">
            <div className="font-medium">{name}</div>
            <div className="text-[10px] text-muted-foreground">{subtitle}</div>
          </div>
          <UserIcon className="h-3.5 w-3.5 text-muted-foreground sm:hidden" />
        </Link>
        <button
          onClick={handleSignOut}
          title="Sign out"
          className="grid h-9 w-9 place-items-center rounded-lg border border-border/60 bg-card/60 text-muted-foreground transition hover:text-destructive"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}

function AuthedLayout() {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <TopBar />
          <main className="flex-1 p-4 sm:p-6">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
