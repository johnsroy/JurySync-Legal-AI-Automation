export interface DocumentAnalysis {
  documentType: string;
  industry: string;
  complianceStatus: {
    status: 'PASSED' | 'FAILED' | 'PENDING';
    details: string;
    lastChecked: string;
  };
  content?: string;
}

export interface VaultDocument {
  id: string;
  fileName: string;
  documentType: string;
  industry: string;
  complianceStatus: string;
  timestamp: string;
  content: string;
  metadata?: {
    confidence: number;
    recommendations: string[];
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  };
} 