import { Link, useLocation } from "wouter";
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
import { motion, AnimatePresence } from "framer-motion";
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

  const menuItems = [
    {
      href: "/dashboard",
      icon: BarChart2,
      label: "Dashboard",
      tooltip: "View analytics and insights"
    },
    {
      href: "/workflow-automation",
      icon: Workflow,
      label: "Workflow Automation",
      tooltip: "Automate document workflows"
    },
    {
      href: "/contract-automation",
      icon: Scale,
      label: "Contract Automation",
      tooltip: "Automate contract processing"
    },
    {
      href: "/vault",
      icon: Shield,
      label: "JuryVault",
      tooltip: "Secure document storage"
    },
    {
      href: "/reports",
      icon: History,
      label: "History & Reports",
      tooltip: "View historical data and reports"
    },
    {
      href: "/settings",
      icon: Settings,
      label: "Settings",
      tooltip: "Manage your preferences"
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50">
      <div className="relative">
        <motion.div
          className="fixed inset-y-0 left-0 z-50 w-64 bg-white/80 backdrop-blur-lg border-r border-gray-200"
          variants={sidebarVariants}
          initial="hidden"
          animate="visible"
        >
          <div className="flex flex-col h-full">
            <div className="p-4">
              <motion.div 
                className="flex items-center gap-2"
                whileHover="hover"
                initial="initial"
                variants={logoVariants}
              >
                <Shield className="h-6 w-6 text-primary" />
                <span className="font-bold text-primary">JurySync</span>
              </motion.div>
            </div>

            <nav className="flex-1 px-2 space-y-1">
              <TooltipProvider>
                {menuItems.map((item) => (
                  <Tooltip key={item.href}>
                    <TooltipTrigger asChild>
                      <Link href={item.href}>
                        <Button
                          variant={location === item.href ? "secondary" : "ghost"}
                          className="w-full justify-start gap-3"
                        >
                          <item.icon className="h-5 w-5" />
                          {item.label}
                        </Button>
                      </Link>
                    </TooltipTrigger>
                    <TooltipContent side="right">
                      {item.tooltip}
                    </TooltipContent>
                  </Tooltip>
                ))}
              </TooltipProvider>
            </nav>

            <div className="p-4 border-t">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="text-sm">
                    <p className="font-medium">{user?.firstName} {user?.lastName}</p>
                    <p className="text-xs text-muted-foreground">{user?.email}</p>
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
                    <TooltipContent side="left">
                      Sign out
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </div>
          </div>
        </motion.div>

        <motion.main 
          className="ml-64"
          variants={contentVariants}
          initial="hidden"
          animate="visible"
        >
          <div className="container mx-auto p-6">
            {children}
          </div>
        </motion.main>
      </div>
    </div>
  );
}