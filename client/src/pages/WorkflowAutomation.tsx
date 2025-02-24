import { useState } from "react";
import { Link, useLocation } from "wouter";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useDropzone } from "react-dropzone";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  apiRequest,
  type TaskData as OriginalTaskData,
} from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import {
  BookCheck,
  Scale,
  FileText,
  History,
  Upload,
  RefreshCcw,
  Download,
  AlertCircle,
  CheckCircle2,
  Clock,
  Users,
  BrainCircuit,
  ChartBar,
  FileCheck,
  BadgeCheck,
  AlertTriangle,
  ChevronDown,
  FileDown,
  Gavel,
} from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
} from "recharts";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// Modified TaskData interface to include documentAnalysis
interface TaskData extends OriginalTaskData {
  documentAnalysis?: DocumentAnalysis;
}

interface ErrorLog {
  timestamp: string;
  stage: string;
  message: string;
  details?: string;
}

interface DocumentAnalysis {
  documentType: string;
  industry: string;
  complianceStatus: {
    status: "PASSED" | "FAILED" | "PENDING";
    details: string;
    lastChecked: string;
  };
}
export default function WorkflowAutomation() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [processingResults, setProcessingResults] =
    useState<ProcessingResults | null>(null);
  const { toast } = useToast();
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  // Protect the route
  if (!user) {
    console.log("No user found, redirecting to login");
    setLocation("/login");
    return null;
  }

  // Workflow stages definition
  const workflowStages = [
    { id: "draft", name: "Draft Generation", icon: FileText },
    { id: "compliance", name: "Compliance Check", icon: Scale },
    { id: "research", name: "Legal Research", icon: BookCheck },
    { id: "approval", name: "Approval Process", icon: BadgeCheck },
    { id: "audit", name: "Final Audit", icon: History },
  ];

  // Document upload handler
  const onDrop = async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;

    setIsProcessing(true);
    const formData = new FormData();
    formData.append("document", acceptedFiles[0]);

    try {
      const response = await fetch("/api/workflow-automation/process", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Processing failed");
      }

      const result = await response.json();

      if (result.success) {
        setProcessingResults({
          documentAnalysis: result.result.documentAnalysis,
          complianceChecks: result.result.complianceChecks,
          enhancedDraft: result.result.enhancedDraft,
          approvalStatus: result.result.approvalStatus,
          auditReport: result.result.auditReport,
        });
      } else {
        throw new Error(result.error || "Processing failed");
      }
    } catch (error) {
      console.error("Document processing error:", error);
      setError(error instanceof Error ? error.message : "Processing failed");
    } finally {
      setIsProcessing(false);
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop });

  // Task progress query
  const { data: taskData } = useQuery<TaskData>({
    queryKey: ["/api/orchestrator/tasks", activeTaskId],
    enabled: !!activeTaskId,
    refetchInterval: 2000,
  });

  // Retry mutation
  const retryMutation = useMutation({
    mutationFn: async (stageId?: string) => {
      if (!activeTaskId) return;
      await apiRequest(
        "POST",
        `/api/orchestrator/tasks/${activeTaskId}/retry`,
        { stageId },
      );
      await queryClient.invalidateQueries({
        queryKey: ["/api/orchestrator/tasks", activeTaskId],
      });
    },
  });

  // Download handlers
  const handleDownloadPDF = async () => {
    try {
      const response = await fetch(
        `/api/orchestrator/tasks/${activeTaskId}/report?format=pdf`,
      );
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `workflow-report-${activeTaskId}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error("PDF download failed:", error);
      toast({
        title: "Download Failed",
        description: "Failed to download PDF report",
        variant: "destructive",
      });
    }
  };

  const handleDownloadCSV = async () => {
    try {
      const response = await fetch(
        `/api/orchestrator/tasks/${activeTaskId}/report?format=csv`,
      );
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `workflow-metrics-${activeTaskId}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error("CSV download failed:", error);
      toast({
        title: "Download Failed",
        description: "Failed to download CSV report",
        variant: "destructive",
      });
    }
  };

  // Get current stage based on progress
  const getCurrentStage = (progress: number) => {
    if (progress <= 20) return 0;
    if (progress <= 40) return 1;
    if (progress <= 60) return 2;
    if (progress <= 80) return 3;
    return 4;
  };

  // Sample metrics data
  const metricsData = [
    {
      name: "Tasks Automated",
      value: 80,
      label: "80% of routine tasks automated",
    },
    { name: "Processing Speed", value: 70, label: "70% faster processing" },
    { name: "Cost Savings", value: 40, label: "40% labor cost savings" },
    { name: "Error Reduction", value: 60, label: "60% error reduction" },
  ];

  // Sample timeline data
  const timelineData = [
    { name: "Week 1", tasks: 45, time: 120 },
    { name: "Week 2", tasks: 52, time: 110 },
    { name: "Week 3", tasks: 48, time: 90 },
    { name: "Week 4", tasks: 60, time: 85 },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 text-white">
      {/* Header Section - Matched with Dashboard */}
      <header className="border-b border-gray-800 bg-gray-900/80 backdrop-blur-lg">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center gap-3 mb-2">
            <BrainCircuit className="h-8 w-8 text-emerald-400" />
            <h1 className="text-3xl font-bold">Document Workflow Automation</h1>
          </div>
          <p className="text-gray-400">
            Streamline your legal document processing with AI-powered automation
          </p>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="container mx-auto px-4 py-8">
        {/* Document Upload Section */}
        <Card className="mb-8 bg-gray-800/50 border-gray-700">
          <CardHeader>
            <CardTitle className="text-2xl">Document Upload</CardTitle>
            <CardDescription>
              Upload your legal documents for automated processing
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div
              {...getRootProps()}
              className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all duration-300
                ${isDragActive ? "border-emerald-400 bg-emerald-400/10 scale-102" : "border-gray-600 hover:border-emerald-400/50"}`}
            >
              <input {...getInputProps()} />
              <Upload
                className={`h-16 w-16 mx-auto mb-6 ${isDragActive ? "text-emerald-400" : "text-gray-400"} transition-transform duration-300 ${isDragActive ? "scale-110" : ""}`}
              />
              <h3 className="text-xl font-semibold mb-3">
                {isDragActive
                  ? "Drop your documents here"
                  : "Upload Legal Documents"}
              </h3>
              <p className="text-gray-400 mb-4">
                Drag & drop your documents here or click to select files
              </p>
              <div className="flex justify-center gap-4 text-sm text-gray-500">
                <span>PDF</span>
                <span>DOCX</span>
                <span>TXT</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Analysis Results Section */}
        {analysisResults && (
          <Card className="mb-8 bg-gray-800/50 border-gray-700">
            <CardHeader>
              <div className="flex items-center gap-2">
                <FileCheck className="h-6 w-6 text-emerald-400" />
                <CardTitle>Document Analysis Results</CardTitle>
              </div>
              <CardDescription>
                Automated analysis of your uploaded documents
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-gray-300">Document</TableHead>
                    <TableHead className="text-gray-300">Type</TableHead>
                    <TableHead className="text-gray-300">Industry</TableHead>
                    <TableHead className="text-gray-300">Status</TableHead>
                    <TableHead className="text-gray-300">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="text-gray-300">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-blue-400" />
                        Document
                      </div>
                    </TableCell>
                    <TableCell className="text-gray-300">
                      {analysisResults.documentType}
                    </TableCell>
                    <TableCell className="text-gray-300">
                      {analysisResults.industry}
                    </TableCell>
                    <TableCell>
                      <span
                        className={`px-2 py-1 rounded-full text-xs flex items-center gap-1 w-fit ${
                          analysisResults.complianceStatus.status === "PASSED"
                            ? "bg-emerald-500/20 text-emerald-400"
                            : "bg-red-500/20 text-red-400"
                        }`}
                      >
                        {analysisResults.complianceStatus.status ===
                        "PASSED" ? (
                          <>
                            <CheckCircle2 className="h-3 w-3" />
                            Compliant
                          </>
                        ) : (
                          <>
                            <AlertCircle className="h-3 w-3" />
                            Non-Compliant
                          </>
                        )}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-gray-400 hover:text-gray-300"
                      >
                        <FileDown className="h-4 w-4 mr-1" />
                        Download Report
                      </Button>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* Workflow Progress Section */}
        {activeTaskId && taskData && (
          <Card className="mb-8 bg-gray-800/50 border-gray-700">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Scale className="h-6 w-6 text-emerald-400" />
                <CardTitle>Workflow Progress</CardTitle>
              </div>
              <CardDescription>
                Real-time status of your document processing
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Stage Timeline */}
              <div className="relative mb-12">
                <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-gray-700 -translate-y-1/2" />
                <div className="relative flex justify-between">
                  {workflowStages.map((stage, index) => {
                    const currentStage = getCurrentStage(taskData.progress);
                    const Icon = stage.icon;
                    const isCompleted = index < currentStage;
                    const isCurrent = index === currentStage;
                    const isError = taskData.status === "failed" && isCurrent;

                    return (
                      <div
                        key={stage.id}
                        className="flex flex-col items-center"
                      >
                        <div
                          className={`w-12 h-12 rounded-full flex items-center justify-center relative z-10 transition-all duration-300
                          ${
                            isCompleted
                              ? "bg-emerald-500 scale-105"
                              : isError
                                ? "bg-red-500 scale-105"
                                : isCurrent
                                  ? "bg-blue-500/20 border-2 border-blue-400 scale-110"
                                  : "bg-gray-700"
                          }`}
                        >
                          {isCompleted ? (
                            <CheckCircle2 className="h-6 w-6 text-white" />
                          ) : isError ? (
                            <AlertTriangle className="h-6 w-6 text-white" />
                          ) : isCurrent ? (
                            <Clock className="h-6 w-6 text-blue-400 animate-spin" />
                          ) : (
                            <Icon className="h-6 w-6 text-gray-400" />
                          )}
                        </div>
                        <div className="mt-4 text-sm font-medium text-center">
                          <span
                            className={`transition-colors ${
                              isCompleted
                                ? "text-emerald-400"
                                : isError
                                  ? "text-red-400"
                                  : isCurrent
                                    ? "text-blue-400"
                                    : "text-gray-400"
                            }`}
                          >
                            {stage.name}
                          </span>
                          {isError && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => retryMutation.mutate(stage.id)}
                              disabled={retryMutation.isPending}
                              className="mt-2 text-red-400 hover:text-red-300"
                            >
                              <RefreshCcw className="h-3 w-3 mr-1" />
                              Retry Stage
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Progress Status */}
              <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-2">
                  {taskData.status === "completed" && (
                    <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                  )}
                  {taskData.status === "processing" && (
                    <Clock className="h-5 w-5 text-blue-400 animate-spin" />
                  )}
                  {taskData.status === "failed" && (
                    <AlertCircle className="h-5 w-5 text-red-400" />
                  )}
                  <span className="text-xl font-semibold">
                    {taskData.currentStepDetails?.description ||
                      "Processing your document..."}
                  </span>
                </div>
                <Progress value={taskData.progress} className="w-1/3 h-2" />
              </div>

              {/* Metrics Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                {metricsData.map((metric, index) => (
                  <Card key={index} className="bg-gray-800/30 border-gray-700">
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between mb-4">
                        <ChartBar className="h-5 w-5 text-emerald-400" />
                        <span className="text-2xl font-bold">
                          {metric.value}%
                        </span>
                      </div>
                      <p className="text-sm text-gray-400">{metric.label}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Processing Timeline */}
              <Card className="bg-gray-800/30 border-gray-700">
                <CardHeader>
                  <CardTitle>Processing Timeline</CardTitle>
                </CardHeader>
                <CardContent className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={timelineData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis dataKey="name" stroke="#9CA3AF" />
                      <YAxis stroke="#9CA3AF" />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#1F2937",
                          border: "none",
                          borderRadius: "0.5rem",
                          color: "#F9FAFB",
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="tasks"
                        stroke="#10B981"
                        strokeWidth={2}
                        dot={{ fill: "#10B981" }}
                      />
                      <Line
                        type="monotone"
                        dataKey="time"
                        stroke="#3B82F6"
                        strokeWidth={2}
                        dot={{ fill: "#3B82F6" }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Error Log Section */}
              {errorLogs.length > 0 && (
                <Collapsible className="mt-8">
                  <CollapsibleTrigger className="flex items-center justify-between w-full p-4 bg-red-500/10 rounded-lg border border-red-500/20 transition-colors hover:bg-red-500/20">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5 text-red-400" />
                      <span className="font-medium text-red-400">
                        Error Log
                      </span>
                    </div>
                    <ChevronDown className="h-4 w-4 text-red-400" />
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <ScrollArea className="h-[200px] mt-4">
                      <div className="space-y-4">
                        {errorLogs.map((log, index) => (
                          <div
                            key={index}
                            className="p-4 bg-red-500/5 rounded border border-red-500/10"
                          >
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-red-400 font-medium">
                                {log.stage}
                              </span>
                              <span className="text-sm text-gray-500">
                                {new Date(log.timestamp).toLocaleString()}
                              </span>
                            </div>
                            <p className="text-gray-300">{log.message}</p>
                            {log.details && (
                              <p className="mt-2 text-sm text-gray-400">
                                {log.details}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </CollapsibleContent>
                </Collapsible>
              )}
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
