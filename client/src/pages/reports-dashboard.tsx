import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  Loader2, 
  FileText, 
  Clock,
  TrendingUp,
  DollarSign,
  Info,
  CalendarDays,
  AlertTriangle,
  CheckCircle,
  FileSearch
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import {
  Tooltip as UITooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { format } from "date-fns";
import type { Report } from "@shared/schema/reports";

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042'];

function RecentDocumentsSkeleton() {
  return (
    <div className="space-y-4">
      {Array(3).fill(0).map((_, i) => (
        <div key={i} className="flex items-center space-x-4 p-4 border rounded-lg">
          <Skeleton className="h-12 w-12 rounded-full" />
          <div className="space-y-2 flex-1">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

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

function RecentDocumentCard({ document, isLoading }: { 
  document: any;
  isLoading?: boolean;
}) {
  if (isLoading) {
    return <RecentDocumentsSkeleton />;
  }

  const statusColors = {
    COMPLIANT: "text-green-600 bg-green-100",
    NON_COMPLIANT: "text-red-600 bg-red-100",
    FLAGGED: "text-yellow-600 bg-yellow-100"
  };

  return (
    <div className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
      <div className="flex items-center space-x-4">
        <div className="p-2 bg-primary/10 rounded-full">
          <FileText className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h4 className="font-medium">{document.title}</h4>
          <p className="text-sm text-muted-foreground">
            Last modified {format(new Date(document.lastModified), 'MMM d, yyyy')}
          </p>
        </div>
      </div>
      <div className="flex items-center space-x-4">
        <span className={`px-2 py-1 rounded-full text-sm ${statusColors[document.status]}`}>
          {document.status}
        </span>
        <Button variant="ghost" size="sm">
          <FileSearch className="h-4 w-4" />
          View
        </Button>
      </div>
    </div>
  );
}

function ReportsDashboard() {
  const { user } = useAuth();
  const [timeRange, setTimeRange] = useState("7d");

  const { data: analyticsData, isLoading: isLoadingAnalytics } = useQuery({
    queryKey: ['/api/analytics', timeRange],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/analytics?timeRange=${timeRange}`);
      return response.json();
    },
  });

  const { data: recentDocuments, isLoading: isLoadingDocuments } = useQuery({
    queryKey: ['/api/documents/recent'],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/documents/recent");
      return response.json();
    },
  });

  if (!user) return null;

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold">Analytics Dashboard</h1>
          <p className="text-muted-foreground">
            Comprehensive overview of your legal document metrics and insights
          </p>
        </div>
        <div className="flex gap-4">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select time range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
          <Button>
            <FileText className="w-4 h-4 mr-2" />
            Export Report
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <MetricCard
          title="Processing Time"
          value={analyticsData?.automationMetrics?.processingTimeReduction || "0%"}
          description="Average time saved per document"
          icon={Clock}
          isLoading={isLoadingAnalytics}
        />
        <MetricCard
          title="Compliance Rate"
          value={`${analyticsData?.complianceRate?.toFixed(1) || 0}%`}
          description="Documents meeting compliance standards"
          icon={CheckCircle}
          isLoading={isLoadingAnalytics}
        />
        <MetricCard
          title="Risk Score"
          value={analyticsData?.averageRiskScore?.toFixed(1) || 0}
          description="Average risk assessment score"
          icon={AlertTriangle}
          isLoading={isLoadingAnalytics}
        />
        <MetricCard
          title="Document Volume"
          value={analyticsData?.totalDocuments || 0}
          description={`${analyticsData?.documentIncrease?.toFixed(1) || 0}% increase`}
          icon={TrendingUp}
          isLoading={isLoadingAnalytics}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Document Activity</CardTitle>
            <CardDescription>Processing volume over time</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px]">
            {isLoadingAnalytics ? (
              <div className="w-full h-full flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={analyticsData?.documentActivity || []}>
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
            {isLoadingAnalytics ? (
              <div className="w-full h-full flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={analyticsData?.riskDistribution || []}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {analyticsData?.riskDistribution?.map((entry: any, index: number) => (
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

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Recent Documents</CardTitle>
            <CardDescription>Latest processed documents and their status</CardDescription>
          </div>
          <Button variant="outline">View All</Button>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {isLoadingDocuments ? (
              <RecentDocumentsSkeleton />
            ) : (
              recentDocuments?.map((doc: any) => (
                <RecentDocumentCard key={doc.id} document={doc} />
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default ReportsDashboard;