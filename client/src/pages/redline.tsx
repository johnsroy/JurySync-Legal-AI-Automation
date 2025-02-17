import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Loader2 } from "lucide-react";

export default function Redline() {
  const [originalText, setOriginalText] = useState("");
  const [proposedText, setProposedText] = useState("");
  const [diffResult, setDiffResult] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  async function handleComparison() {
    setIsLoading(true);
    setDiffResult("");
    try {
      const response = await apiRequest("POST", "/api/redline", {
        originalText,
        proposedText,
      });
      if (!response.ok) throw new Error("Failed to get redline diff");
      const data = await response.json();
      setDiffResult(data.diff_text || "No diff generated");
    } catch (error) {
      console.error("Redline error:", error);
      toast({
        title: "Redline Error",
        description: "Failed to compare documents. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="p-8 space-y-8">
      <Card>
        <CardHeader>
          <CardTitle>Redline Comparison</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block mb-1 text-sm font-medium">
                Original Text
              </label>
              <textarea
                className="w-full h-40 border rounded p-2"
                value={originalText}
                onChange={(e) => setOriginalText(e.target.value)}
              />
            </div>
            <div>
              <label className="block mb-1 text-sm font-medium">
                Proposed Text
              </label>
              <textarea
                className="w-full h-40 border rounded p-2"
                value={proposedText}
                onChange={(e) => setProposedText(e.target.value)}
              />
            </div>
          </div>

          <Button onClick={handleComparison} disabled={isLoading}>
            {isLoading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : null}
            Compare
          </Button>
        </CardContent>
      </Card>

      {diffResult && (
        <Card>
          <CardHeader>
            <CardTitle>Comparison Results</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="whitespace-pre-wrap text-sm">
              {diffResult}
            </pre>
          </CardContent>
        </Card>
      )}
    </div>
  );
} 