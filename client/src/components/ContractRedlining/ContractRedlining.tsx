import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

// Keep existing interfaces unchanged
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
  startIndex?: number;
  endIndex?: number;
}

interface ContractRedliningProps {
  initialContent: string;
  onUpdate?: (content: string) => void;
}

export function ContractRedlining({ initialContent, onUpdate }: ContractRedliningProps) {
  // Keep existing state management
  const [clauses, setClauses] = useState<ClauseAnalysis[]>([]);
  const [selectedClause, setSelectedClause] = useState<ClauseAnalysis | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [currentContent, setCurrentContent] = useState(initialContent);
  const { toast } = useToast();

  // Keep existing functions unchanged
  const analyzeContract = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/contract-analysis/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: currentContent }),
      });

      const data = await response.json();
      if (response.ok && data.success && data.analysis) {
        setClauses(data.analysis);
      } else {
        throw new Error(data.error || "Failed to analyze contract");
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
      const response = await fetch(`/api/contract-analysis/clauses/${clauseId}/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newContent }),
      });

      const data = await response.json();
      if (response.ok && data.success && data.analysis) {
        // Update clauses state
        setClauses((prev) =>
          prev.map((clause) =>
            clause.clauseId === clauseId
              ? { ...data.analysis, version: clause.version + 1 }
              : clause
          )
        );

        // Update the entire contract content with the new clause
        const updatedContent = replaceClauseInContent(currentContent, clauseId, newContent);
        setCurrentContent(updatedContent);
        onUpdate?.(updatedContent);

        toast({
          title: "Success",
          description: "Clause updated successfully",
        });
      } else {
        throw new Error(data.error || "Failed to update clause");
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update clause",
        variant: "destructive",
      });
    }
  };

  // Helper function to replace a specific clause in the full contract content
  const replaceClauseInContent = (content: string, clauseId: string, newClauseText: string): string => {
    const clause = clauses.find(c => c.clauseId === clauseId);
    if (!clause || !clause.startIndex || !clause.endIndex) return content;

    const before = content.substring(0, clause.startIndex);
    const after = content.substring(clause.endIndex);
    return before + newClauseText + after;
  };

  const getRiskColor = (score: number) => {
    if (score >= 8) return "text-red-400 bg-red-950/50";
    if (score >= 5) return "text-yellow-400 bg-yellow-950/50";
    return "text-emerald-400 bg-emerald-950/50";
  };

  // Run initial analysis when content changes
  useEffect(() => {
    if (currentContent && !clauses.length) {
      analyzeContract();
    }
  }, [currentContent]);

  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-white">Contract Analysis</h2>
        <Button 
          onClick={analyzeContract} 
          disabled={isLoading}
          className="bg-emerald-600 hover:bg-emerald-700 text-white"
        >
          {isLoading ? "Analyzing..." : "Analyze Contract"}
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {clauses.map((clause) => (
          <Card key={clause.clauseId} className="p-4 bg-gray-800/50 border-gray-700">
            <div className="flex justify-between items-start mb-2">
              <div
                className={`px-2 py-1 rounded-full text-sm font-medium ${getRiskColor(
                  clause.riskScore
                )}`}
              >
                Risk: {clause.riskScore}/10
              </div>
              <span className="text-sm text-gray-400">v{clause.version}</span>
            </div>
            <div className="mb-4">
              <h3 className="font-medium mb-2 text-gray-200">Original Text</h3>
              <p className="text-sm text-gray-300 bg-gray-900/50 p-3 rounded-md border border-gray-700">
                {clause.originalText}
              </p>
            </div>
            <div className="flex justify-end">
              <Button
                variant="outline"
                onClick={() => {
                  setSelectedClause(clause);
                  setIsDialogOpen(true);
                }}
                className="bg-gray-700 hover:bg-gray-600 text-gray-200 border-gray-600"
              >
                Review Suggestions
              </Button>
            </div>
          </Card>
        ))}
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        {selectedClause && (
          <DialogContent className="max-w-4xl bg-gray-900 border-gray-800">
            <DialogHeader>
              <DialogTitle className="text-white">Clause Analysis</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4">
              <div>
                <h4 className="font-medium mb-2 text-gray-200">Original Text</h4>
                <p className="text-sm text-gray-300 p-3 bg-gray-800/50 rounded border border-gray-700">
                  {selectedClause.originalText}
                </p>
              </div>
              <div>
                <h4 className="font-medium mb-2 text-gray-200">Suggested Improvement</h4>
                <p className="text-sm text-gray-300 p-3 bg-emerald-950/30 rounded border border-emerald-800/50">
                  {selectedClause.suggestedText}
                </p>
              </div>
              <div>
                <h4 className="font-medium mb-2 text-gray-200">Analysis</h4>
                <div className="space-y-2 text-gray-300 bg-gray-800/50 p-3 rounded border border-gray-700">
                  <p className="text-sm">
                    <span className="font-medium text-gray-200">Risk Level:</span>{" "}
                    {selectedClause.riskLevel}
                  </p>
                  <p className="text-sm">
                    <span className="font-medium text-gray-200">Category:</span>{" "}
                    {selectedClause.category}
                  </p>
                  <p className="text-sm">
                    <span className="font-medium text-gray-200">Impact:</span>{" "}
                    {selectedClause.impact}
                  </p>
                  <p className="text-sm">
                    <span className="font-medium text-gray-200">Explanation:</span>{" "}
                    {selectedClause.explanation}
                  </p>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                  className="bg-gray-700 hover:bg-gray-600 text-gray-200 border-gray-600"
                >
                  Close
                </Button>
                <Button
                  onClick={() => {
                    if (selectedClause) {
                      updateClause(selectedClause.clauseId, selectedClause.suggestedText);
                      setIsDialogOpen(false);
                    }
                  }}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
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