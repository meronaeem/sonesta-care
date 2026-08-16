import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { useAuth, type AppRole } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  component: AuthedLayout,
});

const ROLE_LABELS: Record<AppRole, string> = {
  administrator: "Administrator",
  it_manager: "IT Manager",
  it_supervisor: "IT Supervisor",
  it_engineer: "IT Engineer",
  helpdesk: "Helpdesk",
  department_manager: "Department Manager",
  employee: "Employee",
  read_only: "Read Only",
};

function AuthedLayout() {
  const navigate = useNavigate();
  const { user, profile, primaryRole, loading } = useAuth();

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth", replace: true });
  }, [loading, user, navigate]);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") navigate({ to: "/auth", replace: true });
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate]);

  if (loading || !user) {
    return <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">Loading…</div>;
  }

  const userLabel = profile?.full_name || profile?.email || user.email || "User";
  const roleLabel = primaryRole ? ROLE_LABELS[primaryRole] : "Employee";

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar userLabel={userLabel} roleLabel={roleLabel} />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center gap-3 border-b bg-card px-4 sticky top-0 z-10">
            <SidebarTrigger />
            <div className="flex-1" />
            <div className="text-sm text-muted-foreground hidden md:block">
              Signed in as <span className="text-foreground font-medium">{userLabel}</span>
            </div>
          </header>
          <main className="flex-1 p-4 md:p-6">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}