import React from 'react';
import { useAuth } from "@/hooks/use-auth";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Gavel, LogOut, Loader2, Shield, AlertTriangle, CheckCircle, Info, Download, FileText } from "lucide-react";
import { useState } from "react";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { BarChart2, TrendingUp, ShieldAlert } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartTooltip, ResponsiveContainer } from 'recharts';
import { type FC } from 'react';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ErrorBoundary } from "react-error-boundary";

// Type definitions
interface DashboardInsight {
  summary: string;
  trends: Array<{
    label: string;
    value: number;
    change: number;
    insight: string;
  }>;
  riskDistribution: Array<{
    category: string;
    count: number;
    percentage: number;
  }>;
  recommendations: Array<{
    priority: 'HIGH' | 'MEDIUM' | 'LOW';
    action: string;
    impact: string;
  }>;
}

interface UploadedDocument {
  id: string;
  name: string;
  uploadedAt: string;
  status: "PENDING" | "MONITORING" | "ERROR";
}

interface ComplianceIssue {
  clause: string;
  description: string;
  severity: "CRITICAL" | "WARNING" | "INFO";
  recommendation: string;
  reference?: string;
}

interface ComplianceResult {
  documentId: string;
  riskLevel: "HIGH" | "MEDIUM" | "LOW";
  score: number;
  issues: ComplianceIssue[];
  summary: string;
  lastChecked: string;
  visualizationData: {
    riskTrend: number[];
    issueFrequency: number[];
  };
  riskScores: {
    average: number;
    max: number;
    min: number;
    distribution: {
      high: number;
      medium: number;
      low: number;
    };
  };
  recommendedActions: Array<{
    action: string;
    impact: string;
  }>;
}

interface ExportButtonProps {
  auditId: string;
}

// Add error fallback component
const ErrorFallback = ({ error }: { error: Error }) => (
  <Alert variant="destructive">
    <AlertTitle>Error Processing Document</AlertTitle>
    <AlertDescription>
      We encountered an issue processing your document. Please try again later.
      {process.env.NODE_ENV !== 'production' && (
        <pre className="mt-2 text-xs">{error.message}</pre>
      )}
    </AlertDescription>
  </Alert>
);

// Add visualization wrapper component
const VisualizationWrapper: FC<{ children: React.ReactNode }> = ({ children }) => (
  <ErrorBoundary FallbackComponent={ErrorFallback}>
    <div className="relative">
      {children}
    </div>
  </ErrorBoundary>
);

// Component definitions
const ExportButton: FC<ExportButtonProps> = ({ auditId }) => {
  const { toast } = useToast();

  const generatePDFMutation = useMutation({
    mutationFn: async (auditId: string) => {
      const response = await fetch('/api/reports/compliance/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          auditId,
          config: {
            branding: {
              companyName: 'JurySync.io',
              primaryColor: '#10b981'
            }
          }
        })
      });

      if (!response.ok) {
        throw new Error('Failed to generate PDF report');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `compliance-audit-${auditId}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    },
    onSuccess: () => {
      toast({
        title: "Report Generated",
        description: "Your compliance audit report has been downloaded.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Report Generation Failed",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => generatePDFMutation.mutate(auditId)}
      disabled={generatePDFMutation.isPending}
      className="flex items-center gap-2"
    >
      {generatePDFMutation.isPending ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          Generating...
        </>
      ) : (
        <>
          <FileText className="h-4 w-4" />
          Export PDF Report
        </>
      )}
    </Button>
  );
};

const ComplianceAuditing: FC = () => {
  const { user, logoutMutation } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [documentText, setDocumentText] = useState("");
  const [selectedDocuments, setSelectedDocuments] = useState<string[]>([]);

  // Add dashboard insights query
  const { data: dashboardInsights, isLoading: isLoadingInsights } = useQuery<DashboardInsight>({
    queryKey: ['dashboard-insights'],
    queryFn: async () => {
      try {
        const response = await fetch('/api/compliance/dashboard-insights');
        if (!response.ok) {
          throw new Error('Failed to fetch dashboard insights');
        }
        return response.json();
      } catch (error) {
        console.error('Dashboard insights fetch error:', error);
        toast({
          title: "Error Loading Insights",
          description: "Failed to load dashboard insights. Please try again.",
          variant: "destructive"
        });
        return null;
      }
    },
    refetchInterval: 300000 // Refresh every 5 minutes
  });

  // Document analysis section
  const { data: uploadedDocuments = [], isLoading: isLoadingDocuments } = useQuery<UploadedDocument[]>({
    queryKey: ['uploaded-documents'],
    queryFn: async () => {
      try {
        const response = await fetch('/api/compliance/documents');
        if (!response.ok) {
          throw new Error('Failed to fetch documents');
        }
        return response.json();
      } catch (error) {
        console.error('Document fetch error:', error);
        toast({
          title: "Error Loading Documents",
          description: "Failed to load documents. Please try again.",
          variant: "destructive"
        });
        return [];
      }
    }
  });

  // Enhanced compliance results fetch
  const { data: complianceResults = [], isLoading: isLoadingResults } = useQuery<ComplianceResult[]>({
    queryKey: ['compliance-results', selectedDocuments],
    queryFn: async () => {
      if (selectedDocuments.length === 0) return [];

      try {
        const response = await fetch(`/api/compliance/results?documents=${selectedDocuments.join(',')}`);
        if (!response.ok) {
          throw new Error('Failed to fetch compliance results');
        }
        return response.json();
      } catch (error) {
        console.error('Compliance results fetch error:', error);
        toast({
          title: "Error Loading Results",
          description: "Failed to load compliance results. Please try again.",
          variant: "destructive"
        });
        return [];
      }
    },
    enabled: selectedDocuments.length > 0
  });

  const submitDocumentMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/orchestrator/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentText: documentText,
          metadata: {
            documentType: 'contract',
            priority: 'medium'
          }
        })
      });

      if (!response.ok) {
        throw new Error('Failed to analyze document');
      }

      return response.json();
    },
    onSuccess: () => {
      setDocumentText("");
      toast({
        title: "Document Submitted",
        description: "Starting compliance analysis...",
      });
      queryClient.invalidateQueries({ queryKey: ['compliance-results'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Submission Failed",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Document Input Component
  const DocumentInput = () => (
    <Card className="bg-white/80 backdrop-blur-lg">
      <CardHeader>
        <CardTitle>Document Input</CardTitle>
        <CardDescription>
          Paste your document text for compliance analysis
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <Textarea
            placeholder="Paste your document text here..."
            className="min-h-[300px] resize-none"
            value={documentText}
            onChange={(e) => setDocumentText(e.target.value)}
          />
          <Button
            className="w-full"
            disabled={!documentText.trim() || submitDocumentMutation.isPending}
            onClick={() => submitDocumentMutation.mutate()}
          >
            {submitDocumentMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Analyzing...
              </>
            ) : (
              <>
                <Shield className="h-4 w-4 mr-2" />
                Submit for Analysis
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  // Analysis Results Component
  const AnalysisResults = () => {
    if (isLoadingResults) {
      return (
        <div className="flex items-center justify-center h-96">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      );
    }

    if (!complianceResults.length) {
      return (
        <div className="text-center py-8">
          <p className="text-muted-foreground">No analysis results available</p>
        </div>
      );
    }

    return (
      <div className="space-y-8">
        {complianceResults.map((result) => (
          <div key={result.documentId} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Risk Trend Analysis */}
              <Card className="col-span-2">
                <CardHeader>
                  <CardTitle>Risk Trend Analysis</CardTitle>
                  <CardDescription>Risk scores across document sections</CardDescription>
                </CardHeader>
                <CardContent>
                  <VisualizationWrapper>
                    <div className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={result.visualizationData.riskTrend.map((score, i) => ({
                          section: `Section ${i + 1}`,
                          score
                        }))}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="section" />
                          <YAxis domain={[0, 10]} />
                          <RechartTooltip />
                          <Line type="monotone" dataKey="score" stroke="#10b981" strokeWidth={2} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </VisualizationWrapper>
                </CardContent>
              </Card>

              {/* Risk Score Summary */}
              <Card>
                <CardHeader>
                  <CardTitle>Risk Score Summary</CardTitle>
                  <CardDescription>Overall risk assessment</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Average Risk Score:</span>
                      <span className={`text-lg font-bold ${
                        result.riskScores.average > 7 ? 'text-red-600' :
                          result.riskScores.average > 4 ? 'text-yellow-600' : 'text-green-600'
                      }`}>
                        {result.riskScores.average.toFixed(1)}
                      </span>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span>High Risk Issues</span>
                        <span>{result.riskScores.distribution.high}</span>
                      </div>
                      <Progress
                        value={
                          (result.riskScores.distribution.high /
                            (result.riskScores.distribution.high +
                              result.riskScores.distribution.medium +
                              result.riskScores.distribution.low)) * 100
                        }
                        className="h-2"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Flagged Issues */}
            <Card>
              <CardHeader>
                <CardTitle>Compliance Issues</CardTitle>
                <CardDescription>Identified compliance concerns and recommendations</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {result.issues.map((issue, index) => (
                    <div
                      key={index}
                      className={`p-4 rounded-lg ${getRiskLevelColor(issue.severity)}`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <h4 className="font-medium">{issue.clause}</h4>
                          <p className="text-sm text-gray-600">{issue.description}</p>
                        </div>
                        <Badge variant={issue.severity === 'CRITICAL' ? 'destructive' : 'secondary'}>
                          {issue.severity}
                        </Badge>
                      </div>
                      <div className="mt-2 text-sm">
                        <p><strong>Recommendation:</strong> {issue.recommendation}</p>
                        {issue.reference && (
                          <p className="mt-1"><strong>Reference:</strong> {issue.reference}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        ))}
      </div>
    );
  };

  const startMonitoringMutation = useMutation({
    mutationFn: async (documentIds: string[]) => {
      const response = await fetch('/api/compliance/monitor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentIds })
      });

      if (!response.ok) {
        throw new Error('Failed to start monitoring');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['compliance-results'] });
      toast({
        title: "Monitoring Started",
        description: "Selected documents are now being monitored for compliance.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Monitoring Failed",
        description: error.message,
        variant: "destructive"
      });
    }
  });


  // Enhanced export functionality with proper error handling
  const handleExportReport = async () => {
    try {
      const response = await fetch('/api/compliance/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ results: complianceResults })
      });

      if (!response.ok) {
        throw new Error('Failed to generate export');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `compliance-audit-${new Date().toISOString()}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "Export Successful",
        description: "Your audit report has been downloaded.",
      });
    } catch (error) {
      toast({
        title: "Export Failed",
        description: error instanceof Error ? error.message : 'An unknown error occurred',
        variant: "destructive"
      });
    }
  };

  // Utility functions
  function getSeverityColor(severity: string) {
    switch (severity.toUpperCase()) {
      case 'CRITICAL': return 'bg-red-500 text-white';
      case 'WARNING': return 'bg-yellow-500 text-white';
      case 'INFO': return 'bg-blue-500 text-white';
      default: return 'bg-gray-500 text-white';
    }
  }

  function getRiskLevelColor(level: string) {
    switch (level.toUpperCase()) {
      case 'HIGH': return 'border-l-4 border-red-500 bg-red-50';
      case 'MEDIUM': return 'border-l-4 border-yellow-500 bg-yellow-50';
      case 'LOW': return 'border-l-4 border-green-500 bg-green-50';
      default: return 'border-l-4 border-gray-500 bg-gray-50';
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-yellow-50 to-green-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-lg border-b border-green-100">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link href="/dashboard" className="flex items-center space-x-4 hover:text-green-600">
              <Gavel className="h-6 w-6 text-green-600" />
              <h1 className="text-xl font-semibold">JurySync.io</h1>
            </Link>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">
              Welcome, {user?.firstName} {user?.lastName}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => logoutMutation.mutate()}
              disabled={logoutMutation.isPending}
            >
              {logoutMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <LogOut className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </header>

      {/* Dashboard Overview */}
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-7xl mx-auto space-y-6">
          <h2 className="text-2xl font-semibold mb-4">Dashboard Overview</h2>
          {isLoadingInsights ? (
            <div className="grid gap-4 md:grid-cols-3">
              {Array(3).fill(0).map((_, i) => (
                <Card key={i} className="bg-white/80 backdrop-blur-lg animate-pulse">
                  <CardHeader className="h-32" />
                </Card>
              ))}
            </div>
          ) : dashboardInsights ? (
            <>
              <div className="grid gap-4 md:grid-cols-3 mb-6">
                {dashboardInsights.trends.map((trend, index) => (
                  <Card key={index} className="bg-white/80 backdrop-blur-lg">
                    <CardHeader>
                      <CardTitle className="text-sm font-medium text-gray-500">
                        {trend.label}
                      </CardTitle>
                      <div className="flex items-center justify-between">
                        <div className="text-2xl font-bold">{trend.value}</div>
                        <div className={`flex items-center ${
                          trend.change > 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
                          <TrendingUp className="h-4 w-4 mr-1" />
                          {Math.abs(trend.change)}%
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-gray-600">{trend.insight}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                {/* Risk Distribution */}
                <Card className="bg-white/80 backdrop-blur-lg">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle>Risk Distribution</CardTitle>
                      <BarChart2 className="h-4 w-4 text-gray-400" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {dashboardInsights.riskDistribution.map((risk, index) => (
                        <div key={index}>
                          <div className="flex items-center justify-between text-sm">
                            <span>{risk.category}</span>
                            <span className="font-medium">{risk.percentage}%</span>
                          </div>
                          <Progress
                            value={risk.percentage}
                            className={`h-2 ${
                              risk.category === 'High Risk' ? 'bg-red-500' :
                                risk.category === 'Medium Risk' ? 'bg-yellow-500' :
                                  'bg-green-500'
                            }`}
                          />
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Key Recommendations */}
                <Card className="bg-white/80 backdrop-blur-lg">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle>Key Recommendations</CardTitle>
                      <ShieldAlert className="h-4 w-4 text-gray-400" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {dashboardInsights.recommendations.map((rec, index) => (
                        <div key={index} className="flex items-start gap-4">
                          <span className={`px-2 py-1 text-xs rounded-full ${
                            rec.priority === 'HIGH' ? 'bg-red-100 text-red-700' :
                              rec.priority === 'MEDIUM' ? 'bg-yellow-100 text-yellow-700' :
                                'bg-green-100 text-green-700'
                          }`}>
                            {rec.priority}
                          </span>
                          <div>
                            <p className="font-medium">{rec.action}</p>
                            <p className="text-sm text-gray-600">{rec.impact}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </>
          ) : (
            <p className="text-center text-gray-500">Unable to load dashboard insights</p>
          )}
        </div>
      </div>


      <main className="container mx-auto px-4 py-8">
        <div className="max-w-7xl mx-auto space-y-8">
          <div className="flex items-center gap-4 mb-8">
            <Shield className="h-8 w-8 text-green-600" />
            <h2 className="text-3xl font-bold">Compliance Auditing</h2>
          </div>

          {/* Document Input and Analysis */}
          <div className="grid gap-6 md:grid-cols-2">
            <DocumentInput />
            <AnalysisResults />
          </div>
        </div>
      </main>
    </div>
  );
};

export default ComplianceAuditing;