import { useState } from "react";
import { Link } from "wouter";
import { 
  BarChart2, FileText, Scale, Shield, History, Terminal, 
  Briefcase, LogOut, Loader2 
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { motion } from "framer-motion";

export function Layout({ children }: { children: React.ReactNode }) {
  const { user, logoutMutation } = useAuth();
  const [isLogoHovered, setIsLogoHovered] = useState(false);

  const logoVariants = {
    initial: { scale: 1, rotate: 0 },
    hover: { scale: 1.1, rotate: 360, transition: { duration: 0.6 } }
  };

  const textVariants = {
    initial: { x: 0, opacity: 1 },
    hover: { x: 10, opacity: 0.8, transition: { duration: 0.3 } }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50">
      <header className="bg-white/80 backdrop-blur-lg border-b border-indigo-100">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link href="/dashboard" className="flex items-center space-x-4 hover:text-indigo-600">
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-indigo-600 text-white">
                <Briefcase className="h-5 w-5" />
              </div>
              <h1 className="text-xl font-semibold">JurySync</h1>
            </Link>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">
              Welcome, {user?.firstName} {user?.lastName}
            </span>
            <Button
              variant="outline"
              size="sm"
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
      </header>

      <div className="fixed top-0 left-0 h-full w-64 bg-white border-r border-gray-200 z-10 pt-16">
        <motion.div
          className="flex items-center gap-2 p-4 mb-6 cursor-pointer"
          onHoverStart={() => setIsLogoHovered(true)}
          onHoverEnd={() => setIsLogoHovered(false)}
        >
          <motion.div
            variants={logoVariants}
            initial="initial"
            animate={isLogoHovered ? "hover" : "initial"}
          >
            <Shield className="h-6 w-6 text-primary" />
          </motion.div>
          <motion.span
            className="text-xl font-bold"
            variants={textVariants}
            initial="initial"
            animate={isLogoHovered ? "hover" : "initial"}
          >
            JurySync
          </motion.span>
        </motion.div>

        <nav className="space-y-1 px-2">
          <Link href="/dashboard">
            <a className="flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md hover:bg-gray-50">
              <BarChart2 className="h-5 w-5 text-gray-400" />
              Dashboard
            </a>
          </Link>
          
          <Link href="/workflow-automation">
            <a className="flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md hover:bg-gray-50">
              <FileText className="h-5 w-5 text-gray-400" />
              Workflow Automation
            </a>
          </Link>
          
          <Link href="/contract-automation">
            <a className="flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md hover:bg-gray-50">
              <Scale className="h-5 w-5 text-gray-400" />
              Contract Automation
            </a>
          </Link>
          
          <Link href="/vault">
            <a className="flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md hover:bg-gray-50">
              <Shield className="h-5 w-5 text-gray-400" />
              JuryVault
            </a>
          </Link>

          <Link href="/history-reports">
            <a className="flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md hover:bg-gray-50">
              <History className="h-5 w-5 text-gray-400" />
              History & Reports
            </a>
          </Link>

          <Link href="/settings">
            <a className="flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md hover:bg-gray-50">
              <Terminal className="h-5 w-5 text-gray-400" />
              Settings
            </a>
          </Link>
        </nav>
      </div>
      
      <div className="ml-64 pt-16">
        <main className="container mx-auto px-4 py-8">
          <motion.div
            className="max-w-6xl mx-auto space-y-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
          >
            {children}
          </motion.div>
        </main>
      </div>
    </div>
  );
} 