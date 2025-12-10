/**
 * Legal Research Service - Client Side
 *
 * This service handles legal document analysis and research queries by calling
 * the backend API endpoints. API keys are kept secure on the server.
 */

export interface LegalAnalysis {
  summary: string;
  analysis: {
    legalPrinciples: string[];
    keyPrecedents: {
      case: string;
      relevance: string;
      impact: string;
    }[];
    recommendations: string[];
  };
  citations: {
    source: string;
    reference: string;
    context: string;
  }[];
}

export interface ResearchResult {
  title: string;
  source: string;
  relevance: number;
  summary: string;
  citations: string[];
}

export interface ResearchResponse {
  success: boolean;
  results: ResearchResult[];
  recommendations: string[];
  timestamp: string;
  error?: string;
}

export interface ResearchFilters {
  jurisdiction?: string;
  legalTopic?: string;
  dateRange?: {
    start?: string;
    end?: string;
  };
}

/**
 * Analyzes a legal document using the backend API
 * @param content - The document content to analyze
 * @returns Legal analysis including summary, principles, precedents, and recommendations
 */
export async function analyzeLegalDocument(content: string): Promise<LegalAnalysis> {
  try {
    console.log('Sending document for analysis...');

    if (!content || content.trim().length === 0) {
      throw new Error('No content provided for analysis');
    }

    const response = await fetch('/api/legal-research/analyze-document', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include', // Include session credentials
      body: JSON.stringify({ content }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Analysis failed with status ${response.status}`);
    }

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || 'Analysis failed');
    }

    console.log('Analysis complete');
    return {
      summary: data.summary,
      analysis: data.analysis,
      citations: data.citations,
    };
  } catch (error) {
    console.error('Legal analysis error:', error);
    throw new Error(error instanceof Error ? error.message : 'Failed to analyze legal document');
  }
}

/**
 * Performs legal research using the backend API
 * @param query - The research query
 * @param filters - Optional filters for jurisdiction, topic, date range
 * @returns Research results with recommendations
 */
export async function performLegalResearch(
  query: string,
  filters?: ResearchFilters
): Promise<ResearchResponse> {
  try {
    console.log('Performing legal research...');

    if (!query || query.trim().length === 0) {
      throw new Error('No query provided for research');
    }

    const response = await fetch('/api/legal-research/analyze', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ query, filters }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Research failed with status ${response.status}`);
    }

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || 'Research failed');
    }

    console.log('Research complete');
    return data;
  } catch (error) {
    console.error('Legal research error:', error);
    throw new Error(error instanceof Error ? error.message : 'Failed to perform legal research');
  }
}

/**
 * Fetches available research filters from the backend
 * @returns Available jurisdictions and legal topics
 */
export async function getResearchFilters(): Promise<{
  jurisdictions: string[];
  legalTopics: string[];
}> {
  try {
    const response = await fetch('/api/legal-research/filters', {
      method: 'GET',
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch filters with status ${response.status}`);
    }

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || 'Failed to fetch filters');
    }

    return data.filters;
  } catch (error) {
    console.error('Error fetching filters:', error);
    // Return empty arrays as fallback
    return { jurisdictions: [], legalTopics: [] };
  }
}
