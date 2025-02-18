import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Upload, AlertTriangle, Check } from "lucide-react";
import type { BriefAnalysis } from "@shared/schema";

export function BriefAnalyzer() {
  const [content, setContent] = useState("");
  const { toast } = useToast();

  const analyzeMutation = useMutation({
    mutationFn: async (content: string) => {
      const response = await fetch("/api/legal-research/analyze-brief", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });

      if (!response.ok) {
        throw new Error("Analysis failed");
      }

      return response.json() as Promise<BriefAnalysis>;
    },
    onSuccess: () => {
      toast({
        title: "Analysis Complete",
        description: "Your brief has been analyzed successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Analysis Failed",
        description: "Failed to analyze the brief. Please try again.",
        variant: "destructive",
      });
    },
  });

  return (
    <div className="grid grid-cols-2 gap-4 h-full">
      {/* Input Section */}
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-semibold">Brief Analyzer</h2>
          <Button
            onClick={() => analyzeMutation.mutate(content)}
            disabled={!content || analyzeMutation.isLoading}
          >
            <Upload className="h-4 w-4 mr-2" />
            Analyze Brief
          </Button>
        </div>

        <Textarea
          className="h-[calc(100vh-12rem)]"
          placeholder="Paste your brief here..."
          value={content}
          onChange={(e) => setContent(e.target.value)}
        />
      </div>

      {/* Analysis Results */}
      <div className="border-l border-gray-200 p-4">
        <Tabs defaultValue="citations">
          <TabsList>
            <TabsTrigger value="citations">Citations</TabsTrigger>
            <TabsTrigger value="recommendations">Recommendations</TabsTrigger>
            <TabsTrigger value="similar">Similar Cases</TabsTrigger>
          </TabsList>

          <TabsContent value="citations">
            <ScrollArea className="h-[calc(100vh-16rem)]">
              <div className="space-y-4">
                {analyzeMutation.data?.citationHealth?.status &&
                  Object.entries(
                    analyzeMutation.data.citationHealth.status,
                  ).map(([citation, status]) => (
                    <Card key={citation} className="p-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-medium">{citation}</h3>
                          <p className="text-sm text-gray-500">{status}</p>
                        </div>
                        {status === "NEGATIVE" ? (
                          <AlertTriangle className="h-5 w-5 text-destructive" />
                        ) : (
                          <Check className="h-5 w-5 text-success" />
                        )}
                      </div>
                    </Card>
                  ))}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="recommendations">
            <ScrollArea className="h-[calc(100vh-16rem)]">
              <div className="space-y-4">
                {analyzeMutation.data?.analysis?.recommendations.map(
                  (rec, index) => (
                    <Card key={index} className="p-4">
                      <p>{rec}</p>
                    </Card>
                  ),
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="similar">
            <ScrollArea className="h-[calc(100vh-16rem)]">
              <div className="space-y-4">
                {analyzeMutation.data?.analysis?.similarCases.map(
                  (case_, index) => (
                    <Card key={index} className="p-4">
                      <p>{case_}</p>
                    </Card>
                  ),
                )}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
