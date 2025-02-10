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
  PieChart as PieChartIcon, 
  BarChart as BarChartIcon,
  Clock,
  TrendingUp,
  DollarSign,
  InfoCircle as InfoIcon
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import {
  Tooltip as UITooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { Report } from "@shared/schema/reports";

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042'];

const MODEL_DESCRIPTIONS = {
  'claude-3-opus-20240229': 'Handles complex code and math tasks with high precision',
  'gpt-4o': 'Specialized for research and detailed analysis tasks',
  'claude-3-sonnet-20240229': 'Efficient for routine code generation and standard tasks',
  'claude-instant-1.2': 'Fast processing of basic operations and simple queries'
};

function ModelTooltip({ modelId }: { modelId: string }) {
  return (
    <TooltipProvider>
      <UITooltip>
        <TooltipTrigger>
          <InfoIcon className="h-4 w-4 ml-1" />
        </TooltipTrigger>
        <TooltipContent>
          <p>{MODEL_DESCRIPTIONS[modelId] || 'AI Model'}</p>
        </TooltipContent>
      </UITooltip>
    </TooltipProvider>
  );
}

function ReportsDashboard() {
  const { user } = useAuth();
  const [timeRange, setTimeRange] = useState("7d");
  const [reportType, setReportType] = useState("all");

  const { data: analyticsData, isLoading: isLoadingAnalytics } = useQuery({
    queryKey: ['/api/analytics', timeRange],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/analytics?timeRange=${timeRange}`);
      return response.json();
    },
  });

  const { data: modelMetrics, isLoading: isLoadingMetrics } = useQuery({
    queryKey: ['/api/metrics/models', timeRange],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/metrics/models?timeRange=${timeRange}`);
      return response.json();
    },
  });

  const { data: reports, isLoading: isLoadingReports } = useQuery({
    queryKey: ['/api/reports', reportType],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/reports?type=${reportType}`);
      return response.json();
    },
  });

  if (!user) return null;

  if (isLoadingAnalytics || isLoadingReports || isLoadingMetrics) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold">Analytics Dashboard</h1>
          <p className="text-gray-500">Monitor your legal document metrics and insights</p>
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
            Generate Report
          </Button>
        </div>
      </div>

      {/* Model Performance Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Automation Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {modelMetrics?.automationMetrics?.automationPercentage || '0%'}
            </div>
            <p className="text-xs text-muted-foreground">
              Tasks automated successfully
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Processing Time</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {modelMetrics?.automationMetrics?.processingTimeReduction || '0%'}
            </div>
            <p className="text-xs text-muted-foreground">
              Time reduction vs. baseline
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cost Savings</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {modelMetrics?.automationMetrics?.laborCostSavings || '0%'}
            </div>
            <p className="text-xs text-muted-foreground">
              Estimated cost reduction
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Error Reduction</CardTitle>
            <BarChartIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {modelMetrics?.automationMetrics?.errorReduction || '0%'}
            </div>
            <p className="text-xs text-muted-foreground">
              Error rate improvement
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="models">Model Usage</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="risks">Risk Analysis</TabsTrigger>
          <TabsTrigger value="compliance">Compliance</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Card className="col-span-2">
              <CardHeader>
                <CardTitle>Document Activity</CardTitle>
                <CardDescription>Document processing over time</CardDescription>
              </CardHeader>
              <CardContent className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={analyticsData?.documentActivity || []}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="processed"
                      stroke="#8884d8"
                      name="Processed"
                    />
                    <Line
                      type="monotone"
                      dataKey="uploaded"
                      stroke="#82ca9d"
                      name="Uploaded"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Risk Distribution</CardTitle>
                <CardDescription>Risk levels across documents</CardDescription>
              </CardHeader>
              <CardContent className="h-[300px]">
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
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Compliance Metrics</CardTitle>
                <CardDescription>Key compliance indicators</CardDescription>
              </CardHeader>
              <CardContent className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={analyticsData?.complianceMetrics || []}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="value" fill="#8884d8" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="models" className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Model Distribution</CardTitle>
                <CardDescription>Task distribution across AI models</CardDescription>
              </CardHeader>
              <CardContent className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={modelMetrics?.modelDistribution || []}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => (
                        <g>
                          <text x={0} y={0} fill="#666" textAnchor="middle">
                            {`${name} (${(percent * 100).toFixed(0)}%)`}
                          </text>
                          <ModelTooltip modelId={name} />
                        </g>
                      )}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {modelMetrics?.modelDistribution?.map((entry: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Model Performance</CardTitle>
                <CardDescription>Average processing time and error rates</CardDescription>
              </CardHeader>
              <CardContent className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={modelMetrics?.modelPerformance || []}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="model" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="avgProcessingTime" name="Avg. Processing Time (ms)" fill="#8884d8" />
                    <Bar dataKey="errorRate" name="Error Rate (%)" fill="#82ca9d" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="performance" className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Cost Efficiency</CardTitle>
                <CardDescription>Cost savings by model selection</CardDescription>
              </CardHeader>
              <CardContent className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={modelMetrics?.costEfficiency || []}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="model" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="costSavings" name="Cost Savings (%)" fill="#8884d8" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Task Success Rate</CardTitle>
                <CardDescription>Success rate by task type</CardDescription>
              </CardHeader>
              <CardContent className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={modelMetrics?.taskSuccess || []}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="taskType" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="successRate" name="Success Rate (%)" fill="#82ca9d" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default ReportsDashboard;