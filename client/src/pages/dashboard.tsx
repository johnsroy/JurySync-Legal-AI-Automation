import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts";
import { Clock, FileCheck, Scale, GitMerge, Shield, Book, AlertTriangle, Gavel, LogOut, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";

// Animation variants
const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5 }
  }
};

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

export default function Dashboard() {
  const { user } = useAuth();
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50">
      <main className="container mx-auto px-4 py-8">
        <motion.div
          className="max-w-6xl mx-auto space-y-6"
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
              Legal Intelligence Dashboard
            </h1>
            <p className="mt-2 text-gray-600">
              Welcome back, {user?.firstName} {user?.lastName}
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {metrics.map((metric, index) => (
              <motion.div
                key={index}
                variants={cardVariants}
                initial="hidden"
                animate="visible"
                transition={{ delay: index * 0.1 }}
              >
                <MetricsCard {...metric} />
              </motion.div>
            ))}
          </div>

          {/* Add more dashboard content here */}
        </motion.div>
      </main>
    </div>
  );
}