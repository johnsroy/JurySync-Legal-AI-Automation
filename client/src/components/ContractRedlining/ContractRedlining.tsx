import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface ClauseAnalysis {
  clauseId: string;
  originalText: string;
  riskScore: number;
  suggestedText: string;
  version: number;
  riskLevel: "HIGH" | "MEDIUM" | "LOW";
  explanation: string;
  category: string;
  impact: string;
  confidence: number;
}

interface ContractRedliningProps {
  initialContent: string;
}

interface ApiResponse<T> {
  success: boolean;
  analysis?: T;
  error?: string;
}

export function ContractRedlining({ initialContent }: ContractRedliningProps) {
  const [clauses, setClauses] = useState<ClauseAnalysis[]>([]);
  const [selectedClause, setSelectedClause] = useState<ClauseAnalysis | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { toast } = useToast();

  const analyzeContract = async () => {
    setIsLoading(true);
    try {
      const response = await apiRequest<ApiResponse<ClauseAnalysis[]>>("/api/contract-analysis/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: initialContent }),
      });

      if (response.success && response.analysis) {
        setClauses(response.analysis);
      } else {
        throw new Error(response.error || "Failed to analyze contract");
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to analyze contract",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const updateClause = async (clauseId: string, newContent: string) => {
    try {
      const response = await apiRequest<ApiResponse<ClauseAnalysis>>(`/api/contract-analysis/clauses/${clauseId}/update`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: newContent }),
      });

      if (response.success && response.analysis) {
        setClauses((prev) =>
          prev.map((clause) =>
            clause.clauseId === clauseId
              ? { ...response.analysis, version: clause.version + 1 }
              : clause
          )
        );
        toast({
          title: "Success",
          description: "Clause updated successfully",
        });
      } else {
        throw new Error(response.error || "Failed to update clause");
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update clause",
        variant: "destructive",
      });
    }
  };

  const getRiskColor = (score: number) => {
    if (score >= 8) return "text-red-500 bg-red-100";
    if (score >= 5) return "text-yellow-500 bg-yellow-100";
    return "text-green-500 bg-green-100";
  };

  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Contract Analysis</h2>
        <Button onClick={analyzeContract} disabled={isLoading}>
          {isLoading ? "Analyzing..." : "Analyze Contract"}
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {clauses.map((clause) => (
          <Card key={clause.clauseId} className="p-4">
            <div className="flex justify-between items-start mb-2">
              <div
                className={`px-2 py-1 rounded-full text-sm font-medium ${getRiskColor(
                  clause.riskScore
                )}`}
              >
                Risk: {clause.riskScore}/10
              </div>
              <span className="text-sm text-gray-500">v{clause.version}</span>
            </div>
            <div className="mb-4">
              <h3 className="font-medium mb-2">Original Text</h3>
              <p className="text-sm text-gray-700">{clause.originalText}</p>
            </div>
            <div className="flex justify-end">
              <Button
                variant="outline"
                onClick={() => {
                  setSelectedClause(clause);
                  setIsDialogOpen(true);
                }}
              >
                Review Suggestions
              </Button>
            </div>
          </Card>
        ))}
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        {selectedClause && (
          <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle>Clause Analysis</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4">
              <div>
                <h4 className="font-medium mb-2">Original Text</h4>
                <p className="text-sm text-gray-700 p-2 bg-gray-50 rounded">
                  {selectedClause.originalText}
                </p>
              </div>
              <div>
                <h4 className="font-medium mb-2">Suggested Improvement</h4>
                <p className="text-sm text-gray-700 p-2 bg-green-50 rounded">
                  {selectedClause.suggestedText}
                </p>
              </div>
              <div>
                <h4 className="font-medium mb-2">Analysis</h4>
                <div className="space-y-2">
                  <p className="text-sm">
                    <span className="font-medium">Risk Level:</span> {selectedClause.riskLevel}
                  </p>
                  <p className="text-sm">
                    <span className="font-medium">Category:</span> {selectedClause.category}
                  </p>
                  <p className="text-sm">
                    <span className="font-medium">Impact:</span> {selectedClause.impact}
                  </p>
                  <p className="text-sm">
                    <span className="font-medium">Explanation:</span>{" "}
                    {selectedClause.explanation}
                  </p>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                >
                  Close
                </Button>
                <Button
                  onClick={() => {
                    updateClause(selectedClause.clauseId, selectedClause.suggestedText);
                    setIsDialogOpen(false);
                  }}
                >
                  Accept Suggestion
                </Button>
              </div>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}