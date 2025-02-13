export interface DocumentMetadata {
  documentType: string;
  industry: string;
  complianceStatus: string;
  analysisTimestamp: string;
  confidence: number;
  classifications: Array<{
    category: string;
    subCategory: string;
    tags: string[];
  }>;
  riskScore: number;
}

export interface AnalysisResult {
  documentId: string;
  metadata: DocumentMetadata;
  status: 'success' | 'error';
  error?: string;
}

export interface WorkflowResult {
  stageType: 'classification' | 'compliance' | 'research';
  content: string;
  status?: string;
  riskScore?: number;
}
