import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { Skeleton } from "@/components/ui/skeleton";

export default function Orchestrator() {
  const [selectedTask, setSelectedTask] = useState<string | null>(null);
  const { toast } = useToast();

  const { data: tasks, isLoading: isLoadingTasks } = useQuery({
    queryKey: ["/api/orchestrator/tasks"],
    refetchInterval: 5000, // Refresh every 5 seconds
  });

  const { data: taskDetails, isLoading: isLoadingDetails } = useQuery({
    queryKey: ["/api/orchestrator/tasks", selectedTask],
    enabled: !!selectedTask,
    refetchInterval: 3000,
  });

  const { data: taskHistory } = useQuery({
    queryKey: ["/api/orchestrator/tasks", selectedTask, "history"],
    enabled: !!selectedTask,
  });

  const createTaskMutation = useMutation({
    mutationFn: async (taskData: any) => {
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
        return <Loader2 className="h-4 w-4 animate-spin text-yellow-500" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      case 'completed':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      default:
        return <div className="h-4 w-4 rounded-full bg-gray-200" />;
    }
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
                  <Skeleton className="h-4 w-4 rounded-full" />
                  <Skeleton className="h-4 w-48 ml-4" />
                </div>
              ))
            ) : tasks?.length > 0 ? (
              tasks.map((task: any) => (
                <div
                  key={task.id}
                  className={`flex items-center justify-between p-4 border rounded-lg cursor-pointer hover:bg-gray-50 ${
                    selectedTask === task.id ? 'border-blue-500 bg-blue-50' : ''
                  }`}
                  onClick={() => setSelectedTask(task.id)}
                >
                  <div className="flex items-center">
                    {renderTaskStatus(task.status)}
                    <span className="ml-4 font-medium">{task.type}</span>
                  </div>
                  <div className="text-sm text-gray-500">
                    {new Date(parseInt(task.id.split('_')[1])).toLocaleString()}
                  </div>
                </div>
              ))
            ) : (
              <p className="text-center text-gray-500">No active tasks</p>
            )}
          </div>
        </Card>

        {/* Selected Task Details */}
        {selectedTask && (
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">Task Details</h2>
            {isLoadingDetails ? (
              <div className="space-y-4">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            ) : taskDetails ? (
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
                          <div className="text-sm text-gray-500">{key}</div>
                          <div className="font-medium">{value as string}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {taskHistory && (
                  <div className="mt-4">
                    <h3 className="font-medium mb-2">Analysis</h3>
                    <div className="space-y-2">
                      {taskHistory.analysis.steps.map((step: string, index: number) => (
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
                )}
              </div>
            ) : (
              <p className="text-center text-gray-500">No task details available</p>
            )}
          </Card>
        )}
      </div>
    </div>
  );
}
