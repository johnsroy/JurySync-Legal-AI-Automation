import { create } from 'zustand';

export interface AIModelMetrics {
  accuracy: number;
  confidence: number;
  processingTime: number;
  successRate: number;
  errorRate: number;
  documentsProcessed: number;
}

export interface WorkflowMetrics {
  totalDocuments: number;
  averageProcessingTime: number;
  completionRate: number;
  automationRate: number;
  errorReduction: number;
  costSavings: number;
  timelineData: Array<{
    timestamp: string;
    documentsProcessed: number;
    processingTime: number;
    accuracy: number;
  }>;
}

interface AnalyticsStore {
  aiMetrics: AIModelMetrics;
  workflowMetrics: WorkflowMetrics;
  isLoading: boolean;
  error: string | null;
  fetchMetrics: () => Promise<void>;
}

export const useAnalyticsStore = create<AnalyticsStore>((set) => ({
  aiMetrics: {
    accuracy: 0,
    confidence: 0,
    processingTime: 0,
    successRate: 0,
    errorRate: 0,
    documentsProcessed: 0
  },
  workflowMetrics: {
    totalDocuments: 0,
    averageProcessingTime: 0,
    completionRate: 0,
    automationRate: 0,
    errorReduction: 0,
    costSavings: 0,
    timelineData: []
  },
  isLoading: false,
  error: null,
  fetchMetrics: async () => {
    try {
      set({ isLoading: true, error: null });
      const [aiResponse, workflowResponse] = await Promise.all([
        fetch('/api/analytics/ai-metrics'),
        fetch('/api/analytics/workflow-metrics')
      ]);

      if (!aiResponse.ok || !workflowResponse.ok) {
        throw new Error('Failed to fetch metrics');
      }

      const [aiData, workflowData] = await Promise.all([
        aiResponse.json(),
        workflowResponse.json()
      ]);

      set({
        aiMetrics: aiData,
        workflowMetrics: workflowData,
        isLoading: false
      });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to fetch metrics',
        isLoading: false
      });
    }
  }
}));

// Set up auto-refresh
let interval: NodeJS.Timeout;
export const startMetricsRefresh = () => {
  const { fetchMetrics } = useAnalyticsStore.getState();
  fetchMetrics(); // Initial fetch
  interval = setInterval(fetchMetrics, 30000); // Refresh every 30 seconds
};

export const stopMetricsRefresh = () => {
  if (interval) {
    clearInterval(interval);
  }
}; 