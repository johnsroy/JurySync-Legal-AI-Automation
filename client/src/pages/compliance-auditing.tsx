import { useAuth } from "@/hooks/use-auth";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Gavel, LogOut, Loader2, Shield, Upload, AlertTriangle, CheckCircle, Info } from "lucide-react";
import { useDropzone } from "react-dropzone";
import { useState } from "react";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

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

export default function ComplianceAuditing() {
  const { user, logoutMutation } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedDocuments, setSelectedDocuments] = useState<string[]>([]);

  // Fetch uploaded documents
  const { data: uploadedDocuments = [], isLoading: isLoadingDocuments } = useQuery({
    queryKey: ['uploaded-documents'],
    queryFn: async () => {
      const response = await fetch('/api/compliance/documents');
      if (!response.ok) throw new Error('Failed to fetch documents');
      const data = await response.json();
      console.log('Fetched documents:', data);
      return data as UploadedDocument[];
    }
  });

  // Modified upload handler with proper FormData handling
  const onDrop = async (acceptedFiles: File[]) => {
    setIsUploading(true);
    setUploadProgress(0);

    try {
      for (let i = 0; i < acceptedFiles.length; i++) {
        const file = acceptedFiles[i];
        const formData = new FormData();
        formData.append('file', file);

        const interval = setInterval(() => {
          setUploadProgress((prev) => Math.min(prev + 10, 90));
        }, 500);

        console.log('Uploading file:', file.name);

        const response = await fetch('/api/compliance/upload', {
          method: 'POST',
          body: formData,
          // Don't set Content-Type header, let the browser set it with the boundary
        });

        clearInterval(interval);
        setUploadProgress(100);

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Upload failed');
        }

        const { documentId } = await response.json();
        console.log('Document uploaded:', documentId);

        // Refresh the documents list
        await queryClient.invalidateQueries({ queryKey: ['uploaded-documents'] });

        // Auto-monitor the first document
        if (uploadedDocuments.length === 0) {
          startMonitoringMutation.mutate([documentId]);
        }

        toast({
          title: "Document Uploaded",
          description: "Starting compliance analysis...",
        });
      }
    } catch (error: any) {
      console.error('Upload error:', error);
      toast({
        title: "Upload Failed",
        description: error.message || "Could not upload document for analysis.",
        variant: "destructive"
      });
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'text/plain': ['.txt']
    }
  });

  // Fetch compliance results for selected documents
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

  // Start monitoring mutation
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

  function getSeverityColor(severity: string) {
    switch (severity) {
      case 'CRITICAL': return 'bg-red-500';
      case 'WARNING': return 'bg-yellow-500';
      case 'INFO': return 'bg-blue-500';
      default: return 'bg-gray-500';
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

      <main className="container mx-auto px-4 py-16">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center gap-4 mb-8">
            <Shield className="h-8 w-8 text-green-600" />
            <h2 className="text-3xl font-bold">Compliance Auditing</h2>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {/* Upload and Document Selection Section */}
            <div className="space-y-6">
              <Card className="bg-white/80 backdrop-blur-lg">
                <CardHeader>
                  <CardTitle>Document Upload</CardTitle>
                  <CardDescription>
                    Upload documents for continuous compliance monitoring
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div
                    {...getRootProps()}
                    className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                      isDragActive ? 'border-green-500 bg-green-50' : 'border-gray-300'
                    }`}
                  >
                    <input {...getInputProps()} />
                    <Upload className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                    {isDragActive ? (
                      <p className="text-green-600">Drop the files here...</p>
                    ) : (
                      <p className="text-gray-600">
                        Drag & drop files here, or click to select
                      </p>
                    )}
                    <p className="text-sm text-gray-500 mt-2">
                      Supports PDF, DOC, DOCX, and TXT files
                    </p>
                  </div>
                  {isUploading && (
                    <div className="mt-4">
                      <Progress value={uploadProgress} className="h-2" />
                      <p className="text-sm text-center mt-2 text-gray-600">
                        Uploading... {uploadProgress}%
                      </p>
                    </div>
                  )}
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
                  <CardTitle>Monitoring Dashboard</CardTitle>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger>
                        <Info className="h-4 w-4 text-gray-400" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="max-w-xs">
                          Real-time compliance monitoring results.
                          View risk levels, compliance scores, and detailed
                          analysis of potential issues in your documents.
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <CardDescription>
                  Real-time compliance monitoring status
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoadingResults ? (
                  <div className="flex items-center justify-center p-8">
                    <Loader2 className="h-8 w-8 animate-spin text-green-600" />
                  </div>
                ) : uploadedDocuments.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    Upload a document to begin monitoring
                  </div>
                ) : complianceResults.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    No monitoring results available yet
                  </div>
                ) : (
                  <ScrollArea className="h-[600px] pr-4">
                    {complianceResults.map((result) => (
                      <div key={result.documentId} className="mb-6 p-4 border rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <Badge
                            variant={result.riskLevel === "HIGH" ? "destructive" : "default"}
                          >
                            {result.riskLevel} RISK
                          </Badge>
                          <span className="text-sm text-gray-500">
                            Score: {result.score}/100
                          </span>
                        </div>
                        <p className="text-sm text-gray-700 mb-4">{result.summary}</p>
                        {result.issues.map((issue, index) => (
                          <div key={index} className="mb-2 text-sm">
                            <div className="flex items-start gap-2">
                              <Badge className={getSeverityColor(issue.severity)}>
                                {issue.severity}
                              </Badge>
                              <div>
                                <p className="font-medium">{issue.clause}</p>
                                <p className="text-gray-600">{issue.description}</p>
                                <p className="text-green-600 mt-1">
                                  Recommendation: {issue.recommendation}
                                </p>
                              </div>
                            </div>
                          </div>
                        ))}
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