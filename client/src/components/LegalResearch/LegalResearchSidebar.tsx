import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Search, Book, Download, ArrowRight, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DatePicker } from "@/components/ui/date-picker";
import { Calendar } from "@/components/ui/calendar";

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

const progressSteps = [
  "Initializing research...",
  "Analyzing legal databases...",
  "Processing citations...",
  "Generating insights...",
  "Compiling results..."
];

export function LegalResearchSidebar() {
  const [query, setQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [findings, setFindings] = useState<ResearchFindings | null>(null);
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState(0);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [filters, setFilters] = useState({
    jurisdiction: "all",
    legalTopic: "all",
    startDate: null as Date | null,
    endDate: null as Date | null
  });
  const { toast } = useToast();

  // Handle progress updates
  useEffect(() => {
    if (isSearching) {
      const interval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 100) {
            clearInterval(interval);
            return 100;
          }
          return prev + 2;
        });
        
        setCurrentStep(prev => 
          Math.min(Math.floor((progress / 100) * progressSteps.length), progressSteps.length - 1)
        );
      }, 100);

      return () => clearInterval(interval);
    }
  }, [isSearching, progress]);

  // Fetch suggestions when query changes
  useEffect(() => {
    const fetchSuggestions = async () => {
      if (!query.trim() || query.length < 3) return;

      try {
        const response = await fetch("/api/legal-research/suggest-questions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query })
        });

        if (!response.ok) throw new Error("Failed to fetch suggestions");
        const data = await response.json();
        setSuggestions(data);
      } catch (error) {
        console.error("Suggestion error:", error);
      }
    };

    const debounceTimer = setTimeout(fetchSuggestions, 500);
    return () => clearTimeout(debounceTimer);
  }, [query]);

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
    setProgress(0);
    setCurrentStep(0);

    try {
      const response = await fetch("/api/legal-research", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        body: JSON.stringify({
          query,
          jurisdiction: filters.jurisdiction,
          legalTopic: filters.legalTopic,
          dateRange: filters.startDate ? {
            start: filters.startDate.toISOString(),
            end: filters.endDate?.toISOString()
          } : undefined
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.details || "Research failed");
      }

      const data = await response.json();
      
      setFindings({
        executiveSummary: data.executiveSummary,
        keyFindings: data.results,
        recommendations: data.recommendations
      });

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
      setProgress(100);
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

          {/* Show suggestions */}
          {suggestions.length > 0 && !isSearching && (
            <div className="space-y-2 bg-gray-800/50 p-2 rounded-lg">
              <p className="text-xs text-gray-400">Suggested queries:</p>
              {suggestions.map((suggestion, index) => (
                <Button
                  key={index}
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start text-left text-gray-300 hover:text-white"
                  onClick={() => {
                    setQuery(suggestion);
                    handleSearch();
                  }}
                >
                  <ArrowRight className="h-4 w-4 mr-2" />
                  {suggestion}
                </Button>
              ))}
            </div>
          )}

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

        {/* Show progress during search */}
        {isSearching && (
          <div className="space-y-2">
            <div className="flex justify-between text-xs text-gray-400">
              <span>{progressSteps[currentStep]}</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} className="h-1" />
          </div>
        )}

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