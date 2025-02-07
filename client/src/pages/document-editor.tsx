import { useState } from "react";
import { useParams } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Loader2, Save, FileDown, UserCheck, GitCompare } from "lucide-react";

export default function DocumentEditor() {
  const { id } = useParams();
  const { user } = useAuth();
  const { toast } = useToast();
  const [requirements, setRequirements] = useState("");

  // Fetch document
  const { data: document, isLoading } = useQuery({
    queryKey: ["/api/documents", id],
    enabled: !!id
  });

  // Generate draft mutation
  const generateDraftMutation = useMutation({
    mutationFn: async (requirements: string) => {
      const res = await apiRequest("POST", `/api/documents/${id}/generate-draft`, {
        requirements: [{
          type: "STANDARD",
          description: requirements,
          importance: "HIGH"
        }]
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries(["/api/documents", id]);
      toast({
        title: "Draft Generated",
        description: "Your contract draft has been updated based on the requirements."
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Generation Failed",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Request review mutation
  const requestReviewMutation = useMutation({
    mutationFn: async (approverId: number) => {
      const res = await apiRequest("POST", `/api/documents/${id}/request-review`, {
        approverId,
        comments: "Please review the latest draft"
      });
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Review Requested",
        description: "The document has been sent for review."
      });
    }
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-border" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>{document?.title}</span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.location.href = `/api/documents/${id}/download?format=docx`}
              >
                <FileDown className="h-4 w-4 mr-2" />
                Download
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const reviewerId = 1; // TODO: Add reviewer selection
                  requestReviewMutation.mutate(reviewerId);
                }}
              >
                <UserCheck className="h-4 w-4 mr-2" />
                Request Review
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6">
            {/* Requirements Input */}
            <div>
              <h3 className="text-lg font-semibold mb-2">Customize Requirements</h3>
              <Textarea
                placeholder="Enter your contract requirements and specific clauses needed..."
                value={requirements}
                onChange={(e) => setRequirements(e.target.value)}
                className="min-h-[100px]"
              />
              <Button
                className="mt-2"
                onClick={() => generateDraftMutation.mutate(requirements)}
                disabled={generateDraftMutation.isPending}
              >
                {generateDraftMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <GitCompare className="h-4 w-4 mr-2" />
                )}
                Generate Draft
              </Button>
            </div>

            {/* Document Content */}
            <div>
              <h3 className="text-lg font-semibold mb-2">Current Draft</h3>
              <div className="bg-muted p-4 rounded-md">
                <pre className="whitespace-pre-wrap font-mono text-sm">
                  {document?.content || "No content available"}
                </pre>
              </div>
            </div>

            {/* Version History */}
            {document?.analysis?.contractDetails?.workflowState?.versions && (
              <div>
                <h3 className="text-lg font-semibold mb-2">Version History</h3>
                <div className="space-y-2">
                  {document.analysis.contractDetails.workflowState.versions.map((version: any) => (
                    <div key={version.version} className="flex items-center justify-between p-2 bg-muted rounded-md">
                      <span>Version {version.version}</span>
                      <span className="text-sm text-muted-foreground">
                        {new Date(version.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
