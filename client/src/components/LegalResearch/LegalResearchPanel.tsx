import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Book, Search, ChevronRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { motion, AnimatePresence } from "framer-motion";

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
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [results, setResults] = useState<ResearchResults | null>(null);
  const [suggestedQuestions, setSuggestedQuestions] = useState<string[]>([]);
  const { toast } = useToast();

  // Fetch suggested questions when query changes
  useEffect(() => {
    const getSuggestions = async () => {
      if (!query.trim() || query.length < 10) return;

      setIsLoadingSuggestions(true);
      try {
        const response = await fetch("/api/legal-research/suggest-questions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query })
        });

        if (!response.ok) throw new Error("Failed to get suggestions");
        const data = await response.json();
        setSuggestedQuestions(data);
      } catch (error) {
        console.error("Failed to get suggestions:", error);
      } finally {
        setIsLoadingSuggestions(false);
      }
    };

    const debounceTimer = setTimeout(getSuggestions, 500);
    return () => clearTimeout(debounceTimer);
  }, [query]);

  const handleSearch = async (searchQuery: string = query) => {
    if (!searchQuery.trim()) {
      toast({
        title: "No Query",
        description: "Please enter a research query",
        variant: "destructive"
      });
      return;
    }

    setIsSearching(true);
    setResults(null);

    try {
      const response = await fetch("/api/legal-research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: searchQuery,
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
      setQuery(searchQuery);

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
              onClick={() => handleSearch()}
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

          {/* Suggested Questions */}
          <AnimatePresence>
            {suggestedQuestions.length > 0 && !isSearching && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="mb-6"
              >
                <h3 className="text-sm font-medium text-gray-500 mb-2">
                  Suggested Questions:
                </h3>
                <div className="space-y-2">
                  {suggestedQuestions.map((question, index) => (
                    <Button
                      key={index}
                      variant="ghost"
                      className="w-full justify-start text-left hover:bg-gray-100"
                      onClick={() => handleSearch(question)}
                    >
                      <ChevronRight className="h-4 w-4 mr-2 text-gray-400" />
                      {question}
                    </Button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Research Results */}
          <AnimatePresence>
            {results && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                className="space-y-6"
              >
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
              </motion.div>
            )}
          </AnimatePresence>
        </CardContent>
      </Card>
    </div>
  );
}