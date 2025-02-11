import { Link } from "wouter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useDropzone } from "react-dropzone";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, type TaskData } from "@/lib/queryClient";
import {
  BookCheck,
  Scale,
  FileText,
  History,
  BarChart2,
  Workflow,
  Upload,
  RefreshCcw,
  Download,
  AlertCircle,
  CheckCircle2,
  Clock,
  ArrowRight
} from "lucide-react";
import { useState } from "react";

export default function WorkflowAutomation() {
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);

  // Document upload handler
  const onDrop = async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;

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
      }
    } catch (error) {
      console.error('Upload failed:', error);
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop });

  // Task progress query
  const { data: taskData } = useQuery<TaskData>({
    queryKey: ['/api/orchestrator/tasks', activeTaskId],
    enabled: !!activeTaskId,
    refetchInterval: 2000, // Poll every 2 seconds
  });

  // Retry mutation
  const retryMutation = useMutation({
    mutationFn: async () => {
      if (!activeTaskId) return;
      await apiRequest('POST', `/api/orchestrator/tasks/${activeTaskId}/retry`);
    }
  });

  // Define workflow stages
  const stages = [
    { id: 'upload', name: 'Document Upload', icon: Upload },
    { id: 'analysis', name: 'Initial Analysis', icon: FileText },
    { id: 'compliance', name: 'Compliance Check', icon: Scale },
    { id: 'research', name: 'Legal Research', icon: BookCheck },
    { id: 'report', name: 'Report Generation', icon: BarChart2 }
  ];

  // Calculate current stage based on progress
  const getCurrentStage = (progress: number) => {
    if (progress <= 20) return 0;
    if (progress <= 40) return 1;
    if (progress <= 60) return 2;
    if (progress <= 80) return 3;
    return 4;
  };

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header Section */}
      <header className="border-b border-gray-800">
        <div className="container mx-auto py-8">
          <div className="flex items-center space-x-2 mb-2">
            <Workflow className="h-8 w-8 text-blue-500" />
            <h1 className="text-4xl font-bold tracking-tight">
              Full Lifecycle Automation Workflow
            </h1>
          </div>
          <p className="text-gray-400 text-lg mb-8">
            From Draft to Execution – Automating 80% of Legal Compliance Tasks
          </p>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="container mx-auto py-16">
        {/* Upload Section */}
        <Card className="p-12 mb-12 bg-gray-900 border-gray-800">
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors
              ${isDragActive ? 'border-blue-500 bg-blue-500/10' : 'border-gray-700 hover:border-blue-500/50'}`}
          >
            <input {...getInputProps()} />
            <Upload className="h-16 w-16 mx-auto mb-6 text-gray-400" />
            <h3 className="text-xl font-semibold mb-3">
              Drag & Drop Your Document
            </h3>
            <p className="text-gray-400">
              or click to select files for automated processing
            </p>
          </div>
        </Card>

        {/* Workflow Progress */}
        {activeTaskId && taskData && (
          <Card className="p-12 mb-12 bg-gray-900 border-gray-800">
            {/* Stage Timeline */}
            <div className="relative mb-12">
              <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-gray-800 -translate-y-1/2" />
              <div className="relative flex justify-between">
                {stages.map((stage, index) => {
                  const currentStage = getCurrentStage(taskData.progress);
                  const Icon = stage.icon;
                  const isCompleted = index < currentStage;
                  const isCurrent = index === currentStage;

                  return (
                    <div key={stage.id} className="flex flex-col items-center">
                      <div 
                        className={`w-10 h-10 rounded-full flex items-center justify-center relative z-10
                          ${isCompleted ? 'bg-blue-500' : isCurrent ? 'bg-blue-500/20 border-2 border-blue-500' : 'bg-gray-800'}`}
                      >
                        <Icon className={`h-5 w-5 ${isCompleted || isCurrent ? 'text-white' : 'text-gray-500'}`} />
                      </div>
                      <div className="mt-2 text-sm font-medium text-center">
                        <span className={isCompleted || isCurrent ? 'text-white' : 'text-gray-500'}>
                          {stage.name}
                        </span>
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
                  {taskData.status === 'completed' && <CheckCircle2 className="h-5 w-5 text-green-500" />}
                  {taskData.status === 'processing' && <Clock className="h-5 w-5 text-blue-500 animate-spin" />}
                  {taskData.status === 'failed' && <AlertCircle className="h-5 w-5 text-red-500" />}
                  <h3 className="text-2xl font-semibold">Document Processing</h3>
                </div>
                <p className="text-gray-400">
                  {taskData.currentStepDetails?.description || 'Automating compliance and legal analysis'}
                </p>
              </div>

              <div className="flex items-center space-x-4">
                {taskData.status === 'failed' && (
                  <Button
                    variant="outline"
                    onClick={() => retryMutation.mutate()}
                    disabled={retryMutation.isPending}
                    className="border-gray-700 hover:bg-gray-800"
                  >
                    <RefreshCcw className="h-4 w-4 mr-2" />
                    Retry Process
                  </Button>
                )}
                {taskData.status === 'completed' && (
                  <Button asChild variant="default" className="bg-blue-600 hover:bg-blue-700">
                    <Link href={`/api/orchestrator/tasks/${activeTaskId}/report`}>
                      <Download className="h-4 w-4 mr-2" />
                      Download Report
                    </Link>
                  </Button>
                )}
              </div>
            </div>

            {/* Progress Bar */}
            <Progress 
              value={taskData.progress} 
              className="h-2 mb-6 bg-gray-800" 
            />

            {/* Error Display */}
            {taskData.error && (
              <div className="mb-8 p-4 bg-red-500/10 rounded-lg border border-red-500/20 flex items-start space-x-3">
                <AlertCircle className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" />
                <div>
                  <h4 className="text-red-500 font-medium mb-1">Processing Error</h4>
                  <p className="text-gray-400 text-sm">{taskData.error}</p>
                </div>
              </div>
            )}

            {/* Metrics */}
            {taskData.metrics && (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mt-8">
                <Card className="p-6 bg-gray-800 border-none">
                  <h4 className="text-sm font-medium text-gray-400 mb-3">
                    Automated Tasks
                  </h4>
                  <div className="flex items-baseline space-x-2">
                    <p className="text-3xl font-bold text-blue-500">
                      {taskData.metrics.automatedTasks}%
                    </p>
                    <span className="text-gray-500">completion</span>
                  </div>
                </Card>
                <Card className="p-6 bg-gray-800 border-none">
                  <h4 className="text-sm font-medium text-gray-400 mb-3">
                    Processing Speed
                  </h4>
                  <div className="flex items-baseline space-x-2">
                    <p className="text-3xl font-bold text-blue-500">
                      {taskData.metrics.processingSpeed}%
                    </p>
                    <span className="text-gray-500">faster</span>
                  </div>
                </Card>
                <Card className="p-6 bg-gray-800 border-none">
                  <h4 className="text-sm font-medium text-gray-400 mb-3">
                    Labor Cost Savings
                  </h4>
                  <div className="flex items-baseline space-x-2">
                    <p className="text-3xl font-bold text-blue-500">
                      {taskData.metrics.laborCost}%
                    </p>
                    <span className="text-gray-500">reduced</span>
                  </div>
                </Card>
                <Card className="p-6 bg-gray-800 border-none">
                  <h4 className="text-sm font-medium text-gray-400 mb-3">
                    Error Reduction
                  </h4>
                  <div className="flex items-baseline space-x-2">
                    <p className="text-3xl font-bold text-blue-500">
                      {taskData.metrics.errorReduction}%
                    </p>
                    <span className="text-gray-500">improvement</span>
                  </div>
                </Card>
              </div>
            )}
          </Card>
        )}
      </main>
    </div>
  );
}