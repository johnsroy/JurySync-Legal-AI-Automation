import React from 'react';
import { useAuth } from "@/hooks/use-auth";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Gavel, LogOut, Loader2, Shield, AlertTriangle, FileText, Upload, File, BarChart2, RefreshCcw, CircleDot } from "lucide-react";
import { useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { useDropzone } from 'react-dropzone';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';

// Document cleaning utility
const cleanDocumentText = (text: string): string => {
  if (!text) return '';

  // Remove DOCTYPE and HTML tags
  return text
    .replace(/<!DOCTYPE\s+[^>]*>|<!doctype\s+[^>]*>/gi, '')
    .replace(/<\?xml\s+[^>]*\?>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

// Define interfaces for the compliance audit data
interface QuickStats {
  characterCount: number;
  wordCount: number;
  lineCount: number;
  paragraphCount: number;
}

interface RiskTrend {
  date: string;
  score: number;
}

interface IssueFrequency {
  category: string;
  count: number;
}

interface AuditIssue {
  id: string;
  description: string;
  riskScore: number;
  recommendation: string;
  category: string;
  regulatoryReference?: string;
  severity: 'low' | 'medium' | 'high';
}

interface AuditResponse {
  taskId: string;
  status: 'processing' | 'completed' | 'error';
  data?: {
    quickStats?: QuickStats;
    issues?: AuditIssue[];
    riskTrend?: RiskTrend[];
    issueFrequency?: IssueFrequency[];
    complianceScore?: number;
    recommendations?: string[];
  };
  error?: string;
  progress?: number;
}

// Enhanced FileUploadZone with preprocessing
const FileUploadZone: React.FC<{ onFileSelect: (files: File[]) => void }> = ({ onFileSelect }) => {
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      'application/pdf': ['.pdf'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'text/plain': ['.txt']
    },
    onDrop: async (acceptedFiles) => {
      // Process each file to extract and clean text content
      const processedFiles = acceptedFiles.map(async (file) => {
        if (file.type === 'text/plain') {
          const text = await file.text();
          const cleanedText = cleanDocumentText(text);
          // Create a new file with cleaned content
          return new File(
            [cleanedText],
            file.name,
            { type: 'text/plain' }
          );
        }
        return file;
      });

      const cleanedFiles = await Promise.all(processedFiles);
      onFileSelect(cleanedFiles);
    },
    multiple: true
  });

  return (
    <div
      {...getRootProps()}
      className={`
        border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all
        ${isDragActive
          ? 'border-green-500 bg-green-50'
          : 'border-gray-300 hover:border-green-400 hover:bg-gray-50'
        }
      `}
    >
      <input {...getInputProps()} />
      <Upload className={`mx-auto h-12 w-12 ${isDragActive ? 'text-green-500' : 'text-gray-400'}`} />
      <p className="mt-2 text-sm text-gray-600">
        {isDragActive
          ? "Drop your documents here..."
          : "Drag and drop your documents here, or click to select"}
      </p>
      <p className="text-xs text-gray-500 mt-1">
        Supports PDF, DOCX, DOC, and TXT files
      </p>
    </div>
  );
};

// Performance metrics component
const PerformanceMetrics: React.FC<{ data: AuditResponse['data'] }> = ({ data }) => (
  <Card className="bg-white/80 backdrop-blur-lg">
    <CardHeader>
      <CardTitle>Performance Metrics</CardTitle>
      <CardDescription>Key improvements and efficiency gains</CardDescription>
    </CardHeader>
    <CardContent>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-lg bg-green-50">
          <p className="text-2xl font-bold text-green-600">80%</p>
          <p className="text-sm text-gray-600">Tasks Automated</p>
        </div>
        <div className="p-4 rounded-lg bg-blue-50">
          <p className="text-2xl font-bold text-blue-600">70%</p>
          <p className="text-sm text-gray-600">Processing Time Reduction</p>
        </div>
        <div className="p-4 rounded-lg bg-purple-50">
          <p className="text-2xl font-bold text-purple-600">30-50%</p>
          <p className="text-sm text-gray-600">Labor Savings</p>
        </div>
        <div className="p-4 rounded-lg bg-yellow-50">
          <p className="text-2xl font-bold text-yellow-600">
            {data?.complianceScore || 60}%
          </p>
          <p className="text-sm text-gray-600">Compliance Score</p>
        </div>
      </div>
    </CardContent>
  </Card>
);

// Add new components for better visualization
function AnalyticsSummary({ data }: { data: AuditResponse['data'] }) {
  return (
    <Card className="bg-white/80 backdrop-blur-lg">
      <CardHeader>
        <CardTitle>Analysis Summary</CardTitle>
        <CardDescription>Quick overview of document analysis</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {data?.quickStats && (
            <>
              <div className="p-4 rounded-lg bg-blue-50">
                <p className="text-lg font-semibold text-blue-600">
                  {data.quickStats.wordCount.toLocaleString()}
                </p>
                <p className="text-sm text-gray-600">Words Analyzed</p>
              </div>
              <div className="p-4 rounded-lg bg-green-50">
                <p className="text-lg font-semibold text-green-600">
                  {data.quickStats.paragraphCount.toLocaleString()}
                </p>
                <p className="text-sm text-gray-600">Paragraphs</p>
              </div>
              <div className="p-4 rounded-lg bg-purple-50">
                <p className="text-lg font-semibold text-purple-600">
                  {Math.round((data.quickStats.characterCount / data.quickStats.wordCount) * 10) / 10}
                </p>
                <p className="text-sm text-gray-600">Avg Word Length</p>
              </div>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// Add trends visualization
function TrendsVisualization({ data }: { data: AuditResponse['data'] }) {
  if (!data?.riskTrend?.length) return null;

  return (
    <Card className="bg-white/80 backdrop-blur-lg">
      <CardHeader>
        <CardTitle>Risk Trends</CardTitle>
        <CardDescription>Historical compliance risk analysis</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data.riskTrend}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Line
                type="monotone"
                dataKey="score"
                stroke="#2563eb"
                strokeWidth={2}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

// Add issue distribution chart
function IssueDistribution({ data }: { data: AuditResponse['data'] }) {
  if (!data?.issueFrequency?.length) return null;

  return (
    <Card className="bg-white/80 backdrop-blur-lg">
      <CardHeader>
        <CardTitle>Issue Distribution</CardTitle>
        <CardDescription>Breakdown of compliance issues by category</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.issueFrequency}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="category" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="count" fill="#2563eb" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}


// Add loading animation components
function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-primary" />
    </div>
  );
}

function ProcessingStage({ stage, isActive }: { stage: string; isActive: boolean }) {
  return (
    <div className={`flex items-center gap-2 ${isActive ? 'text-primary' : 'text-muted-foreground'}`}>
      {isActive ? (
        <CircleDot className="h-4 w-4 animate-pulse" />
      ) : (
        <div className="h-4 w-4 rounded-full border" />
      )}
      <span className="text-sm">{stage}</span>
    </div>
  );
}

function DocumentProcessingStatus({ progress }: { progress: number }) {
  const stages = [
    'Document Analysis',
    'Risk Assessment',
    'Compliance Check',
    'Report Generation'
  ];

  const currentStage = Math.floor((progress / 100) * stages.length);

  return (
    <div className="space-y-4">
      <Progress value={progress} className="h-2">
        <div
          className="h-full bg-primary transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </Progress>
      <div className="grid grid-cols-2 gap-4">
        {stages.map((stage, index) => (
          <ProcessingStage
            key={stage}
            stage={stage}
            isActive={index === currentStage}
          />
        ))}
      </div>
    </div>
  );
}

// Update the main component's results display section
export const ComplianceAuditing: React.FC = () => {
  const { user, logoutMutation } = useAuth();
  const { toast } = useToast();
  const [documentText, setDocumentText] = useState("");
  const [taskId, setTaskId] = useState<string | null>(null);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);

  // Document submission mutation with enhanced error handling
  const submitDocument = useMutation({
    mutationFn: async () => {
      try {
        const formData = new FormData();

        // Clean text input if present
        if (documentText) {
          const cleanedText = cleanDocumentText(documentText);
          formData.append('text', cleanedText);
        }

        // Add files
        uploadedFiles.forEach(file => formData.append('files', file));

        const response = await fetch('/api/compliance/audit', {
          method: 'POST',
          body: formData
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.message || 'Failed to submit document');
        }

        return response.json();
      } catch (error: any) {
        console.error('Document submission error:', error);
        throw new Error(error.message || 'An error occurred while submitting the document');
      }
    },
    onSuccess: (data: AuditResponse) => {
      setTaskId(data.taskId);
      toast({
        title: "Document Submitted",
        description: "Starting compliance analysis...",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Submission Failed",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Results polling query with better error handling
  const { data: result, isLoading } = useQuery<AuditResponse>({
    queryKey: ['audit-result', taskId],
    queryFn: async () => {
      if (!taskId) return null;

      try {
        const response = await fetch(`/api/compliance/audit/${taskId}/result`);
        if (!response.ok) {
          throw new Error('Failed to fetch results');
        }

        return response.json();
      } catch (error: any) {
        console.error('Error fetching audit results:', error);
        throw new Error('Failed to fetch audit results');
      }
    },
    enabled: !!taskId,
    refetchInterval: (data) =>
      data?.status === 'processing' ? 2000 : false,
    retry: 3
  });

  // Enhanced file selection handler with validation
  const handleFileSelect = (files: File[]) => {
    if (files.length > 5) {
      toast({
        title: "Too Many Files",
        description: "Please upload a maximum of 5 files at once",
        variant: "destructive"
      });
      return;
    }

    const totalSize = files.reduce((sum, file) => sum + file.size, 0);
    if (totalSize > 10 * 1024 * 1024) { // 10MB limit
      toast({
        title: "Files Too Large",
        description: "Total file size should not exceed 10MB",
        variant: "destructive"
      });
      return;
    }

    setUploadedFiles(files);
    toast({
      title: "Files Added",
      description: `${files.length} file(s) ready for upload`,
    });
  };

  const handleClearForm = () => {
    setDocumentText("");
    setUploadedFiles([]);
    setTaskId(null);
  };

  const handleRetry = () => {
    setTaskId(null);
    submitDocument.mutate();
  };

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

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="flex items-center gap-4 mb-8">
            <Shield className="h-8 w-8 text-green-600" />
            <h2 className="text-3xl font-bold">Compliance Auditing</h2>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Document Input */}
            <Card className="bg-white/80 backdrop-blur-lg">
              <CardHeader>
                <CardTitle>Document Input</CardTitle>
                <CardDescription>
                  Upload files or paste text for compliance analysis
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <FileUploadZone onFileSelect={handleFileSelect} />

                  {uploadedFiles.length > 0 && (
                    <div className="mt-4">
                      <h4 className="text-sm font-medium mb-2">Selected Files:</h4>
                      <ul className="space-y-2">
                        {uploadedFiles.map((file, index) => (
                          <li key={index} className="flex items-center gap-2 text-sm">
                            <File className="h-4 w-4" />
                            {file.name}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="relative">
                    <Textarea
                      placeholder="Or paste your document text here..."
                      className="min-h-[200px] resize-none"
                      value={documentText}
                      onChange={(e) => setDocumentText(e.target.value)}
                      disabled={submitDocument.isPending || isLoading}
                    />
                  </div>

                  <div className="flex gap-2">
                    <Button
                      className="flex-1"
                      disabled={(!documentText.trim() && uploadedFiles.length === 0) || submitDocument.isPending || isLoading}
                      onClick={() => submitDocument.mutate()}
                    >
                      {submitDocument.isPending ? (
                        <div className="flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span className="animate-pulse">Analyzing Document...</span>
                        </div>
                      ) : (
                        <>
                          <Shield className="h-4 w-4 mr-2" />
                          Submit for Analysis
                        </>
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={handleClearForm}
                      disabled={submitDocument.isPending || isLoading}
                    >
                      Clear
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Results Display */}
            <div className="space-y-4">
              {/* Performance Metrics */}
              {result?.status === 'completed' && (
                <PerformanceMetrics data={result.data} />
              )}

              {/* Loading State */}
              {isLoading && (
                <Card className="bg-white/80 backdrop-blur-lg">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <RefreshCcw className="h-5 w-5 animate-spin" />
                      Processing Document
                    </CardTitle>
                    <CardDescription>
                      Analyzing content and generating compliance report
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <DocumentProcessingStatus progress={result?.progress || 30} />

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="p-4 bg-primary/5 rounded-lg animate-pulse">
                        <div className="h-6 w-24 bg-primary/10 rounded mb-2" />
                        <div className="h-4 w-16 bg-primary/10 rounded" />
                      </div>
                      <div className="p-4 bg-primary/5 rounded-lg animate-pulse delay-150">
                        <div className="h-6 w-24 bg-primary/10 rounded mb-2" />
                        <div className="h-4 w-16 bg-primary/10 rounded" />
                      </div>
                      <div className="p-4 bg-primary/5 rounded-lg animate-pulse delay-300">
                        <div className="h-6 w-24 bg-primary/10 rounded mb-2" />
                        <div className="h-4 w-16 bg-primary/10 rounded" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Error State */}
              {result?.error && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Analysis Failed</AlertTitle>
                  <AlertDescription>
                    {result.error}
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-2"
                      onClick={handleRetry}
                    >
                      Retry Analysis
                    </Button>
                  </AlertDescription>
                </Alert>
              )}

              {/* Enhanced Results Display */}
              {result?.status === 'completed' && result.data && (
                <div className="space-y-6">
                  {/* Analytics Summary */}
                  <AnalyticsSummary data={result.data} />

                  {/* Risk Trends */}
                  <TrendsVisualization data={result.data} />

                  {/* Issue Distribution */}
                  <IssueDistribution data={result.data} />

                  {/* Detailed Issues List */}
                  <Card className="bg-white/80 backdrop-blur-lg">
                    <CardHeader>
                      <CardTitle className="flex items-center justify-between">
                        <span>Compliance Issues</span>
                        {result.data.issues && (
                          <Badge variant="outline" className="ml-2">
                            {result.data.issues.length} found
                          </Badge>
                        )}
                      </CardTitle>
                      <CardDescription>
                        Detailed analysis of potential compliance issues
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ScrollArea className="h-[400px] pr-4">
                        <div className="space-y-4">
                          {result.data.issues?.map((issue) => (
                            <Card key={issue.id} className="bg-white">
                              <CardContent className="pt-6">
                                <div className="flex items-start justify-between gap-4">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-2">
                                      <Badge
                                        variant={
                                          issue.severity === 'high' ? 'destructive' :
                                            issue.severity === 'medium' ? 'default' : 'secondary'
                                        }
                                      >
                                        {issue.severity}
                                      </Badge>
                                      <Badge variant="outline">{issue.category}</Badge>
                                      <Badge variant={
                                        issue.riskScore > 7 ? "destructive" :
                                          issue.riskScore > 4 ? "default" : "secondary"
                                      }>
                                        Risk: {issue.riskScore}
                                      </Badge>
                                    </div>
                                    <p className="text-sm text-gray-600">{issue.description}</p>
                                    {issue.regulatoryReference && (
                                      <p className="text-sm text-gray-500 mt-1">
                                        Reference: {issue.regulatoryReference}
                                      </p>
                                    )}
                                    <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                                      <p className="text-sm font-medium text-gray-900">Recommendation:</p>
                                      <p className="text-sm text-gray-600 mt-1">{issue.recommendation}</p>
                                    </div>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      </ScrollArea>
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* Empty State */}
              {!result && !isLoading && (
                <div className="flex items-center justify-center h-96 border rounded-lg bg-white/50 backdrop-blur-sm">
                  <div className="text-center space-y-2">
                    <FileText className="h-12 w-12 text-muted-foreground mx-auto" />
                    <p className="text-muted-foreground">
                      Submit a document to see analysis results
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default ComplianceAuditing;