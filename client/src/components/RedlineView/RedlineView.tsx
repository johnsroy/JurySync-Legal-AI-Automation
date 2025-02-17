import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileUpload, Loader2, X, Upload } from "lucide-react";
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
      // This will be replaced by the API call in the parent
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
        <h3 className="text-lg font-semibold">Document Comparison</h3>
        {onClear && (
          <Button variant="ghost" size="sm" onClick={onClear}>
            <X className="h-4 w-4 mr-2" />
            Clear
          </Button>
        )}
      </div>

      <div className="bg-muted p-4 rounded-lg">
        {diffSegments.map((segment, idx) => (
          <span
            key={idx}
            className={`${
              segment.added
                ? "bg-green-100 text-green-800"
                : segment.removed
                ? "bg-red-100 text-red-800"
                : ""
            }`}
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