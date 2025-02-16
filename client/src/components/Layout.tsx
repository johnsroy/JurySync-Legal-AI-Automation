import { Link, useLocation } from "wouter";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
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
import { ErrorBoundary } from "react-error-boundary";

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

function ErrorFallback({ error }: { error: Error }) {
  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50">
      <div className="bg-white p-8 rounded-lg shadow-lg max-w-md">
        <Shield className="h-12 w-12 text-red-500 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-center mb-2">Layout Error</h2>
        <p className="text-gray-600 text-center">{error.message}</p>
      </div>
    </div>
  );
}

export default function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { user, logoutMutation } = useAuth();

  if (!user) {
    return null;
  }

  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <div className="flex min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50">
        <motion.div
          className="fixed inset-y-0 left-0 z-50"
          variants={sidebarVariants}
          initial="hidden"
          animate="visible"
        >
          <Sidebar className="border-r border-gray-200 bg-white/80 backdrop-blur-lg">
            <SidebarHeader>
              <div className="flex items-center gap-2 p-4">
                <Shield className="h-6 w-6 text-primary" />
                <span className="font-bold text-primary">JurySync</span>
              </div>
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
                          <Link href="/dashboard" className="flex items-center gap-3 px-3 py-2 text-sm font-medium">
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
                          <Link href="/workflow-automation" className="flex items-center gap-3 px-3 py-2 text-sm font-medium">
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
                          <Link href="/contract-automation" className="flex items-center gap-3 px-3 py-2 text-sm font-medium">
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
                          isActive={location === "/legal-research"}
                        >
                          <Link href="/legal-research" className="flex items-center gap-3 px-3 py-2 text-sm font-medium">
                            <FileText className="h-5 w-5" />
                            Legal Research
                          </Link>
                        </SidebarMenuButton>
                      </TooltipTrigger>
                      <TooltipContent side="right">
                        Research legal documents
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
                          <Link href="/reports" className="flex items-center gap-3 px-3 py-2 text-sm font-medium">
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
                          <Link href="/settings" className="flex items-center gap-3 px-3 py-2 text-sm font-medium">
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

              <div className="mt-auto p-4 border-t">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div className="text-sm">
                      <p className="font-medium">{user.firstName} {user.lastName}</p>
                      <p className="text-xs text-muted-foreground">{user.email}</p>
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
                        >
                          {logoutMutation.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <LogOut className="h-4 w-4" />
                          )}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="right">
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
          className="flex-1 ml-64"
          variants={contentVariants}
          initial="hidden"
          animate="visible"
        >
          {children}
        </motion.main>
      </div>
    </ErrorBoundary>
  );
}