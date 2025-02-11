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
  AlertCircle
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

  const modules = [
    { name: 'Compliance Audit', icon: Scale, href: '/compliance-audit' },
    { name: 'Contract Automation', icon: FileText, href: '/contract-automation' },
    { name: 'Legal Research', icon: BookCheck, href: '/legal-research' },
    { name: 'History & Reports', icon: History, href: '/reports' }
  ];

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

          {/* Navigation Bar */}
          <nav className="flex space-x-4">
            {modules.map((module) => {
              const Icon = module.icon;
              return (
                <Link key={module.name} href={module.href}>
                  <a className="group flex items-center space-x-2 px-4 py-2 rounded-lg hover:bg-gray-800 transition-colors">
                    <Icon className="h-5 w-5 text-gray-400 group-hover:text-blue-500" />
                    <span className="text-sm font-medium">{module.name}</span>
                  </a>
                </Link>
              );
            })}
          </nav>
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
            <div className="flex justify-between items-center mb-8">
              <div>
                <h3 className="text-2xl font-semibold mb-2">Document Processing</h3>
                <p className="text-gray-400">Automating compliance and legal analysis</p>
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

            {/* Current Step */}
            {taskData.currentStepDetails && (
              <div className="flex items-center space-x-2 text-sm text-gray-400 mb-8">
                <span className="font-medium">{taskData.currentStepDetails.name}</span>
                <span>•</span>
                <span>{taskData.currentStepDetails.description}</span>
              </div>
            )}

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
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
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