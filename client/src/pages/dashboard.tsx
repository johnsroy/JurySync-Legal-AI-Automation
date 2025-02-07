import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Gavel, LogOut, Loader2, GitCompare, Shield, Book, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const agentOptions = [
  {
    id: "contract-automation",
    title: "Contract Automation",
    description: "Draft, review, and manage legal contracts with AI assistance",
    icon: GitCompare,
    path: "/contract-automation",
    gradient: "from-yellow-50 to-green-100"
  },
  {
    id: "compliance-auditing",
    title: "Compliance Auditing",
    description: "Scan and audit documents for regulatory compliance",
    icon: Shield,
    path: "/compliance-auditing",
    gradient: "from-green-50 to-yellow-100"
  },
  {
    id: "legal-research",
    title: "Legal Research",
    description: "Analyze legal databases and summarize case law",
    icon: Book,
    path: "/legal-research",
    gradient: "from-yellow-50 to-green-100"
  }
];

export default function Dashboard() {
  const { user, logoutMutation } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const handleAgentSelect = (option: typeof agentOptions[0]) => {
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
    <div className="min-h-screen bg-gradient-to-br from-yellow-50 to-green-50 animate-gradient-x">
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

      <main className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-4">What would you like to do today?</h2>
          <p className="text-gray-600 text-center mb-12">
            Choose an AI agent to assist you with your legal tasks
          </p>

          <div className="grid gap-6">
            {agentOptions.map((option) => (
              <Card 
                key={option.id} 
                className={`bg-gradient-to-r ${option.gradient} hover:shadow-lg transition-all cursor-pointer group overflow-hidden relative`}
                onClick={() => handleAgentSelect(option)}
              >
                <CardContent className="p-8">
                  <div className="flex items-start gap-6">
                    <div className="relative">
                      <div className="absolute inset-0 bg-green-500/10 rounded-full scale-110 group-hover:scale-125 transition-transform"></div>
                      <option.icon className="h-12 w-12 text-green-600 relative z-10" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-2xl font-semibold mb-2">{option.title}</h3>
                      <p className="text-gray-600">{option.description}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}