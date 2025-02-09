import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

type Task = {
  id: string;
  type: 'contract' | 'compliance' | 'research';
  status: string;
  createdAt: number;
  updatedAt: number;
};

type TaskDetails = {
  status: string;
  currentStep: number;
  totalSteps: number;
  qualityMetrics?: {
    passed: boolean;
    metrics: Record<string, string | number>;
    issues?: string[];
    recommendations?: string[];
  };
  analysis: {
    requiredAgents: string[];
    steps: string[];
    riskFactors: string[];
    qualityThresholds: Record<string, any>;
  };
};

export default function Orchestrator() {
  const [selectedTask, setSelectedTask] = useState<string | null>(null);
  const { toast } = useToast();

  const { data: tasks, isLoading: isLoadingTasks } = useQuery<Task[]>({
    queryKey: ["/api/orchestrator/tasks"],
    refetchInterval: 5000,
  });

  const { data: taskDetails, isLoading: isLoadingDetails } = useQuery<TaskDetails>({
    queryKey: ["/api/orchestrator/tasks", selectedTask],
    enabled: !!selectedTask,
    refetchInterval: 3000,
  });

  const createTaskMutation = useMutation({
    mutationFn: async (taskData: { type: 'contract' | 'compliance' | 'research', data: any }) => {
      const response = await apiRequest("POST", "/api/orchestrator/tasks", taskData);
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Task Created",
        description: `Task ID: ${data.taskId}`,
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

  const handleCreateTask = async (type: 'contract' | 'compliance' | 'research') => {
    try {
      await createTaskMutation.mutateAsync({
        type,
        data: {
          timestamp: new Date().toISOString(),
          priority: "normal",
        }
      });
    } catch (error) {
      console.error('Error creating task:', error);
    }
  };

  const renderTaskStatus = (status: string) => {
    switch (status) {
      case 'pending':
      case 'processing':
      case 'in_progress':
        return <Loader2 className="h-4 w-4 animate-spin text-yellow-500" />;
      case 'error':
      case 'quality_review':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      case 'completed':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      default:
        return <div className="h-4 w-4 rounded-full bg-gray-200" />;
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-8">Central Orchestrator</h1>

      <div className="grid gap-8">
        {/* Task Creation Section */}
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Create New Task</h2>
          <div className="flex gap-4">
            <Button
              onClick={() => handleCreateTask('contract')}
              disabled={createTaskMutation.isPending}
            >
              Contract Analysis
            </Button>
            <Button
              onClick={() => handleCreateTask('compliance')}
              disabled={createTaskMutation.isPending}
            >
              Compliance Check
            </Button>
            <Button
              onClick={() => handleCreateTask('research')}
              disabled={createTaskMutation.isPending}
            >
              Legal Research
            </Button>
          </div>
        </Card>

        {/* Tasks List Section */}
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Active Tasks</h2>
          <div className="space-y-4">
            {isLoadingTasks ? (
              Array(3).fill(0).map((_, index) => (
                <div key={index} className="flex items-center p-4 border rounded-lg animate-pulse">
                  <div className="h-4 w-4 rounded-full bg-gray-200" />
                  <div className="h-4 w-48 ml-4 bg-gray-200 rounded" />
                </div>
              ))
            ) : tasks?.length > 0 ? (
              tasks.map((task) => (
                <div
                  key={task.id}
                  className={`flex items-center justify-between p-4 border rounded-lg cursor-pointer hover:bg-gray-50 ${
                    selectedTask === task.id ? 'border-blue-500 bg-blue-50' : ''
                  }`}
                  onClick={() => setSelectedTask(task.id)}
                >
                  <div className="flex items-center">
                    {renderTaskStatus(task.status)}
                    <span className="ml-4 font-medium capitalize">{task.type}</span>
                  </div>
                  <div className="text-sm text-gray-500">
                    {formatDate(task.createdAt)}
                  </div>
                </div>
              ))
            ) : (
              <p className="text-center text-gray-500">No active tasks</p>
            )}
          </div>
        </Card>

        {/* Selected Task Details */}
        {selectedTask && taskDetails && (
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">Task Details</h2>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="font-medium">Progress</h3>
                <span className="text-sm text-gray-500">
                  Step {taskDetails.currentStep + 1} of {taskDetails.totalSteps}
                </span>
              </div>
              <Progress
                value={(taskDetails.currentStep / taskDetails.totalSteps) * 100}
                className="w-full"
              />

              {taskDetails.qualityMetrics && (
                <div className="mt-4">
                  <h3 className="font-medium mb-2">Quality Metrics</h3>
                  <div className="grid grid-cols-2 gap-4">
                    {Object.entries(taskDetails.qualityMetrics.metrics || {}).map(([key, value]) => (
                      <div key={key} className="p-3 border rounded-lg">
                        <div className="text-sm text-gray-500 capitalize">{key.replace(/_/g, ' ')}</div>
                        <div className="font-medium">{value}</div>
                      </div>
                    ))}
                  </div>

                  {taskDetails.qualityMetrics.issues && taskDetails.qualityMetrics.issues.length > 0 && (
                    <div className="mt-4">
                      <h4 className="font-medium mb-2">Issues</h4>
                      <ul className="list-disc pl-5 space-y-1">
                        {taskDetails.qualityMetrics.issues.map((issue, index) => (
                          <li key={index} className="text-red-600">{issue}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {taskDetails.qualityMetrics.recommendations && taskDetails.qualityMetrics.recommendations.length > 0 && (
                    <div className="mt-4">
                      <h4 className="font-medium mb-2">Recommendations</h4>
                      <ul className="list-disc pl-5 space-y-1">
                        {taskDetails.qualityMetrics.recommendations.map((rec, index) => (
                          <li key={index} className="text-blue-600">{rec}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              <div className="mt-4">
                <h3 className="font-medium mb-2">Analysis</h3>
                <div className="space-y-4">
                  <div>
                    <h4 className="text-sm font-medium text-gray-500">Required Agents</h4>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {taskDetails.analysis.requiredAgents.map((agent, index) => (
                        <span key={index} className="px-2 py-1 bg-gray-100 rounded-full text-sm">
                          {agent}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h4 className="text-sm font-medium text-gray-500">Processing Steps</h4>
                    <div className="space-y-2 mt-1">
                      {taskDetails.analysis.steps.map((step, index) => (
                        <div
                          key={index}
                          className={`p-3 border rounded-lg ${
                            index <= taskDetails.currentStep ? 'bg-green-50' : ''
                          }`}
                        >
                          {step}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h4 className="text-sm font-medium text-gray-500">Risk Factors</h4>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {taskDetails.analysis.riskFactors.map((risk, index) => (
                        <span key={index} className="px-2 py-1 bg-red-50 text-red-700 rounded-full text-sm">
                          {risk}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}