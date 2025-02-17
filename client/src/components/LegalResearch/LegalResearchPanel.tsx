import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Book, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";

interface LegalResearchResult {
  title: string;
  source: string;
  relevance: number;
  summary: string;
  citations: string[];
}

interface ResearchResults {
  results: LegalResearchResult[];
  recommendations: string[];
  timestamp: string;
}

export function LegalResearchPanel() {
  const [query, setQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<ResearchResults | null>(null);
  const { toast } = useToast();

  const handleSearch = async () => {
    if (!query.trim()) {
      toast({
        title: "No Query",
        description: "Please enter a research query",
        variant: "destructive"
      });
      return;
    }

    setIsSearching(true);
    try {
      const response = await fetch("/api/legal-research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query,
          options: {
            deepResearch: true
          }
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.details || "Research failed");
      }

      const data = await response.json();
      setResults(data);

      toast({
        title: "Research Complete",
        description: "Legal research results are ready",
      });
    } catch (error) {
      console.error("Research error:", error);
      toast({
        title: "Research Failed",
        description: error instanceof Error ? error.message : "Failed to analyze query",
        variant: "destructive"
      });
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="bg-white/80 backdrop-blur-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Book className="h-5 w-5 text-primary" />
            Legal Research Assistant
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 mb-6">
            <Input
              placeholder="Enter your legal research query..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              className="flex-1"
            />
            <Button 
              onClick={handleSearch}
              disabled={isSearching || !query.trim()}
            >
              {isSearching ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Searching...
                </>
              ) : (
                <>
                  <Search className="h-4 w-4 mr-2" />
                  Start Research
                </>
              )}
            </Button>
          </div>

          {results && (
            <div className="space-y-6">
              {/* Research Results */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-800">Research Findings</h3>
                {results.results.map((result, index) => (
                  <Card key={index} className="p-4">
                    <div className="space-y-2">
                      <div className="flex justify-between items-start">
                        <h4 className="font-medium text-gray-800">{result.title}</h4>
                        <span className="text-sm bg-primary/10 text-primary px-2 py-1 rounded">
                          Relevance: {result.relevance}%
                        </span>
                      </div>
                      <p className="text-sm text-gray-600">{result.summary}</p>
                      <div className="text-sm text-gray-500">
                        <p className="font-medium">Source: {result.source}</p>
                        {result.citations.length > 0 && (
                          <div className="mt-2">
                            <p className="font-medium">Citations:</p>
                            <ul className="list-disc list-inside">
                              {result.citations.map((citation, idx) => (
                                <li key={idx}>{citation}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </div>
                  </Card>
                ))}
              </div>

              {/* Recommendations */}
              {results.recommendations.length > 0 && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-800">Recommendations</h3>
                  <Card className="p-4">
                    <ul className="list-disc list-inside space-y-2">
                      {results.recommendations.map((rec, index) => (
                        <li key={index} className="text-gray-700">{rec}</li>
                      ))}
                    </ul>
                  </Card>
                </div>
              )}

              <div className="text-sm text-gray-500 mt-4">
                Research completed: {new Date(results.timestamp).toLocaleString()}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}