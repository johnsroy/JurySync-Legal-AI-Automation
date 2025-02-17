import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Search, Book, Download, ArrowRight, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ResearchResult {
  title: string;
  source: string;
  relevance: number;
  summary: string;
  citations: string[];
}

interface ResearchFindings {
  executiveSummary: string;
  keyFindings: ResearchResult[];
  recommendations: string[];
}

export function LegalResearchSidebar() {
  const [query, setQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [findings, setFindings] = useState<ResearchFindings | null>(null);
  const { toast } = useToast();

  const handleSearch = async () => {
    if (!query.trim()) {
      toast({
        title: "Error",
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
            useGemini: true,
            deepResearch: true,
            sources: ["cases", "statutes", "articles", "regulations"]
          }
        })
      });

      if (!response.ok) throw new Error("Research failed");
      const data = await response.json();
      setFindings(data);
    } catch (error) {
      toast({
        title: "Research Error",
        description: "Failed to complete research",
        variant: "destructive"
      });
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="w-96 h-screen border-r border-gray-800 bg-gray-900/50 backdrop-blur-sm p-4">
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Book className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold text-gray-200">Legal Research</h2>
        </div>

        <div className="space-y-2">
          <Textarea
            placeholder="Enter your legal research query..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="min-h-[100px] bg-gray-800 border-gray-700 text-gray-200"
          />
          <Button 
            onClick={handleSearch}
            disabled={isSearching || !query.trim()}
            className="w-full"
          >
            {isSearching ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Researching...
              </>
            ) : (
              <>
                <Search className="h-4 w-4 mr-2" />
                Search Legal Database
              </>
            )}
          </Button>
        </div>

        {findings && (
          <ScrollArea className="h-[calc(100vh-280px)]">
            <div className="space-y-6 pr-4">
              {/* Executive Summary */}
              <section>
                <h3 className="text-sm font-semibold text-gray-300 mb-2">
                  Executive Summary
                </h3>
                <p className="text-gray-400 text-sm">
                  {findings.executiveSummary}
                </p>
              </section>

              {/* Research Findings */}
              <section>
                <h3 className="text-sm font-semibold text-gray-300 mb-3">
                  Key Findings
                </h3>
                <div className="space-y-4">
                  {findings.keyFindings.map((finding, index) => (
                    <div key={index} className="bg-gray-800/50 p-3 rounded-lg border border-gray-700">
                      <div className="flex justify-between items-start">
                        <h4 className="text-sm font-medium text-gray-200">
                          {finding.title}
                        </h4>
                        <span className="text-xs text-primary">
                          {finding.relevance}% Match
                        </span>
                      </div>
                      <p className="text-sm text-gray-400 mt-2">
                        {finding.summary}
                      </p>
                      {finding.citations.length > 0 && (
                        <div className="mt-2">
                          <p className="text-xs text-gray-500">Citations:</p>
                          <ul className="list-disc list-inside text-xs text-gray-400 mt-1">
                            {finding.citations.map((citation, idx) => (
                              <li key={idx}>{citation}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      <p className="text-xs text-gray-500 mt-2">
                        Source: {finding.source}
                      </p>
                    </div>
                  ))}
                </div>
              </section>

              {/* Recommendations */}
              <section>
                <h3 className="text-sm font-semibold text-gray-300 mb-3">
                  Recommendations
                </h3>
                <ul className="space-y-2">
                  {findings.recommendations.map((rec, index) => (
                    <li 
                      key={index}
                      className="flex items-start gap-2 text-sm text-gray-400"
                    >
                      <ArrowRight className="h-4 w-4 text-primary mt-1 flex-shrink-0" />
                      <span>{rec}</span>
                    </li>
                  ))}
                </ul>
              </section>

              <Button 
                variant="outline" 
                className="w-full border-gray-700 text-gray-300 hover:text-white"
                onClick={() => {/* Implement PDF export */}}
              >
                <Download className="h-4 w-4 mr-2" />
                Export Research Report
              </Button>
            </div>
          </ScrollArea>
        )}
      </div>
    </div>
  );
} 