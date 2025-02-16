import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts";
import { Clock, FileCheck, Scale, GitMerge, Shield, Book, AlertTriangle, Gavel, LogOut, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Layout } from "@/components/layout";

// Updated metrics structure to include all modules
const metrics = [
  {
    title: "Documents Processed",
    value: "2,450",
    description: "across all modules",
    icon: FileCheck,
    color: "text-green-600"
  },
  {
    title: "Average Processing Time",
    value: "45s",
    description: "per document",
    icon: Clock,
    color: "text-blue-600"
  },
  {
    title: "Compliance Score",
    value: "95%",
    description: "overall rating",
    icon: Shield,
    color: "text-yellow-600"
  },
  {
    title: "Active Documents",
    value: "156",
    description: "in review",
    icon: GitMerge,
    color: "text-purple-600"
  }
];

const modules = [
  {
    id: "workflow-automation",
    title: "Workflow Automation",
    description: "End-to-end automation of legal workflows",
    icon: GitMerge,
    path: "/workflow-automation",
    gradient: "from-purple-50 to-blue-100",
    metrics: {
      processed: 320,
      efficiency: "85%",
      automated: "75%"
    }
  },
  {
    id: "contract-automation",
    title: "Contract Automation",
    description: "AI-powered contract drafting and review",
    icon: GitMerge,
    path: "/contract-automation",
    gradient: "from-yellow-50 to-green-100",
    metrics: {
      processed: 450,
      accuracy: "98%",
      timeReduced: "70%"
    }
  }
];

function MetricsCard({ title, value, description, icon: Icon, color }: any) {
  return (
    <Card className="bg-white/80 backdrop-blur-lg">
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600">{title}</p>
            <div className="flex items-baseline">
              <p className="text-2xl font-semibold">{value}</p>
              <p className="ml-2 text-sm text-gray-600">{description}</p>
            </div>
          </div>
          <div className={`${color} bg-opacity-10 p-3 rounded-full`}>
            <Icon className={`h-6 w-6 ${color}`} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function Dashboard() {
  const { user, logoutMutation } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  // Fetch unified metrics
  const { data: unifiedMetrics, isLoading: isLoadingMetrics } = useQuery({
    queryKey: ['/api/metrics/unified'],
    queryFn: async () => {
      const response = await fetch('/api/metrics/unified');
      if (!response.ok) {
        throw new Error('Failed to fetch metrics');
      }
      return response.json();
    }
  });

  const handleModuleSelect = (module: typeof modules[0]) => {
    if (!user) {
      toast({
        title: "Authentication Required",
        description: "Please sign in to use this feature",
        variant: "destructive"
      });
      return;
    }

    if (user.subscriptionStatus === "TRIAL" && !user.trialUsed) {
      setLocation(module.path);
    } else if (user.subscriptionStatus === "ACTIVE") {
      setLocation(module.path);
    } else {
      toast({
        title: "Subscription Required",
        description: "Your trial has ended. Please subscribe to continue using this feature.",
        variant: "destructive"
      });
      setLocation("/pricing");
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      <motion.div
        className="text-center mb-8"
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
      >
        <h1 className="text-3xl font-bold text-gray-900">
          Dashboard
        </h1>
        <p className="mt-2 text-gray-600">
          Overview of your legal document activities
        </p>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Add your dashboard cards here */}
      </div>
    </motion.div>
  );
}

Dashboard.getLayout = function getLayout(page: React.ReactElement) {
  return <Layout>{page}</Layout>;
};

export default Dashboard;