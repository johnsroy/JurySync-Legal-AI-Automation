import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useDropzone } from "react-dropzone";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest, type TaskData } from "@/lib/queryClient";
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
  FileDown
} from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts";

interface ErrorLog {
  timestamp: string;
  stage: string;
  message: string;
  details?: string;
}

export default function WorkflowAutomation() {
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [errorLogs, setErrorLogs] = useState<ErrorLog[]>([]);
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
    { id: 'draft', name: 'Draft Generation', icon: FileText },
    { id: 'compliance', name: 'Compliance Auditing', icon: Scale },
    { id: 'research', name: 'Legal Research & Summarization', icon: BookCheck },
    { id: 'approval', name: 'Approval & Execution', icon: BadgeCheck },
    { id: 'audit', name: 'Periodic Audit', icon: History }
  ];

  // Document upload handler
  const onDrop = async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;

    toast({
      title: "Document Submitted",
      description: "Starting automation workflow...",
      duration: 3000
    });

    const formData = new FormData();
    formData.append('file', acceptedFiles[0]);

    try {
      const response = await fetch('/api/orchestrator/documents', {
        method: 'POST',
        body: formData,
      });
      const data = await response.json();
      if (data.taskId) {
        setActiveTaskId(data.taskId);
        toast({
          title: "Processing Started",
          description: "Your document is being analyzed",
          duration: 5000
        });
      }
    } catch (error) {
      console.error('Upload failed:', error);
      const errorLog: ErrorLog = {
        timestamp: new Date().toISOString(),
        stage: 'upload',
        message: 'Document upload failed',
        details: error instanceof Error ? error.message : String(error)
      };
      setErrorLogs(prev => [errorLog, ...prev]);
      toast({
        title: "Upload Failed",
        description: "There was an error uploading your document",
        variant: "destructive"
      });
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop });

  // Task progress query
  const { data: taskData } = useQuery<TaskData>({
    queryKey: ['/api/orchestrator/tasks', activeTaskId],
    enabled: !!activeTaskId,
    refetchInterval: 2000,
  });

  // Retry mutation
  const retryMutation = useMutation({
    mutationFn: async (stageId?: string) => {
      if (!activeTaskId) return;
      await apiRequest('POST', `/api/orchestrator/tasks/${activeTaskId}/retry`, { stageId });
      await queryClient.invalidateQueries({
        queryKey: ['/api/orchestrator/tasks', activeTaskId]
      });
    }
  });

  // Download handlers
  const handleDownloadPDF = async () => {
    try {
      const response = await fetch(`/api/orchestrator/tasks/${activeTaskId}/report?format=pdf`);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `workflow-report-${activeTaskId}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('PDF download failed:', error);
      toast({
        title: "Download Failed",
        description: "Failed to download PDF report",
        variant: "destructive"
      });
    }
  };

  const handleDownloadCSV = async () => {
    try {
      const response = await fetch(`/api/orchestrator/tasks/${activeTaskId}/report?format=csv`);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `workflow-metrics-${activeTaskId}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('CSV download failed:', error);
      toast({
        title: "Download Failed",
        description: "Failed to download CSV report",
        variant: "destructive"
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
    { name: 'Tasks Automated', value: 80, label: '80% of routine tasks automated' },
    { name: 'Processing Speed', value: 70, label: '70% faster processing' },
    { name: 'Cost Savings', value: 40, label: '40% labor cost savings' },
    { name: 'Error Reduction', value: 60, label: '60% error reduction' }
  ];

  // Sample timeline data
  const timelineData = [
    { name: 'Week 1', tasks: 45, time: 120 },
    { name: 'Week 2', tasks: 52, time: 110 },
    { name: 'Week 3', tasks: 48, time: 90 },
    { name: 'Week 4', tasks: 60, time: 85 }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 text-white">
      {/* Header Section */}
      <header className="border-b border-slate-700">
        <div className="container mx-auto py-8">
          <div className="flex items-center space-x-2 mb-2">
            <BrainCircuit className="h-8 w-8 text-blue-400" />
            <h1 className="text-4xl font-bold tracking-tight">
              Full Lifecycle Automation Workflow
            </h1>
          </div>
          <p className="text-slate-400 text-lg mb-8">
            From Draft to Execution – Automating 80% of Legal Compliance Tasks
          </p>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="container mx-auto py-16">
        {/* Upload Section */}
        <Card className="p-12 mb-12 bg-slate-800 border-slate-700">
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all duration-300
              ${isDragActive ? 'border-blue-400 bg-blue-400/10 scale-102' : 'border-slate-600 hover:border-blue-400/50'}`}
          >
            <input {...getInputProps()} />
            <Upload className={`h-16 w-16 mx-auto mb-6 text-slate-400 transition-transform duration-300 ${isDragActive ? 'scale-110' : ''}`} />
            <h3 className="text-xl font-semibold mb-3">
              Upload Legal Documents
            </h3>
            <p className="text-slate-400 mb-4">
              Drag & drop your documents here or click to select files
            </p>
            <div className="flex justify-center gap-4 text-sm text-slate-500">
              <span>PDF</span>
              <span>DOCX</span>
              <span>TXT</span>
            </div>
          </div>
        </Card>

        {/* Workflow Progress */}
        {activeTaskId && taskData && (
          <Card className="p-12 mb-12 bg-slate-800 border-slate-700">
            {/* Stage Timeline */}
            <div className="relative mb-12">
              <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-slate-700 -translate-y-1/2" />
              <div className="relative flex justify-between">
                {workflowStages.map((stage, index) => {
                  const currentStage = getCurrentStage(taskData.progress);
                  const Icon = stage.icon;
                  const isCompleted = index < currentStage;
                  const isCurrent = index === currentStage;
                  const isError = taskData.status === 'failed' && isCurrent;

                  return (
                    <div key={stage.id} className="flex flex-col items-center">
                      <div
                        className={`w-12 h-12 rounded-full flex items-center justify-center relative z-10 transition-all duration-300
                          ${isCompleted ? 'bg-green-500 scale-105' :
                            isError ? 'bg-red-500 scale-105' :
                              isCurrent ? 'bg-blue-500/20 border-2 border-blue-400 scale-110' :
                                'bg-slate-700'}`}
                      >
                        {isCompleted ? (
                          <CheckCircle2 className="h-6 w-6 text-white" />
                        ) : isError ? (
                          <AlertTriangle className="h-6 w-6 text-white" />
                        ) : isCurrent ? (
                          <Clock className="h-6 w-6 text-blue-400 animate-spin" />
                        ) : (
                          <Icon className="h-6 w-6 text-slate-400" />
                        )}
                      </div>
                      <div className="mt-4 text-sm font-medium text-center">
                        <span className={`transition-colors ${
                          isCompleted ? 'text-green-400' :
                            isError ? 'text-red-400' :
                              isCurrent ? 'text-blue-400' :
                                'text-slate-400'
                        }`}>
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

            {/* Status and Actions */}
            <div className="flex justify-between items-center mb-8">
              <div>
                <div className="flex items-center space-x-2 mb-2">
                  {taskData.status === 'completed' && <CheckCircle2 className="h-5 w-5 text-green-400" />}
                  {taskData.status === 'processing' && <Clock className="h-5 w-5 text-blue-400 animate-spin" />}
                  {taskData.status === 'failed' && <AlertCircle className="h-5 w-5 text-red-400" />}
                  <h3 className="text-2xl font-semibold">Workflow Progress</h3>
                </div>
                <p className="text-slate-400">
                  {taskData.currentStepDetails?.description || 'Processing your document...'}
                </p>
              </div>

              <div className="flex items-center space-x-4">
                {taskData.status === 'failed' && (
                  <Button
                    variant="outline"
                    onClick={() => retryMutation.mutate(undefined)}
                    disabled={retryMutation.isPending}
                    className="border-slate-600 hover:bg-slate-700"
                  >
                    <RefreshCcw className="h-4 w-4 mr-2" />
                    Retry Process
                  </Button>
                )}
              </div>
            </div>

            {/* Progress Bar */}
            <Progress
              value={taskData.progress}
              className="h-2 mb-6 bg-slate-700"
            />

            {/* Error Log Section */}
            {errorLogs.length > 0 && (
              <Collapsible className="mb-8">
                <CollapsibleTrigger className="flex items-center justify-between w-full p-4 bg-red-500/10 rounded-lg border border-red-500/20 transition-colors hover:bg-red-500/20">
                  <div className="flex items-center space-x-2">
                    <AlertTriangle className="h-5 w-5 text-red-400" />
                    <span className="font-medium text-red-400">Error Log</span>
                  </div>
                  <ChevronDown className="h-4 w-4 text-red-400" />
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <ScrollArea className="h-[200px] mt-4">
                    <div className="space-y-4">
                      {errorLogs.map((log, index) => (
                        <div key={index} className="p-4 bg-red-500/5 rounded border border-red-500/10">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-red-400 font-medium">{log.stage}</span>
                            <span className="text-sm text-slate-500">
                              {new Date(log.timestamp).toLocaleString()}
                            </span>
                          </div>
                          <p className="text-slate-300">{log.message}</p>
                          {log.details && (
                            <p className="mt-2 text-sm text-slate-400">{log.details}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </CollapsibleContent>
              </Collapsible>
            )}

            {/* Metrics Dashboard */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-12">
              {/* Performance Metrics */}
              <Card className="bg-slate-700/50 border-none p-6">
                <h4 className="text-lg font-semibold mb-6">Performance Metrics</h4>
                <div className="space-y-4">
                  {metricsData.map((metric, index) => (
                    <div key={index} className="relative pt-1">
                      <div className="flex mb-2 items-center justify-between">
                        <div>
                          <span className="text-xs font-semibold inline-block py-1 px-2 uppercase rounded-full bg-blue-500/20 text-blue-400">
                            {metric.name}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-xs font-semibold inline-block text-blue-400">
                            {metric.value}%
                          </span>
                        </div>
                      </div>
                      <div className="overflow-hidden h-2 mb-4 text-xs flex rounded bg-slate-600">
                        <div
                          style={{ width: `${metric.value}%` }}
                          className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-blue-500 transition-all duration-500"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </Card>

              {/* Processing Timeline */}
              <Card className="bg-slate-700/50 border-none p-6">
                <h4 className="text-lg font-semibold mb-6">Processing Timeline</h4>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={timelineData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#475569" />
                      <XAxis dataKey="name" stroke="#94a3b8" />
                      <YAxis stroke="#94a3b8" />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#1e293b',
                          border: 'none',
                          borderRadius: '0.5rem',
                          color: '#f8fafc'
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="tasks"
                        stroke="#3b82f6"
                        strokeWidth={2}
                        dot={{ fill: '#3b82f6' }}
                      />
                      <Line
                        type="monotone"
                        dataKey="time"
                        stroke="#22c55e"
                        strokeWidth={2}
                        dot={{ fill: '#22c55e' }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            </div>

            {/* Report Download Section */}
            <div className="mt-12 border-t border-slate-700 pt-8">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-lg font-semibold mb-2">Download Report</h4>
                  <p className="text-slate-400">Export workflow results and metrics in your preferred format</p>
                </div>
                <div className="flex gap-4">
                  <Button
                    variant="outline"
                    onClick={handleDownloadPDF}
                    className="border-slate-600 hover:bg-slate-700 transition-colors"
                  >
                    <FileDown className="h-4 w-4 mr-2" />
                    PDF Report
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleDownloadCSV}
                    className="border-slate-600 hover:bg-slate-700 transition-colors"
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    CSV Data
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        )}
      </main>
    </div>
  );
}