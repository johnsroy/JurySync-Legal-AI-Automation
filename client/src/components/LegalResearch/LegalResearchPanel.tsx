import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Book, Search, ChevronRight, Link as LinkIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { motion, AnimatePresence } from "framer-motion";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DatePicker } from "@/components/ui/date-picker";

interface LegalResearchResult {
  title: string;
  source: string;
  relevance: number;
  summary: string;
  citations: string[];
  urls?: string[]; // Added optional URLs
}

interface ResearchResults {
  results: LegalResearchResult[];
  recommendations: string[];
  timestamp: string;
}

const progressSteps = [
  "Initializing research...",
  "Analyzing jurisdictional precedents...",
  "Processing legal frameworks...",
  "Gathering relevant citations...",
  "Generating recommendations...",
  "Compiling final report..."
];

export function LegalResearchPanel() {
  const [query, setQuery] = useState("");
  const { toast } = useToast();
  const [filters, setFilters] = useState({
    jurisdiction: "",
    legalTopic: "",
    startDate: null,
    endDate: null
  });
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState(null);

  // Add filter fetching
  const [availableFilters, setAvailableFilters] = useState({
    jurisdictions: [],
    legalTopics: []
  });

  useEffect(() => {
    async function fetchFilters() {
      try {
        const response = await fetch("/api/legal-research/filters");
        if (!response.ok) throw new Error("Failed to fetch filters");
        const data = await response.json();
        if (data.success) {
          setAvailableFilters(data.filters);
        }
      } catch (error) {
        console.error("Error fetching filters:", error);
        toast({
          title: "Error",
          description: "Failed to load filters",
          variant: "destructive"
        });
      }
    }
    fetchFilters();
  }, []);

  const handleSearch = async () => {
    if (!query.trim()) {
      toast({
        title: "Invalid Query",
        description: "Please enter a search query",
        variant: "destructive"
      });
      return;
    }

    setIsSearching(true);
    setResults(null);

    try {
      const response = await fetch("/api/legal-research/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: query.trim(),
          filters: {
            jurisdiction: filters.jurisdiction || undefined,
            legalTopic: filters.legalTopic || undefined,
            dateRange: filters.startDate ? {
              start: filters.startDate.toISOString(),
              end: filters.endDate?.toISOString()
            } : undefined
          }
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Research failed");
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <Select 
              value={filters.jurisdiction} 
              onValueChange={(value) => setFilters(prev => ({ ...prev, jurisdiction: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select Jurisdiction" />
              </SelectTrigger>
              <SelectContent>
                {availableFilters.jurisdictions.map(j => (
                  <SelectItem key={j} value={j}>{j}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select 
              value={filters.legalTopic} 
              onValueChange={(value) => setFilters(prev => ({ ...prev, legalTopic: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select Legal Topic" />
              </SelectTrigger>
              <SelectContent>
                {availableFilters.legalTopics.map(topic => (
                  <SelectItem key={topic} value={topic}>{topic}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <DatePicker
              selected={filters.startDate}
              onChange={(date) => setFilters(prev => ({ ...prev, startDate: date }))}
              placeholderText="Start Date"
              maxDate={new Date()}
            />

            <DatePicker
              selected={filters.endDate}
              onChange={(date) => setFilters(prev => ({ ...prev, endDate: date }))}
              placeholderText="End Date"
              minDate={filters.startDate}
              maxDate={new Date()}
            />
          </div>

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
              disabled={isSearching || !filters.jurisdiction || !filters.legalTopic || !query.trim()}
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


          {isSearching && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="mb-6"
            >
              <div className="space-y-2">
                <div className="flex justify-between text-sm text-gray-500">
                  <span>Analyzing your query...</span>
                  <span>0%</span> {/* Placeholder - progress not implemented */}
                </div>
                <Progress value={0} className="h-2" /> {/* Placeholder - progress not implemented */}
              </div>
            </motion.div>
          )}

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
                          {result.urls && result.urls.length > 0 && (
                            <div className="mt-2">
                              <p className="font-medium">Related Resources:</p>
                              <ul className="space-y-1">
                                {result.urls.map((url, idx) => (
                                  <li key={idx} className="flex items-center gap-2">
                                    <LinkIcon className="h-4 w-4" />
                                    <a
                                      href={url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-primary hover:underline"
                                    >
                                      View Resource
                                    </a>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>

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