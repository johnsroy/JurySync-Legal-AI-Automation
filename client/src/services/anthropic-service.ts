import { apiRequest } from "@/lib/queryClient";

export async function generateDraftAnalysis(content: string): Promise<string> {
  try {
    const response = await apiRequest('POST', '/api/analyze/draft', {
      content: content
    });
    
    const result = await response.json();
    return result.analysis;
  } catch (error) {
    console.error("Draft analysis error:", error);
    throw new Error("Failed to analyze document");
  }
}
