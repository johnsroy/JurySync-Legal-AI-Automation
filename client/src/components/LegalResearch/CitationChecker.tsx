import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Search, AlertTriangle, Check, Info } from "lucide-react";

interface CitationStatus {
  citation: string;
  status: "POSITIVE" | "NEGATIVE" | "NEUTRAL" | "OVERRULED" | "DISTINGUISHED";
  details: string;
  relatedCases: string[];
}

export function CitationChecker() {
  const [citation, setCitation] = useState("");
  const { toast } = useToast();

  const checkCitation = useMutation({
    mutationFn: async (citation: string) => {
      const response = await fetch("/api/legal-research/check-citation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ citation }),
      });

      if (!response.ok) {
        throw new Error("Citation check failed");
      }

      return response.json() as Promise<CitationStatus>;
    },
    onSuccess: () => {
      toast({
        title: "Citation Checked",
        description: "Citation status has been retrieved successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Check Failed",
        description: "Failed to check citation. Please try again.",
        variant: "destructive",
      });
    },
  });

  return (
    <div className="space-y-6 p-4">
      <div className="flex gap-4">
        <Input
          placeholder="Enter citation (e.g., 347 U.S. 483)"
          value={citation}
          onChange={(e) => setCitation(e.target.value)}
          className="max-w-xl"
        />
        <Button
          onClick={() => checkCitation.mutate(citation)}
          disabled={!citation || checkCitation.isLoading}
        >
          <Search className="h-4 w-4 mr-2" />
          Check Citation
        </Button>
      </div>

      {checkCitation.data && (
        <Card className="p-6">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="text-lg font-semibold">
                {checkCitation.data.citation}
              </h3>
              <Badge
                variant={
                  checkCitation.data.status === "NEGATIVE" ||
                  checkCitation.data.status === "OVERRULED"
                    ? "destructive"
                    : checkCitation.data.status === "DISTINGUISHED"
                      ? "warning"
                      : "success"
                }
                className="mt-2"
              >
                {checkCitation.data.status}
              </Badge>
            </div>
            {checkCitation.data.status === "NEGATIVE" ||
            checkCitation.data.status === "OVERRULED" ? (
              <AlertTriangle className="h-5 w-5 text-destructive" />
            ) : checkCitation.data.status === "DISTINGUISHED" ? (
              <Info className="h-5 w-5 text-warning" />
            ) : (
              <Check className="h-5 w-5 text-success" />
            )}
          </div>

          <p className="mt-4 text-gray-600">{checkCitation.data.details}</p>

          <div className="mt-6">
            <h4 className="font-medium mb-2">Related Cases:</h4>
            <ScrollArea className="h-48">
              <div className="space-y-2">
                {checkCitation.data.relatedCases.map((case_, index) => (
                  <div key={index} className="p-2 bg-gray-50 rounded">
                    {case_}
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        </Card>
      )}
    </div>
  );
}
