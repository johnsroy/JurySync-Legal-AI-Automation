import React from 'react';
import { useAuth } from "@/hooks/use-auth";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Gavel, LogOut, Loader2, Shield, AlertTriangle, FileText } from "lucide-react";
import { useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

// Basic type definitions
interface QuickStats {
  characterCount: number;
  wordCount: number;
  lineCount: number;
  paragraphCount: number;
}

interface AuditResponse {
  taskId: string;
  status: 'processing' | 'completed' | 'error';
  data?: {
    quickStats?: QuickStats;
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

export const ComplianceAuditing: React.FC = () => {
  const { user, logoutMutation } = useAuth();
  const { toast } = useToast();
  const [documentText, setDocumentText] = useState("");
  const [taskId, setTaskId] = useState<string | null>(null);

  // Document submission mutation
  const submitDocument = useMutation({
    mutationFn: async () => {
      const payload = {
        type: 'compliance',
        data: {
          documentText: documentText.trim(),
          metadata: { timestamp: new Date().toISOString() }
        }
      };

      const response = await fetch('/api/orchestrator/audit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(payload)
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
        description: "Starting analysis...",
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

      const response = await fetch(`/api/orchestrator/audit/${taskId}/result`);
      if (!response.ok) {
        throw new Error('Failed to fetch results');
      }

      return response.json();
    },
    enabled: !!taskId,
    refetchInterval: taskId ? 2000 : false,
    retry: 3
  });

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
                    disabled={submitDocument.isPending || isLoading}
                  />
                  <Button
                    className="w-full"
                    disabled={!documentText.trim() || submitDocument.isPending || isLoading}
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
                    <div className="flex items-center justify-center space-x-4">
                      <Loader2 className="h-6 w-6 animate-spin text-primary" />
                      <p>Analyzing document...</p>
                    </div>
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