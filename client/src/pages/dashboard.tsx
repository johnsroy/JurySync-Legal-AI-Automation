import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from "recharts";
import { Clock, FileCheck, Shield, GitMerge, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";

// Animation variants
const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5 }
  }
};

interface MetricsCardProps {
  title: string;
  value: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}

const defaultMetrics: MetricsCardProps[] = [
  {
    title: "Documents Processed",
    value: "0",
    description: "across all modules",
    icon: FileCheck,
    color: "text-green-600"
  },
  {
    title: "Average Processing Time",
    value: "0s",
    description: "per document",
    icon: Clock,
    color: "text-blue-600"
  },
  {
    title: "Compliance Score",
    value: "0%",
    description: "overall rating",
    icon: Shield,
    color: "text-yellow-600"
  },
  {
    title: "Active Documents",
    value: "0",
    description: "in review",
    icon: GitMerge,
    color: "text-purple-600"
  }
];

function MetricsCard({ title, value, description, icon: Icon, color }: MetricsCardProps) {
  return (
    <Card className="bg-white/80 backdrop-blur-lg hover:shadow-lg transition-all duration-300">
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600">{title}</p>
            <div className="flex items-baseline mt-2">
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
  const [metrics, setMetrics] = useState(defaultMetrics);

  const { data: unifiedMetrics, isLoading, error } = useQuery({
    queryKey: ['/api/metrics/unified'],
    queryFn: async () => {
      try {
        const response = await fetch('/api/metrics/unified');
        if (!response.ok) {
          throw new Error('Failed to fetch metrics');
        }
        const data = await response.json();

        setMetrics([
          {
            ...defaultMetrics[0],
            value: data.documentsProcessed.toString()
          },
          {
            ...defaultMetrics[1],
            value: `${data.averageProcessingTime}s`
          },
          {
            ...defaultMetrics[2],
            value: `${data.complianceScore}%`
          },
          {
            ...defaultMetrics[3],
            value: data.activeDocuments.toString()
          }
        ]);

        return data;
      } catch (error) {
        console.error('Error fetching metrics:', error);
        throw error;
      }
    }
  });

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50">
      <AnimatePresence>
        <motion.div
          className="container mx-auto px-4 py-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="max-w-6xl mx-auto space-y-8">
            <motion.div
              className="text-center"
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

            {isLoading && (
              <div className="flex items-center justify-center p-8">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                >
                  <Clock className="w-8 h-8 text-blue-500" />
                </motion.div>
              </div>
            )}

            {error && (
              <motion.div
                className="bg-red-50 p-4 rounded-lg flex items-center gap-2 text-red-700"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <AlertCircle className="w-5 h-5" />
                <p>Failed to load dashboard data</p>
              </motion.div>
            )}

            {/* Activity Chart */}
            {unifiedMetrics?.activityData && (
              <motion.div
                className="mt-8"
                variants={cardVariants}
                initial="hidden"
                animate="visible"
                transition={{ delay: 0.5 }}
              >
                <Card className="bg-white/80 backdrop-blur-lg p-6">
                  <h3 className="text-lg font-semibold mb-4">Activity Overview</h3>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={unifiedMetrics.activityData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" />
                        <YAxis />
                        <RechartsTooltip />
                        <Bar dataKey="documents" fill="#4F46E5" barSize={20}/>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </Card>
              </motion.div>
            )}
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}