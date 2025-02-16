import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "../lib/queryClient";

export type ContextualHelpData = {
  title: string;
  content: string;
  context: string;
  priority: 'low' | 'medium' | 'high';
};

export function useContextualHelp(context: string) {
  return useQuery({
    queryKey: ['contextual-help', context],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/help/suggestions?context=${encodeURIComponent(context)}`);
      const data = await response.json();
      return data as ContextualHelpData;
    },
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    enabled: Boolean(context),
  });
}