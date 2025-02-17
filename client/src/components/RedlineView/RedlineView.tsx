import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface DiffSegment {
  value: string;
  added?: boolean;
  removed?: boolean;
}

interface RedlineViewProps {
  originalText: string;
  proposedText: string;
  onClear?: () => void;
  isLoading?: boolean;
}

export function RedlineView({ originalText, proposedText, onClear, isLoading }: RedlineViewProps) {
  const [diffSegments, setDiffSegments] = useState<DiffSegment[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    if (originalText && proposedText) {
      highlightDifferences();
    }
  }, [originalText, proposedText]);

  const highlightDifferences = async () => {
    try {
      const response = await fetch("/api/redline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ originalText, proposedText }),
      });

      if (!response.ok) throw new Error("Failed to process diff");

      const data = await response.json();
      setDiffSegments(data.segments || []);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to process document differences",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="diff-view">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-gray-200">Document Comparison</h3>
        {onClear && (
          <Button variant="ghost" size="sm" onClick={onClear}>
            <X className="h-4 w-4 mr-2" />
            Clear
          </Button>
        )}
      </div>

      <div className="bg-gray-900/70 p-6 rounded-lg border border-gray-700">
        {diffSegments.map((segment, idx) => (
          <span
            key={idx}
            className={`${
              segment.added
                ? "bg-emerald-950 text-emerald-300 px-1 rounded"
                : segment.removed
                ? "bg-red-950 text-red-300 px-1 rounded"
                : "text-gray-300"
            } font-mono text-sm`}
            data-testid={
              segment.added
                ? "diff-additions"
                : segment.removed
                ? "diff-deletions"
                : "diff-unchanged"
            }
          >
            {segment.value}
          </span>
        ))}
      </div>
    </div>
  );
}