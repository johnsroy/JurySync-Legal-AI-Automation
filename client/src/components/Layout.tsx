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
  Scale,
  BarChart2
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

// Animation variants
const sidebarVariants = {
  hidden: { x: -20, opacity: 0 },
  visible: {
    x: 0,
    opacity: 1,
    transition: { duration: 0.3 }
  }
};

const contentVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: 0.5, delay: 0.2 }
  }
};

const logoVariants = {
  initial: { scale: 1, rotate: 0 },
  hover: { 
    scale: 1.1, 
    rotate: 360, 
    transition: { duration: 0.6 } 
  }
};

export default function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { user, logoutMutation } = useAuth();

  return (
    <SidebarProvider defaultOpen>
      <div className="flex min-h-screen bg-background dark">
        <motion.div
          className="fixed inset-y-0 left-0 z-50"
          variants={sidebarVariants}
          initial="hidden"
          animate="visible"
        >
          <Sidebar className="border-r border-sidebar-border bg-sidebar backdrop-blur-lg">
            <SidebarHeader>
              <motion.div 
                className="flex items-center gap-2 p-4"
                whileHover="hover"
                initial="initial"
                variants={logoVariants}
              >
                <Shield className="h-6 w-6 text-sidebar-primary" />
                <span className="font-bold text-sidebar-primary-foreground">JurySync</span>
              </motion.div>
            </SidebarHeader>

            <SidebarContent>
              <SidebarMenu>
                <TooltipProvider>
                  <SidebarMenuItem>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <SidebarMenuButton
                          asChild
                          isActive={location === "/dashboard"}
                        >
                          <Link href="/dashboard" className="flex items-center gap-3 px-3 py-2 text-sm font-medium text-sidebar-foreground hover:text-sidebar-primary-foreground">
                            <BarChart2 className="h-5 w-5" />
                            Dashboard
                          </Link>
                        </SidebarMenuButton>
                      </TooltipTrigger>
                      <TooltipContent side="right">
                        View analytics and insights
                      </TooltipContent>
                    </Tooltip>
                  </SidebarMenuItem>

                  <SidebarMenuItem>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <SidebarMenuButton
                          asChild
                          isActive={location === "/workflow-automation"}
                        >
                          <Link href="/workflow-automation" className="flex items-center gap-3 px-3 py-2 text-sm font-medium text-sidebar-foreground hover:text-sidebar-primary-foreground">
                            <Workflow className="h-5 w-5" />
                            Workflow Automation
                          </Link>
                        </SidebarMenuButton>
                      </TooltipTrigger>
                      <TooltipContent side="right">
                        Automate document workflows
                      </TooltipContent>
                    </Tooltip>
                  </SidebarMenuItem>

                  <SidebarMenuItem>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <SidebarMenuButton
                          asChild
                          isActive={location === "/contract-automation"}
                        >
                          <Link href="/contract-automation" className="flex items-center gap-3 px-3 py-2 text-sm font-medium text-sidebar-foreground hover:text-sidebar-primary-foreground">
                            <Scale className="h-5 w-5" />
                            Contract Automation
                          </Link>
                        </SidebarMenuButton>
                      </TooltipTrigger>
                      <TooltipContent side="right">
                        Automate contract processing
                      </TooltipContent>
                    </Tooltip>
                  </SidebarMenuItem>

                  <SidebarMenuItem>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <SidebarMenuButton
                          asChild
                          isActive={location === "/vault"}
                        >
                          <Link href="/vault" className="flex items-center gap-3 px-3 py-2 text-sm font-medium text-sidebar-foreground hover:text-sidebar-primary-foreground">
                            <Shield className="h-5 w-5" />
                            JuryVault
                          </Link>
                        </SidebarMenuButton>
                      </TooltipTrigger>
                      <TooltipContent side="right">
                        Secure document storage
                      </TooltipContent>
                    </Tooltip>
                  </SidebarMenuItem>

                  <SidebarMenuItem>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <SidebarMenuButton
                          asChild
                          isActive={location === "/reports"}
                        >
                          <Link href="/reports" className="flex items-center gap-3 px-3 py-2 text-sm font-medium text-sidebar-foreground hover:text-sidebar-primary-foreground">
                            <History className="h-5 w-5" />
                            History & Reports
                          </Link>
                        </SidebarMenuButton>
                      </TooltipTrigger>
                      <TooltipContent side="right">
                        View historical data and reports
                      </TooltipContent>
                    </Tooltip>
                  </SidebarMenuItem>

                  <SidebarMenuItem>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <SidebarMenuButton
                          asChild
                          isActive={location === "/settings"}
                        >
                          <Link href="/settings" className="flex items-center gap-3 px-3 py-2 text-sm font-medium text-sidebar-foreground hover:text-sidebar-primary-foreground">
                            <Settings className="h-5 w-5" />
                            Settings
                          </Link>
                        </SidebarMenuButton>
                      </TooltipTrigger>
                      <TooltipContent side="right">
                        Manage your preferences
                      </TooltipContent>
                    </Tooltip>
                  </SidebarMenuItem>
                </TooltipProvider>
              </SidebarMenu>

              <div className="mt-auto p-4 border-t border-sidebar-border">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div className="text-sm">
                      <p className="font-medium text-sidebar-foreground">{user?.firstName} {user?.lastName}</p>
                      <p className="text-xs text-sidebar-accent-foreground">{user?.email}</p>
                    </div>
                  </div>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => logoutMutation.mutate()}
                          disabled={logoutMutation.isPending}
                          className="text-sidebar-foreground hover:text-sidebar-primary-foreground"
                        >
                          {logoutMutation.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <LogOut className="h-4 w-4" />
                          )}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="left">
                        Sign out
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </div>
            </SidebarContent>
          </Sidebar>
        </motion.div>

        <motion.main 
          className="flex-1 ml-64 overflow-auto bg-background"
          variants={contentVariants}
          initial="hidden"
          animate="visible"
        >
          <div className="container mx-auto p-6">
            {children}
          </div>
        </motion.main>
      </div>
    </SidebarProvider>
  );
}