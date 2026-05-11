import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Wallet,
  Send,
  FileText,
  Users,
  ArrowLeftRight,
  TrendingUp,
  EyeOff,
  ShieldAlert,
  SlidersHorizontal,
  ScrollText,
  Settings as SettingsIcon,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  useSidebar,
} from "@/components/ui/sidebar";
import { LogoIcon } from "@/components/brand/LogoIcon";
import { useNetwork, type NetworkMode } from "@/store/network";

const ITEMS = [
  { title: "Overview", url: "/app/dashboard", icon: LayoutDashboard, networks: ["devnet", "mainnet"] },
  { title: "Wallet", url: "/app/wallet", icon: Wallet, networks: ["devnet", "mainnet"] },
  { title: "Payments", url: "/app/payments", icon: Send, networks: ["devnet", "mainnet"] },
  { title: "Invoices", url: "/app/invoices", icon: FileText, networks: ["mainnet"] },
  { title: "Contractors", url: "/app/contractors", icon: Users, networks: ["devnet", "mainnet"] },
  { title: "Swaps", url: "/app/swaps", icon: ArrowLeftRight, networks: ["mainnet"] },
  { title: "Yield", url: "/app/yield", icon: TrendingUp, networks: ["mainnet"] },
  { title: "Privacy", url: "/app/privacy", icon: EyeOff, networks: ["devnet", "mainnet"] },
  { title: "Risk", url: "/app/risk", icon: ShieldAlert, networks: ["devnet", "mainnet"] },
  { title: "Policies", url: "/app/policies", icon: SlidersHorizontal, networks: ["devnet", "mainnet"] },
  { title: "Audit", url: "/app/audit", icon: ScrollText, networks: ["devnet", "mainnet"] },
] as const;

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const path = useRouterState({ select: (r) => r.location.pathname });
  const network = useNetwork((s) => s.mode);
  const isActive = (url: string) => path === url || path.startsWith(url + "/");
  const visibleItems = ITEMS.filter((item) => isEnabledForNetwork(item.networks, network));

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="px-3 py-4">
        <Link to="/app/dashboard" className="flex items-center gap-2 px-1">
          <LogoIcon className="w-6 h-6 text-primary shrink-0" />
          {!collapsed && (
            <span className="text-lg font-semibold tracking-tight" style={{ letterSpacing: "-0.03em" }}>
              ArcPay
            </span>
          )}
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          {!collapsed && <SidebarGroupLabel>Treasury</SidebarGroupLabel>}
          <SidebarGroupContent>
            <SidebarMenu>
              {visibleItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)} tooltip={item.title}>
                    <Link to={item.url} className="flex items-center gap-2">
                      <item.icon className="h-4 w-4 shrink-0" />
                      {!collapsed && <span>{item.title}</span>}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          {!collapsed && <SidebarGroupLabel>Workspace</SidebarGroupLabel>}
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={isActive("/app/settings")} tooltip="Settings">
                  <Link to="/app/settings" className="flex items-center gap-2">
                    <SettingsIcon className="h-4 w-4 shrink-0" />
                    {!collapsed && <span>Settings</span>}
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}

function isEnabledForNetwork(networks: readonly NetworkMode[], current: NetworkMode) {
  return networks.includes(current);
}
