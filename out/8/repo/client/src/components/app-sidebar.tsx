import { Link, useLocation } from "wouter";
import { CheckSquare, FileText, Eye, Settings, Shield, MessageCircle } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
} from "@/components/ui/sidebar";

const NAV_ITEMS = [
  { title: "Verify", path: "/verify", icon: CheckSquare },
  { title: "Lantern", path: "/lantern", icon: MessageCircle },
  { title: "Receipts", path: "/receipts", icon: FileText },
  { title: "Receipt Viewer", path: "/receipt-viewer", icon: Eye },
  { title: "Sensors", path: "/sensors", icon: Settings },
  { title: "Governance", path: "/governance", icon: Shield },
];

export function AppSidebar() {
  const [location] = useLocation();

  return (
    <Sidebar>
      <SidebarHeader className="p-4">
        <Link href="/">
          <span className="font-bold text-lg" data-testid="text-logo">AI Receipts</span>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV_ITEMS.map((item) => {
                const isActive = location === item.path || 
                  (item.path === "/receipt-viewer" && location.startsWith("/receipts/") && location !== "/receipts");
                
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      data-active={isActive}
                      className={isActive ? "bg-sidebar-accent" : ""}
                    >
                      <Link href={item.path} data-testid={`nav-${item.title.toLowerCase().replace(" ", "-")}`}>
                        <item.icon className="w-4 h-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
