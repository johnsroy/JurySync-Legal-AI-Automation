import { Link, useLocation } from "wouter";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarProvider,
} from "@/components/ui/sidebar";
import { 
  LayoutDashboard, 
  FileText, 
  History, 
  Settings,
  Shield,
  LogOut,
  Loader2,
  Workflow,
  Vault
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";

export default function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { user, logoutMutation } = useAuth();

  return (
    <SidebarProvider defaultOpen>
      <div className="flex min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
        <Sidebar>
          <SidebarHeader>
            <div className="flex items-center gap-2 px-4 py-2">
              <Shield className="h-6 w-6 text-primary" />
              <span className="font-semibold text-primary">LexAutomation</span>
            </div>
          </SidebarHeader>
          <SidebarContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={location === "/dashboard"}
                  tooltip="Dashboard"
                >
                  <Link href="/dashboard" className="flex items-center">
                    <LayoutDashboard className="mr-2" />
                    Dashboard
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>

              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={location === "/workflow-automation"}
                  tooltip="Workflow Automation"
                >
                  <Link href="/workflow-automation" className="flex items-center">
                    <Workflow className="mr-2" />
                    Workflow Automation
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>

              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={location === "/contract-automation"}
                  tooltip="Contract Automation"
                >
                  <Link href="/contract-automation" className="flex items-center">
                    <FileText className="mr-2" />
                    Contract Automation
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>

              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={location === "/vault"}
                  tooltip="JuryVault"
                >
                  <Link href="/vault" className="flex items-center">
                    <Vault className="mr-2" />
                    JuryVault
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>

              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={location === "/reports"}
                  tooltip="History & Reports"
                >
                  <Link href="/reports" className="flex items-center">
                    <History className="mr-2" />
                    History & Reports
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>

              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={location === "/settings"}
                  tooltip="Settings"
                >
                  <Link href="/settings" className="flex items-center">
                    <Settings className="mr-2" />
                    Settings
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>

            <div className="mt-auto p-4 border-t">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="text-sm">
                    <p className="font-medium">{user?.firstName} {user?.lastName}</p>
                    <p className="text-xs text-muted-foreground">{user?.email}</p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => logoutMutation.mutate()}
                  disabled={logoutMutation.isPending}
                >
                  {logoutMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <LogOut className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          </SidebarContent>
        </Sidebar>
        <main className="flex-1 overflow-auto">
          <div className="container mx-auto p-6">
            {children}
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}