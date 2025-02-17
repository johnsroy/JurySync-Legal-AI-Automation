export interface LegalResearchState {
  query: string;
  findings: {
    executiveSummary: string;
    keyFindings: Array<{
      title: string;
      source: string;
      relevance: number;
      summary: string;
      citations: string[];
    }>;
    recommendations: string[];
  } | null;
  isSearching: boolean;
} 