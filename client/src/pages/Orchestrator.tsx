import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { 
  Loader2, AlertCircle, CheckCircle2, Terminal, FileText, Scale, 
  Book, Download, ChevronRight, UploadCloud, BarChart2 
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { FilePond, registerPlugin } from "react-filepond";
import FilePondPluginFileValidateType from "filepond-plugin-file-validate-type";
import "filepond/dist/filepond.min.css";

// Register FilePond plugins
registerPlugin(FilePondPluginFileValidateType);

type Task = {
  id: string;
  type: 'contract' | 'compliance' | 'research';
  status: string;
  progress: number;
  createdAt: number;
  updatedAt: number;
  analysis?: {
    steps: Array<{
      name: string;
      description: string;
      estimatedDuration: string;
      requiredAgents: string[];
      outputs: string[];
    }>;
    riskFactors: string[];
    qualityChecks: {
      accuracy: string;
      completeness: string;
      reliability: string;
    };
  };
  currentStep?: number;
  currentStepDetails?: any;
  qualityIssues?: string[];
  error?: string;
  metrics?: {
    automatedTasks: number;
    processingSpeed: number;
    laborCost: number;
    errorReduction: number;
  };
};

const workflowStages = [
  { id: 'draft', name: 'Draft Generation', icon: FileText },
  { id: 'compliance', name: 'Compliance Auditing', icon: Scale },
  { id: 'research', name: 'Legal Research & Summarization', icon: Book },
  { id: 'approval', name: 'Approval & Execution', icon: CheckCircle2 },
  { id: 'audit', name: 'Periodic Audit', icon: BarChart2 }
];

export default function Orchestrator() {
  const [selectedTask, setSelectedTask] = useState<string | null>(null);
  const [files, setFiles] = useState<any[]>([]);
  const { toast } = useToast();

  // Fetch all tasks
  const { data: tasks = [], isLoading: isLoadingTasks } = useQuery<Task[]>({
    queryKey: ["/api/orchestrator/tasks"],
    refetchInterval: 5000,
  });

  // Fetch selected task details
  const { data: taskDetails } = useQuery<Task>({
    queryKey: ["/api/orchestrator/tasks", selectedTask],
    enabled: !!selectedTask,
    refetchInterval: 3000,
  });

  // Create new task mutation
  const createTaskMutation = useMutation({
    mutationFn: async (type: 'contract' | 'compliance' | 'research') => {
      const response = await apiRequest("POST", "/api/orchestrator/tasks", {
        type,
        data: {
          timestamp: new Date().toISOString(),
          priority: "normal",
        }
      });
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Task Created",
        description: `New ${data.type} task created successfully.`
      });
      setSelectedTask(data.taskId);
    },
    onError: (error: Error) => {
      toast({
        title: "Error Creating Task",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Handle file upload success
  const handleUploadSuccess = (response: any): string => {
    try {
      const data = JSON.parse(typeof response === 'string' ? response : JSON.stringify(response));
      if (data.status === 'success') {
        toast({
          title: "Upload Success",
          description: "Document uploaded successfully",
        });
        createTaskMutation.mutate('contract');
        return response;
      }
      throw new Error(data.error || 'Upload failed');
    } catch (error: any) {
      console.error('Upload error:', error);
      toast({
        title: "Upload Error",
        description: error.message || "Failed to process upload response",
        variant: "destructive",
      });
      return '';
    }
  };

  // Render workflow progress
  const renderWorkflowProgress = (task: Task) => {
    const currentStepIndex = task.currentStep || 0;

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between mb-4">
          {workflowStages.map((stage, index) => {
            const Icon = stage.icon;
            const isComplete = index < currentStepIndex;
            const isCurrent = index === currentStepIndex;

            return (
              <div key={stage.id} className="flex flex-col items-center">
                <div className={`
                  w-12 h-12 rounded-full flex items-center justify-center
                  ${isComplete ? 'bg-green-100 text-green-600' : 
                    isCurrent ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-400'}
                `}>
                  <Icon className="w-6 h-6" />
                </div>
                <span className="text-xs mt-2 text-center">{stage.name}</span>
                {index < workflowStages.length - 1 && (
                  <ChevronRight className="w-4 h-4 text-gray-400 mx-2" />
                )}
              </div>
            );
          })}
        </div>
        <Progress value={task.progress} className="h-2" />
      </div>
    );
  };

  return (
    <div className="container mx-auto py-8">
      {/* Header Section */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Full Lifecycle Automation Workflow</h1>
        <p className="text-gray-600 mt-2">
          From Draft to Execution – Automating 80% of Legal Compliance Tasks
        </p>
      </div>

      {/* Document Upload Section */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center">
            <UploadCloud className="w-5 h-5 mr-2" />
            Document Upload & Initiation
          </CardTitle>
        </CardHeader>
        <CardContent>
          <FilePond
            files={files}
            onupdatefiles={setFiles}
            allowMultiple={false}
            maxFiles={1}
            server={{
              process: {
                url: "/api/orchestrator/documents",
                method: 'POST',
                headers: {
                  'Accept': 'application/json'
                },
                onload: handleUploadSuccess
              }
            }}
            acceptedFileTypes={[
              'application/pdf',
              'application/msword',
              'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
              'text/plain'
            ]}
            labelIdle='Drag & Drop your legal document or <span class="filepond--label-action">Browse</span>'
          />
        </CardContent>
      </Card>

      {/* Metrics Dashboard */}
      {taskDetails?.metrics && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="p-4">
              <div className="text-sm text-gray-500">Automated Tasks</div>
              <div className="text-2xl font-bold">{taskDetails.metrics.automatedTasks}%</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-sm text-gray-500">Processing Speed</div>
              <div className="text-2xl font-bold">{taskDetails.metrics.processingSpeed}%</div>
              <div className="text-xs text-gray-400">faster</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-sm text-gray-500">Labor Cost Savings</div>
              <div className="text-2xl font-bold">{taskDetails.metrics.laborCost}%</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-sm text-gray-500">Error Reduction</div>
              <div className="text-2xl font-bold">{taskDetails.metrics.errorReduction}%</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Workflow Progress and Details */}
      <div className="grid gap-8 grid-cols-1 xl:grid-cols-2">
        {/* Task List */}
        <Card>
          <CardHeader>
            <CardTitle>Active Tasks</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {isLoadingTasks ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                </div>
              ) : tasks.length > 0 ? (
                tasks.map((task) => (
                  <button
                    key={task.id}
                    onClick={() => setSelectedTask(task.id)}
                    className={`w-full text-left p-4 rounded-lg border transition-colors ${
                      selectedTask === task.id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-blue-200 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div>
                          <div className="font-medium capitalize">{task.type}</div>
                          <div className="text-sm text-gray-500">
                            Created: {new Date(task.createdAt).toLocaleString()}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-500">{task.progress}%</span>
                      </div>
                    </div>
                  </button>
                ))
              ) : (
                <div className="text-center py-8 text-gray-500">
                  No active tasks
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Task Details */}
        {taskDetails && (
          <Card>
            <CardHeader>
              <CardTitle>Workflow Progress</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {renderWorkflowProgress(taskDetails)}

              {/* Current Step */}
              {taskDetails.currentStepDetails && (
                <div>
                  <h3 className="font-medium mb-2">Current Step</h3>
                  <Card className="bg-gray-50">
                    <CardContent className="p-4">
                      <h4 className="font-medium">
                        {taskDetails.currentStepDetails.name}
                      </h4>
                      <p className="text-sm text-gray-600 mt-1">
                        {taskDetails.currentStepDetails.description}
                      </p>
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* Error Display */}
              {taskDetails.error && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex items-center gap-2 text-red-600">
                    <AlertCircle className="h-5 w-5" />
                    <span className="font-medium">Error</span>
                  </div>
                  <p className="mt-1 text-sm text-red-600">
                    {taskDetails.error}
                  </p>
                  <Button variant="outline" className="mt-2" size="sm">
                    Retry
                  </Button>
                </div>
              )}

              {/* Download Report Button */}
              <Button className="w-full mt-4" disabled={taskDetails.progress < 100}>
                <Download className="w-4 h-4 mr-2" />
                Download Full Report
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}