import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { Loader2, AlertCircle, CheckCircle2, Terminal, FileText, Scale, Book } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

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
};

const TASK_TYPE_ICONS = {
  contract: <FileText className="w-5 h-5" />,
  compliance: <Scale className="w-5 h-5" />,
  research: <Book className="w-5 h-5" />,
};

export default function Orchestrator() {
  const [selectedTask, setSelectedTask] = useState<string | null>(null);
  const { toast } = useToast();

  // Fetch all tasks
  const { data: tasks = [], isLoading: isLoadingTasks } = useQuery<Task[]>({
    queryKey: ["/api/orchestrator/tasks"],
    refetchInterval: 5000, // Refresh every 5 seconds
  });

  // Fetch selected task details
  const { data: taskDetails } = useQuery<Task>({
    queryKey: ["/api/orchestrator/tasks", selectedTask],
    enabled: !!selectedTask,
    refetchInterval: 3000, // Refresh details every 3 seconds
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

  const renderTaskStatus = (status: string, progress: number) => {
    switch (status) {
      case 'analyzing':
      case 'processing':
        return (
          <div className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-yellow-500" />
            <span className="text-sm text-yellow-600">{progress}%</span>
          </div>
        );
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      case 'completed':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      default:
        return <Terminal className="h-4 w-4 text-gray-400" />;
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  return (
    <div className="container mx-auto py-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold">Task Orchestrator</h1>

        <div className="flex gap-4">
          <Button
            onClick={() => createTaskMutation.mutate('contract')}
            disabled={createTaskMutation.isPending}
            className="gap-2"
          >
            {TASK_TYPE_ICONS.contract}
            Contract Analysis
          </Button>
          <Button
            onClick={() => createTaskMutation.mutate('compliance')}
            disabled={createTaskMutation.isPending}
            className="gap-2"
          >
            {TASK_TYPE_ICONS.compliance}
            Compliance Check
          </Button>
          <Button
            onClick={() => createTaskMutation.mutate('research')}
            disabled={createTaskMutation.isPending}
            className="gap-2"
          >
            {TASK_TYPE_ICONS.research}
            Legal Research
          </Button>
        </div>
      </div>

      <div className="grid gap-8 grid-cols-1 xl:grid-cols-2">
        {/* Tasks List */}
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
                    className={`w-full text-left p-4 rounded-lg border transition-colors ${
                      selectedTask === task.id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-blue-200 hover:bg-gray-50'
                    }`}
                    onClick={() => setSelectedTask(task.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {TASK_TYPE_ICONS[task.type]}
                        <div>
                          <div className="font-medium capitalize">{task.type}</div>
                          <div className="text-sm text-gray-500">
                            Created: {formatDate(task.createdAt)}
                          </div>
                        </div>
                      </div>
                      {renderTaskStatus(task.status, task.progress)}
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
              <CardTitle>Task Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Progress Section */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="font-medium">Progress</span>
                  <span className="text-sm text-gray-500">
                    {taskDetails.progress}%
                  </span>
                </div>
                <Progress value={taskDetails.progress} className="h-2" />
              </div>

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
                      <div className="mt-2 flex flex-wrap gap-2">
                        {taskDetails.currentStepDetails.requiredAgents.map(
                          (agent: string, index: number) => (
                            <span
                              key={index}
                              className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full"
                            >
                              {agent}
                            </span>
                          )
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* Analysis Section */}
              {taskDetails.analysis && (
                <div>
                  <h3 className="font-medium mb-2">Analysis</h3>

                  {/* Steps */}
                  <div className="space-y-2">
                    {taskDetails.analysis.steps.map((step, index) => (
                      <div
                        key={index}
                        className={`p-3 border rounded-lg ${
                          index === taskDetails.currentStep
                            ? 'border-blue-500 bg-blue-50'
                            : index < (taskDetails.currentStep || 0)
                            ? 'border-green-500 bg-green-50'
                            : ''
                        }`}
                      >
                        <div className="font-medium">{step.name}</div>
                        <div className="text-sm text-gray-600">
                          {step.description}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Risk Factors */}
                  {taskDetails.analysis.riskFactors.length > 0 && (
                    <div className="mt-4">
                      <h4 className="text-sm font-medium mb-2">Risk Factors</h4>
                      <div className="flex flex-wrap gap-2">
                        {taskDetails.analysis.riskFactors.map((risk, index) => (
                          <span
                            key={index}
                            className="px-2 py-1 bg-red-100 text-red-800 text-xs rounded-full"
                          >
                            {risk}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Quality Issues */}
                  {taskDetails.qualityIssues && taskDetails.qualityIssues.length > 0 && (
                    <div className="mt-4">
                      <h4 className="text-sm font-medium mb-2">Quality Issues</h4>
                      <ul className="list-disc pl-5 space-y-1">
                        {taskDetails.qualityIssues.map((issue, index) => (
                          <li key={index} className="text-sm text-red-600">
                            {issue}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {/* Error Display */}
              {taskDetails.error && (
                <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex items-center gap-2 text-red-600">
                    <AlertCircle className="h-5 w-5" />
                    <span className="font-medium">Error</span>
                  </div>
                  <p className="mt-1 text-sm text-red-600">
                    {taskDetails.error}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}