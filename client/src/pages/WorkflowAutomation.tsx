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
    <div className="min-h-screen bg-background">
      {/* Header Section */}
      <header className="border-b">
        <div className="container mx-auto py-8">
          <div className="flex items-center space-x-2 mb-2">
            <Workflow className="h-8 w-8 text-primary" />
            <h1 className="text-4xl font-bold tracking-tight">
              Full Lifecycle Automation Workflow
            </h1>
          </div>
          <p className="text-muted-foreground text-lg mb-8">
            From Draft to Execution – Automating 80% of Legal Compliance Tasks
          </p>

          {/* Navigation Bar */}
          <nav className="flex space-x-4">
            {modules.map((module) => {
              const Icon = module.icon;
              return (
                <Link key={module.name} href={module.href}>
                  <a className="group flex items-center space-x-2 px-4 py-2 rounded-lg hover:bg-accent transition-colors">
                    <Icon className="h-5 w-5 text-muted-foreground group-hover:text-primary" />
                    <span className="text-sm font-medium">{module.name}</span>
                  </a>
                </Link>
              );
            })}
          </nav>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="container mx-auto py-8">
        {/* Upload Section */}
        <Card className="p-8 mb-8">
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
              ${isDragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50'}`}
          >
            <input {...getInputProps()} />
            <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">
              Drag & Drop Your Document
            </h3>
            <p className="text-sm text-muted-foreground">
              or click to select files
            </p>
          </div>
        </Card>

        {/* Workflow Progress */}
        {activeTaskId && taskData && (
          <Card className="p-8 mb-8">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-semibold">Processing Document</h3>
              <div className="flex items-center space-x-4">
                {taskData.status === 'failed' && (
                  <Button
                    variant="outline"
                    onClick={() => retryMutation.mutate()}
                    disabled={retryMutation.isPending}
                  >
                    <RefreshCcw className="h-4 w-4 mr-2" />
                    Retry
                  </Button>
                )}
                {taskData.status === 'completed' && (
                  <Button asChild variant="outline">
                    <Link href={`/api/orchestrator/tasks/${activeTaskId}/report`}>
                      <Download className="h-4 w-4 mr-2" />
                      Download Report
                    </Link>
                  </Button>
                )}
              </div>
            </div>

            {/* Progress Bar */}
            <Progress value={taskData.progress} className="mb-4" />

            {/* Current Step */}
            {taskData.currentStepDetails && (
              <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                <span>{taskData.currentStepDetails.name}</span>
                <span>-</span>
                <span>{taskData.currentStepDetails.description}</span>
              </div>
            )}

            {/* Error Display */}
            {taskData.error && (
              <div className="mt-4 p-4 bg-destructive/10 rounded-lg flex items-start space-x-2 text-sm">
                <AlertCircle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
                <span className="text-destructive">{taskData.error}</span>
              </div>
            )}

            {/* Metrics */}
            {taskData.metrics && (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-8">
                <Card className="p-4">
                  <h4 className="text-sm font-medium text-muted-foreground mb-2">
                    Automated Tasks
                  </h4>
                  <p className="text-2xl font-bold">
                    {taskData.metrics.automatedTasks}%
                  </p>
                </Card>
                <Card className="p-4">
                  <h4 className="text-sm font-medium text-muted-foreground mb-2">
                    Processing Speed
                  </h4>
                  <p className="text-2xl font-bold">
                    {taskData.metrics.processingSpeed}%
                  </p>
                </Card>
                <Card className="p-4">
                  <h4 className="text-sm font-medium text-muted-foreground mb-2">
                    Labor Cost Savings
                  </h4>
                  <p className="text-2xl font-bold">
                    {taskData.metrics.laborCost}%
                  </p>
                </Card>
                <Card className="p-4">
                  <h4 className="text-sm font-medium text-muted-foreground mb-2">
                    Error Reduction
                  </h4>
                  <p className="text-2xl font-bold">
                    {taskData.metrics.errorReduction}%
                  </p>
                </Card>
              </div>
            )}
          </Card>
        )}
      </main>
    </div>
  );
}