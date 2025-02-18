import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Download } from "lucide-react";

interface BriefAnalyzerProps {
  document: any;
  onCitationUpdate: (citations: any[]) => void;
}

export function BriefAnalyzer({ document, onCitationUpdate }: BriefAnalyzerProps) {
  const [content, setContent] = useState("");
  const { toast } = useToast();

  const analyzeMutation = useMutation({
    mutationFn: async (content: string) => {
      const response = await fetch("/api/jury-research/analyze-brief", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, documentId: document.id }),
      });
      
      if (!response.ok) throw new Error("Analysis failed");
      return response.json();
    },
    onSuccess: (data) => {
      onCitationUpdate(data.citations);
      toast({
        title: "Analysis Complete",
        description: "Brief analysis and citations have been updated",
      });
    },
    onError: (error) => {
      toast({
        title: "Analysis Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return (
    <Card className="p-6">
      <div className="space-y-4">
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Paste your brief content here for analysis..."
          className="min-h-[200px]"
        />
        
        <div className="flex justify-between">
          <Button
            onClick={() => analyzeMutation.mutate(content)}
            disabled={analyzeMutation.isPending || !content}
          >
            {analyzeMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : null}
            Analyze Brief
          </Button>
          
          <Button variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export Analysis
          </Button>
        </div>

        {analyzeMutation.data && (
          <div className="mt-6 space-y-4">
            {/* Display analysis results */}
          </div>
        )}
      </div>
    </Card>
  );
} 