import { useAuth } from "@/hooks/use-auth";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Gavel, LogOut, Loader2, Shield, AlertTriangle, CheckCircle, Info } from "lucide-react";
import { useState } from "react";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { BarChart2, TrendingUp, ShieldAlert, Download } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";

// Interfaces remain the same...

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
}

interface DashboardInsights {
  summary: string;
  trends: {
    label: string;
    value: number;
    change: number;
    insight: string;
  }[];
  riskDistribution: {
    category: string;
    count: number;
    percentage: number;
  }[];
  recommendations: {
    priority: 'HIGH' | 'MEDIUM' | 'LOW';
    action: string;
    impact: string;
  }[];
}

export default function ComplianceAuditing() {
  const { user, logoutMutation } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [documentText, setDocumentText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedDocuments, setSelectedDocuments] = useState<string[]>([]);

  // Fetch uploaded documents with new parsing - this part is kept mostly the same, but the use case changes
  const { data: uploadedDocuments = [], isLoading: isLoadingDocuments } = useQuery({
    queryKey: ['uploaded-documents'],
    queryFn: async () => {
      const response = await fetch('/api/compliance/documents');
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText.startsWith('Error:') ? errorText.slice(6) : errorText);
      }
      const text = await response.text();

      // Parse the new text format
      return text.split('---')
        .filter(block => block.trim())
        .map(block => {
          const lines = block.trim().split('\n');
          const documentId = lines.find(l => l.startsWith('Document:'))?.split(': ')[1] || '';
          const title = lines.find(l => l.startsWith('Title:'))?.split(': ')[1] || '';
          const status = lines.find(l => l.startsWith('Status:'))?.split(': ')[1] || '';

          return {
            id: documentId,
            name: title,
            status,
            uploadedAt: new Date().toISOString()
          };
        });
    }
  });

  // Fetch compliance results
  const { data: complianceResults = [], isLoading: isLoadingResults } = useQuery({
    queryKey: ['compliance-results', selectedDocuments],
    queryFn: async () => {
      // If no documents are selected but we have uploaded documents,
      // use the first document by default
      const documentsToMonitor = selectedDocuments.length === 0 && uploadedDocuments.length > 0
        ? [uploadedDocuments[0].id]
        : selectedDocuments;

      if (documentsToMonitor.length === 0) return [];

      const response = await fetch(`/api/compliance/results?documents=${documentsToMonitor.join(',')}`);
      if (!response.ok) throw new Error('Failed to fetch compliance results');
      const data = await response.json();
      console.log('Fetched compliance results:', data);
      return data as ComplianceResult[];
    },
    enabled: uploadedDocuments.length > 0,
    refetchInterval: 30000 // Refresh every 30 seconds
  });

  // Submit document mutation
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
        const errorText = await response.text();
        if (errorText.includes('<!DOCTYPE>')) {
          throw new Error('Server error occurred. Please try again.');
        }
        throw new Error(errorText.startsWith('Error:') ? errorText.slice(6) : errorText);
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

  // Start monitoring mutation -  This part is kept, but the trigger changes
  const startMonitoringMutation = useMutation({
    mutationFn: async (documentIds: string[]) => {
      const response = await fetch('/api/compliance/monitor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentIds })
      });
      if (!response.ok) throw new Error('Failed to start monitoring');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['compliance-results'] });
      toast({
        title: "Monitoring Started",
        description: "Selected documents are now being monitored for compliance.",
      });
    }
  });

  const { data: dashboardInsights, isLoading: isLoadingInsights } = useQuery<DashboardInsights>({
    queryKey: ['compliance-insights'],
    queryFn: async () => {
      const response = await fetch('/api/compliance/dashboard-insights');
      if (!response.ok) throw new Error('Failed to fetch dashboard insights');
      return response.json();
    },
    refetchInterval: 300000, // Refresh every 5 minutes
  });


  // Add export functionality
  const handleExportReport = async () => {
    try {
      const response = await fetch('/api/compliance/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ results: complianceResults })
      });

      if (!response.ok) throw new Error('Failed to generate export');

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
        description: error.message,
        variant: "destructive"
      });
    }
  };

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
      <div className="mb-8">
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
                        <div className="h-2 bg-gray-100 rounded-full mt-1">
                          <div
                            className="h-full bg-green-500 rounded-full"
                            style={{ width: `${risk.percentage}%` }}
                          />
                        </div>
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


      <main className="container mx-auto px-4 py-16">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center gap-4 mb-8">
            <Shield className="h-8 w-8 text-green-600" />
            <h2 className="text-3xl font-bold">Compliance Auditing</h2>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {/* Document Input Section */}
            <div className="space-y-6">
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
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <Shield className="h-4 w-4 mr-2" />
                      )}
                      Submit for Analysis
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Document Selection */}
              <Card className="bg-white/80 backdrop-blur-lg">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Uploaded Documents</CardTitle>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger>
                          <Info className="h-4 w-4 text-gray-400" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="max-w-xs">
                            Select documents to monitor for compliance.
                            The system will continuously scan these documents
                            for regulatory updates and compliance issues.
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                </CardHeader>
                <CardContent>
                  {isLoadingDocuments ? (
                    <div className="flex items-center justify-center p-8">
                      <Loader2 className="h-8 w-8 animate-spin text-green-600" />
                    </div>
                  ) : uploadedDocuments.length === 0 ? (
                    <p className="text-center text-gray-500 py-8">
                      No documents uploaded yet
                    </p>
                  ) : (
                    <div className="space-y-4">
                      {uploadedDocuments.map((doc) => (
                        <div key={doc.id} className="flex items-center space-x-3">
                          <Checkbox
                            checked={selectedDocuments.includes(doc.id)}
                            onCheckedChange={(checked) => {
                              setSelectedDocuments(prev =>
                                checked
                                  ? [...prev, doc.id]
                                  : prev.filter(id => id !== doc.id)
                              );
                            }}
                          />
                          <div className="flex-1">
                            <p className="text-sm font-medium">{doc.name}</p>
                            <p className="text-xs text-gray-500">
                              Uploaded: {new Date(doc.uploadedAt).toLocaleDateString()}
                            </p>
                          </div>
                          <Badge
                            variant={doc.status === "ERROR" ? "destructive" : "default"}
                          >
                            {doc.status}
                          </Badge>
                        </div>
                      ))}
                      <Button
                        className="w-full mt-4"
                        disabled={selectedDocuments.length === 0 || startMonitoringMutation.isPending}
                        onClick={() => startMonitoringMutation.mutate(selectedDocuments)}
                      >
                        {startMonitoringMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : (
                          <Shield className="h-4 w-4 mr-2" />
                        )}
                        Start Monitoring Selected
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Monitoring Dashboard */}
            <Card className="bg-white/80 backdrop-blur-lg">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Audit Results</CardTitle>
                  {complianceResults.length > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleExportReport}
                      className="flex items-center gap-2"
                    >
                      <Download className="h-4 w-4" />
                      Export Report
                    </Button>
                  )}
                </div>
                <CardDescription>
                  Compliance audit results and risk analysis
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoadingResults ? (
                  <div className="flex flex-col items-center justify-center p-8 space-y-4">
                    <Loader2 className="h-8 w-8 animate-spin text-green-600" />
                    <p className="text-sm text-gray-500">Analyzing document...</p>
                  </div>
                ) : uploadedDocuments.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    Submit a document to begin analysis
                  </div>
                ) : complianceResults.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    No monitoring results available yet
                  </div>
                ) : (
                  <ScrollArea className="h-[600px] pr-4">
                    {complianceResults.map((result) => (
                      <div
                        key={result.documentId}
                        className={`mb-6 p-4 rounded-lg ${getRiskLevelColor(result.riskLevel)}`}
                      >
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-2">
                            <Badge
                              variant={result.riskLevel === "HIGH" ? "destructive" : "default"}
                              className="uppercase"
                            >
                              {result.riskLevel} RISK
                            </Badge>
                            <span className="text-sm font-medium">
                              Compliance Score: {result.score}/100
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger>
                                  <Info className="h-4 w-4 text-gray-400" />
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p className="max-w-xs">
                                    Last checked: {new Date(result.lastChecked).toLocaleString()}
                                  </p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </div>
                        </div>

                        <div className="bg-white/80 rounded-lg p-4 mb-4">
                          <h4 className="text-sm font-medium mb-2">Summary</h4>
                          <p className="text-sm text-gray-700">{result.summary}</p>
                        </div>

                        <div className="space-y-4">
                          {result.issues.map((issue, index) => (
                            <div
                              key={index}
                              className="bg-white/80 rounded-lg p-4 border border-gray-100"
                            >
                              <div className="flex items-start gap-3">
                                <Badge className={getSeverityColor(issue.severity)}>
                                  {issue.severity}
                                </Badge>
                                <div className="flex-1">
                                  <h4 className="font-medium text-gray-900 mb-1">
                                    {issue.clause}
                                  </h4>
                                  <p className="text-sm text-gray-600 mb-2">
                                    {issue.description}
                                  </p>
                                  <div className="bg-green-50 p-3 rounded-lg">
                                    <h5 className="text-sm font-medium text-green-700 mb-1">
                                      Recommendation
                                    </h5>
                                    <p className="text-sm text-green-600">
                                      {issue.recommendation}
                                    </p>
                                  </div>
                                  {issue.reference && (
                                    <p className="text-xs text-gray-500 mt-2">
                                      Reference: {issue.reference}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}