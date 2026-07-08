import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Boxes,
  Ticket,
  Package,
  Network,
  ServerCog,
  LogOut,
  Server,
  Wrench,
  FileText,
  Activity,
  QrCode,
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
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "@tanstack/react-router";

const nav = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Asset Inventory", url: "/assets", icon: Boxes },
  { title: "Help Desk", url: "/tickets", icon: Ticket },
  { title: "Software & Licenses", url: "/software", icon: Package },
  { title: "Network", url: "/network", icon: Network },
  { title: "Servers", url: "/servers", icon: ServerCog },
  { title: "Preventive Maintenance", url: "/pm", icon: Wrench },
  { title: "Technician Mode", url: "/tech", icon: QrCode },
  { title: "Activity Feed", url: "/activity", icon: Activity },
  { title: "Reports", url: "/reports", icon: FileText },
];

export function AppSidebar({ userLabel, roleLabel }: { userLabel: string; roleLabel: string }) {
  const currentPath = useRouterState({ select: (r) => r.location.pathname });
  const navigate = useNavigate();
  const isActive = (p: string) => currentPath === p || currentPath.startsWith(p + "/");

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-3">
          <div className="h-8 w-8 rounded-md bg-primary flex items-center justify-center">
            <Server className="h-4 w-4 text-primary-foreground" />
          </div>
          <div className="flex-1 min-w-0 group-data-[collapsible=icon]:hidden">
            <div className="text-sm font-semibold truncate">Hotel IT Ops</div>
            <div className="text-[10px] text-sidebar-foreground/60 uppercase tracking-wide">Enterprise Console</div>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Operations</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {nav.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)}>
                    <Link to={item.url}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <div className="px-2 pb-2 group-data-[collapsible=icon]:hidden">
          <div className="text-sm font-medium truncate">{userLabel}</div>
          <div className="text-[11px] text-sidebar-foreground/60 truncate">{roleLabel}</div>
        </div>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={signOut}>
              <LogOut className="h-4 w-4" />
              <span>Sign out</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}