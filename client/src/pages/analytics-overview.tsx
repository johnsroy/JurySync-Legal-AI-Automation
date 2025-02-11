import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  ArrowLeft,
  Clock,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042'];

function MetricCard({ title, value, description, icon: Icon, isLoading }: {
  title: string;
  value: string | number;
  description: string;
  icon: any;
  isLoading?: boolean;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-7 w-1/2" />
        ) : (
          <>
            <div className="text-2xl font-bold">{value}</div>
            <p className="text-xs text-muted-foreground">
              {description}
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export function AnalyticsOverview() {
  const [, navigate] = useLocation();

  const { data: analytics, isLoading } = useQuery({
    queryKey: ['/api/analytics'],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/analytics");
      return response.json();
    },
  });

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center gap-4 mb-8">
        <Button variant="ghost" onClick={() => navigate("/reports")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Analytics Overview</h1>
          <p className="text-muted-foreground">
            Comprehensive overview of your legal document metrics and insights
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <MetricCard
          title="Processing Time"
          value={analytics?.automationMetrics?.processingTimeReduction || "0%"}
          description="Average time saved per document"
          icon={Clock}
          isLoading={isLoading}
        />
        <MetricCard
          title="Compliance Rate"
          value={`${analytics?.complianceRate?.toFixed(1) || 0}%`}
          description="Documents meeting compliance standards"
          icon={CheckCircle}
          isLoading={isLoading}
        />
        <MetricCard
          title="Risk Score"
          value={analytics?.averageRiskScore?.toFixed(1) || 0}
          description="Average risk assessment score"
          icon={AlertTriangle}
          isLoading={isLoading}
        />
        <MetricCard
          title="Document Volume"
          value={analytics?.totalDocuments || 0}
          description={`${analytics?.documentIncrease?.toFixed(1) || 0}% increase`}
          icon={TrendingUp}
          isLoading={isLoading}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Document Activity</CardTitle>
            <CardDescription>Processing volume over time</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px]">
            {isLoading ? (
              <div className="w-full h-full flex items-center justify-center">
                <Skeleton className="h-full w-full" />
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={analytics?.documentActivity || []}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="processed" stroke="#8884d8" name="Processed" />
                  <Line type="monotone" dataKey="uploaded" stroke="#82ca9d" name="Uploaded" />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Risk Distribution</CardTitle>
            <CardDescription>Risk levels across documents</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px]">
            {isLoading ? (
              <div className="w-full h-full flex items-center justify-center">
                <Skeleton className="h-full w-full" />
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={analytics?.riskDistribution || []}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {analytics?.riskDistribution?.map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default AnalyticsOverview;
