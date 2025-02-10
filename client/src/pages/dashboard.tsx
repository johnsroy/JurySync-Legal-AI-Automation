import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from "recharts";
import { Clock, FileCheck, Scale, TrendingUp, Users, GitMerge } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { AlertTriangle, Gavel, LogOut, Loader2 } from "lucide-react";


const performanceData = [
  { month: 'Jan', value: 65 },
  { month: 'Feb', value: 72 },
  { month: 'Mar', value: 78 },
  { month: 'Apr', value: 82 },
  { month: 'May', value: 85 },
  { month: 'Jun', value: 88 }
];

const metrics = [
  {
    title: "Compliance Tasks Automated",
    value: "80%",
    description: "of routine tasks automated",
    icon: GitMerge,
    color: "text-green-600"
  },
  {
    title: "Processing Time Reduced",
    value: "70%",
    description: "average time savings",
    icon: Clock,
    color: "text-blue-600"
  },
  {
    title: "Documents Analyzed",
    value: "2,450",
    description: "this month",
    icon: FileCheck,
    color: "text-purple-600"
  },
  {
    title: "Compliance Score",
    value: "95%",
    description: "across all audits",
    icon: Scale,
    color: "text-yellow-600"
  }
];

export default function Dashboard() {
  const { user, logoutMutation } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const handleAgentSelect = (option: any) => { //added any type for option
    if (!user) {
      toast({
        title: "Authentication Required",
        description: "Please sign in to use this feature",
        variant: "destructive"
      });
      return;
    }

    // Check if user is in trial period or has active subscription
    if (user.subscriptionStatus === "TRIAL" && !user.trialUsed) {
      setLocation(option.path);
    } else if (user.subscriptionStatus === "ACTIVE") {
      setLocation(option.path);
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
    <div className="p-8 space-y-8">
      <header className="bg-white/80 backdrop-blur-lg border-b border-green-100">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Gavel className="h-6 w-6 text-green-600" />
            <h1 className="text-xl font-semibold">JurySync.io</h1>
          </div>
          <div className="flex items-center gap-4">
            {user?.subscriptionStatus === "TRIAL" && !user.trialUsed && (
              <div className="text-sm bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                Trial Active
              </div>
            )}
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

      <div>
        <h2 className="text-3xl font-bold text-gray-900 mb-2">Welcome to JurySync.io</h2>
        <p className="text-gray-600">Your legal compliance and automation dashboard</p>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {metrics.map((metric, index) => (
          <Card key={index} className="bg-white hover:shadow-lg transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">{metric.title}</p>
                  <div className="flex items-baseline">
                    <p className="text-2xl font-semibold">{metric.value}</p>
                    <p className="ml-2 text-sm text-gray-600">{metric.description}</p>
                  </div>
                </div>
                <div className={`${metric.color} bg-opacity-10 p-3 rounded-full`}>
                  <metric.icon className={`h-6 w-6 ${metric.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Automation Performance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={performanceData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip />
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke="#2563eb"
                    strokeWidth={2}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Document Processing Statistics</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={performanceData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="value" fill="#2563eb" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}