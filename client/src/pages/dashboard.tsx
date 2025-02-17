import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts";
import { Clock, FileCheck, Scale, GitMerge, Shield, Book, AlertTriangle, Gavel, LogOut, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";

const metrics = [
  {
    title: "Documents Processed",
    value: "2,450",
    description: "across all modules",
    icon: FileCheck,
    color: "text-emerald-400"
  },
  {
    title: "Average Processing Time",
    value: "45s",
    description: "per document",
    icon: Clock,
    color: "text-blue-400"
  },
  {
    title: "Compliance Score",
    value: "95%",
    description: "overall rating",
    icon: Shield,
    color: "text-yellow-400"
  },
  {
    title: "Active Documents",
    value: "156",
    description: "in review",
    icon: GitMerge,
    color: "text-purple-400"
  }
];

const modules = [
  {
    id: "workflow-automation",
    title: "Workflow Automation",
    description: "End-to-end automation of legal workflows",
    icon: GitMerge,
    path: "/workflow-automation",
    gradient: "from-purple-900/50 to-blue-900/50",
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
    gradient: "from-yellow-900/50 to-emerald-900/50",
    metrics: {
      processed: 450,
      accuracy: "98%",
      timeReduced: "70%"
    }
  }
];

function MetricsCard({ title, value, description, icon: Icon, color }: any) {
  return (
    <Card className="bg-gray-900/80 backdrop-blur-lg border-gray-800">
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-300">{title}</p>
            <div className="flex items-baseline">
              <p className="text-2xl font-semibold text-white">{value}</p>
              <p className="ml-2 text-sm text-gray-400">{description}</p>
            </div>
          </div>
          <div className={`${color} bg-opacity-10 p-3 rounded-full bg-gray-800`}>
            <Icon className={`h-6 w-6 ${color}`} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
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
    <div className="p-8 space-y-8 bg-gray-900 min-h-screen">
      {/* Header */}
      <header className="bg-gray-900/80 backdrop-blur-lg border-b border-gray-800">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Gavel className="h-6 w-6 text-emerald-400" />
            <h1 className="text-xl font-semibold text-white">JurySync.io</h1>
          </div>
          <div className="flex items-center gap-4">
            {user?.subscriptionStatus === "TRIAL" && !user.trialUsed && (
              <div className="text-sm bg-yellow-900/50 text-yellow-300 px-3 py-1 rounded-full flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                Trial Active
              </div>
            )}
            <span className="text-sm text-gray-300">
              Welcome, {user?.firstName} {user?.lastName}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => logoutMutation.mutate()}
              disabled={logoutMutation.isPending}
              className="border-gray-700 text-gray-300 hover:text-white hover:bg-gray-800"
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

      {/* Main Content */}
      <div className="space-y-8">
        {/* Overview Section */}
        <div>
          <h2 className="text-3xl font-bold text-white mb-2">Legal Intelligence Dashboard</h2>
          <p className="text-gray-400">Unified view of your legal operations</p>
        </div>

        {/* Unified Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {metrics.map((metric, index) => (
            <MetricsCard key={index} {...metric} />
          ))}
        </div>

        {/* Modules Grid */}
        <div className="space-y-4">
          <h3 className="text-2xl font-bold text-white">Legal Intelligence Modules</h3>
          <div className="grid gap-6">
            {modules.map((module) => (
              <Card
                key={module.id}
                className={`bg-gradient-to-r ${module.gradient} hover:shadow-lg transition-all cursor-pointer border-gray-800`}
                onClick={() => handleModuleSelect(module)}
              >
                <CardContent className="p-8">
                  <div className="flex items-start gap-6">
                    <div className="relative">
                      <div className="absolute inset-0 bg-emerald-400/10 rounded-full scale-110 group-hover:scale-125 transition-transform" />
                      <module.icon className="h-12 w-12 text-emerald-400 relative z-10" />
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="text-2xl font-semibold text-white mb-2">{module.title}</h3>
                          <p className="text-gray-300">{module.description}</p>
                        </div>
                        <div className="grid grid-cols-3 gap-4">
                          {Object.entries(module.metrics).map(([key, value]) => (
                            <div key={key} className="text-center">
                              <p className="text-lg font-semibold text-white">{value}</p>
                              <p className="text-sm text-gray-400">{key}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}