import React from 'react';
import { useAuth } from "@/hooks/use-auth";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Gavel, LogOut, Loader2, Shield, AlertTriangle, FileText, Upload, File, BarChart2 } from "lucide-react";
import { useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { useDropzone } from 'react-dropzone';

// Basic type definitions
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
}

interface AuditResponse {
  taskId: string;
  status: 'processing' | 'completed' | 'error';
  data?: {
    quickStats?: QuickStats;
    issues?: AuditIssue[];
    riskTrend?: RiskTrend[];
    issueFrequency?: IssueFrequency[];
  };
  error?: string;
}

// QuickStats component
const QuickStats: React.FC<{ stats: QuickStats }> = ({ stats }) => (
  <Card className="bg-white/80 backdrop-blur-lg">
    <CardHeader>
      <CardTitle>Document Statistics</CardTitle>
      <CardDescription>Quick analysis of document structure</CardDescription>
    </CardHeader>
    <CardContent>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-sm font-medium text-gray-500">Characters</p>
          <p className="text-2xl font-bold">{stats.characterCount.toLocaleString()}</p>
        </div>
        <div>
          <p className="text-sm font-medium text-gray-500">Words</p>
          <p className="text-2xl font-bold">{stats.wordCount.toLocaleString()}</p>
        </div>
        <div>
          <p className="text-sm font-medium text-gray-500">Lines</p>
          <p className="text-2xl font-bold">{stats.lineCount.toLocaleString()}</p>
        </div>
        <div>
          <p className="text-sm font-medium text-gray-500">Paragraphs</p>
          <p className="text-2xl font-bold">{stats.paragraphCount.toLocaleString()}</p>
        </div>
      </div>
    </CardContent>
  </Card>
);

// File Upload Zone component
const FileUploadZone: React.FC<{ onFileSelect: (files: File[]) => void }> = ({ onFileSelect }) => {
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      'application/pdf': ['.pdf'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'text/plain': ['.txt']
    },
    onDrop: onFileSelect
  });

  return (
    <div
      {...getRootProps()}
      className={`
        border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
        ${isDragActive ? 'border-green-500 bg-green-50' : 'border-gray-300 hover:border-green-400'}
      `}
    >
      <input {...getInputProps()} />
      <Upload className="mx-auto h-12 w-12 text-gray-400" />
      <p className="mt-2 text-sm text-gray-600">
        {isDragActive
          ? "Drop the files here..."
          : "Drag 'n' drop files here, or click to select files"}
      </p>
      <p className="text-xs text-gray-500 mt-1">
        Supports PDF, DOCX, DOC, and TXT files
      </p>
    </div>
  );
};

export const ComplianceAuditing: React.FC = () => {
  const { user, logoutMutation } = useAuth();
  const { toast } = useToast();
  const [documentText, setDocumentText] = useState("");
  const [taskId, setTaskId] = useState<string | null>(null);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);

  // Document submission mutation
  const submitDocument = useMutation({
    mutationFn: async () => {
      const formData = new FormData();
      uploadedFiles.forEach(file => formData.append('files', file));
      formData.append('text', documentText);
      formData.append('metadata', JSON.stringify({ timestamp: new Date().toISOString() }));

      const response = await fetch('/api/compliance/audit', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to submit document');
      }

      return response.json();
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

  // Results polling query
  const { data: result, isLoading } = useQuery<AuditResponse>({
    queryKey: ['audit-result', taskId],
    queryFn: async () => {
      if (!taskId) return null;

      const response = await fetch(`/api/compliance/audit/${taskId}/result`);
      if (!response.ok) {
        throw new Error('Failed to fetch results');
      }

      return response.json();
    },
    enabled: !!taskId,
    refetchInterval: taskId ? 2000 : false,
    retry: 3
  });

  // Handle file selection
  const handleFileSelect = (files: File[]) => {
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

          <div className="grid gap-6 md:grid-cols-2">
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
                        <>
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          Submitting...
                        </>
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
              {/* Quick Stats */}
              {result?.data?.quickStats && (
                <QuickStats stats={result.data.quickStats} />
              )}

              {/* Loading State */}
              {isLoading && (
                <Card className="bg-white/80 backdrop-blur-lg">
                  <CardContent className="pt-6">
                    <div className="space-y-4">
                      <div className="flex items-center justify-center space-x-4">
                        <Loader2 className="h-6 w-6 animate-spin text-primary" />
                        <p>Analyzing document...</p>
                      </div>
                      <Progress value={30} className="w-full" />
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

              {/* Results */}
              {result?.data?.issues && (
                <Card className="bg-white/80 backdrop-blur-lg">
                  <CardHeader>
                    <CardTitle>Compliance Issues</CardTitle>
                    <CardDescription>
                      Found {result.data.issues.length} potential compliance issues
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-[400px] pr-4">
                      <div className="space-y-4">
                        {result.data.issues.map((issue) => (
                          <Card key={issue.id} className="bg-white">
                            <CardContent className="pt-6">
                              <div className="flex items-start justify-between gap-4">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-2">
                                    <Badge
                                      variant={issue.riskScore > 7 ? "destructive" : issue.riskScore > 4 ? "default" : "secondary"}
                                    >
                                      Risk Score: {issue.riskScore}
                                    </Badge>
                                    <Badge variant="outline">{issue.category}</Badge>
                                  </div>
                                  <p className="text-sm text-gray-600">{issue.description}</p>
                                  <p className="text-sm font-medium mt-2">Recommendation:</p>
                                  <p className="text-sm text-gray-600">{issue.recommendation}</p>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
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