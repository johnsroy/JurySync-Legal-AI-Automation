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
import { useQuery } from '@tanstack/react-query';
import jsPDF from 'jspdf';

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

interface ResearchResponse {
  success: boolean;
  error?: string;
  executiveSummary?: string;
  findings?: Array<{
    title: string;
    source: string;
    relevance: number;
    summary: string;
    citations: string[];
  }>;
  recommendations?: string[];
}

interface AvailableReport {
  id: number;
  query: string;
  timestamp: string;
  jurisdiction: string;
  legalTopic: string;
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

  // Fetch available research when filters change
  const { data: availableResearch } = useQuery({
    queryKey: ['/api/legal-research/available', filters],
    queryFn: async () => {
      const response = await fetch(`/api/legal-research/available?${new URLSearchParams({
        jurisdiction: filters.jurisdiction,
        legalTopic: filters.legalTopic,
        ...(filters.startDate && { startDate: filters.startDate.toISOString() }),
        ...(filters.endDate && { endDate: filters.endDate.toISOString() })
      })}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch available research');
      }
      
      return response.json();
    },
    enabled: filters.jurisdiction !== 'all' || filters.legalTopic !== 'all',
    staleTime: 300000, // 5 minutes
    gcTime: 600000, // 10 minutes
  });

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

        if (!response.ok) throw new Error("Failed to fetch suggestions");
        const data = await response.json();
        if (data.success && Array.isArray(data.suggestions)) {
          setSuggestions(data.suggestions);
        }
      } catch (error) {
        console.error("Suggestion error:", error);
      }
    };

    const debounceTimer = setTimeout(fetchSuggestions, 500);
    return () => clearTimeout(debounceTimer);
  }, [query, filters]);

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

      const data: ResearchResponse = await response.json();

      if (!data.success) {
        throw new Error(data.error || "Research unsuccessful");
      }

      setFindings({
        executiveSummary: data.executiveSummary || "",
        keyFindings: data.findings || [],
        recommendations: data.recommendations || []
      });

      toast({
        title: "Research Complete",
        description: "Legal research results are ready"
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

  const handleExportPDF = () => {
    if (!findings) {
      toast({
        title: "No Findings",
        description: "There are no findings to export.",
        variant: "destructive"
      });
      return;
    }

    const doc = new jsPDF();

    doc.setFontSize(16);
    doc.text("Legal Research Report", 10, 10);

    doc.setFontSize(12);
    doc.text(`Executive Summary:`, 10, 20);
    doc.text(findings.executiveSummary, 10, 25);

    doc.text(`\nKey Findings:`, 10, 35);
    findings.keyFindings.forEach((finding, index) => {
      doc.text(`${index + 1}. ${finding.title} (${finding.source})`, 10, 40 + index * 10);
      doc.text(`   Summary: ${finding.summary}`, 10, 45 + index * 10);
      doc.text(`   Relevance Score: ${finding.relevance}`, 10, 50 + index * 10);
      doc.text(`   Citations: ${finding.citations.join(", ")}`, 10, 55 + index * 10);
    });

    doc.text(`\nRecommendations:`, 10, 65 + findings.keyFindings.length * 10);
    findings.recommendations.forEach((rec, index) => {
      doc.text(`${index + 1}. ${rec}`, 10, 70 + findings.keyFindings.length * 10 + index * 10);
    });

    doc.save('Legal_Research_Report.pdf');
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

        {/* Filters */}
        <div className="space-y-2">
          <Select
            value={filters.jurisdiction}
            onValueChange={(value) => setFilters(prev => ({ ...prev, jurisdiction: value }))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select Jurisdiction" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Jurisdictions</SelectItem>
              <SelectItem value="federal">Federal</SelectItem>
              <SelectItem value="state">State</SelectItem>
              <SelectItem value="supreme">Supreme Court</SelectItem>
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
              <SelectItem value="all">All Topics</SelectItem>
              <SelectItem value="constitutional">Constitutional Law</SelectItem>
              <SelectItem value="criminal">Criminal Law</SelectItem>
              <SelectItem value="corporate">Corporate Law</SelectItem>
              <SelectItem value="civil">Civil Rights</SelectItem>
              {/* Add more topics as needed */}
            </SelectContent>
          </Select>

          <DatePicker
            date={filters.startDate}
            onChange={(date) => setFilters(prev => ({ 
              ...prev, 
              startDate: date 
            }))}
          />

          <DatePicker
            date={filters.endDate}
            onChange={(date) => setFilters(prev => ({ 
              ...prev, 
              endDate: date 
            }))}
          />
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
          <ScrollArea className="h-[calc(100vh-400px)]">
            <div className="space-y-6 pr-4">
              {/* Executive Summary */}
              <section>
                <h3 className="text-sm font-semibold text-gray-300 mb-3">
                  Executive Summary
                </h3>
                <p className="text-sm text-gray-400">
                  {findings.executiveSummary}
                </p>
              </section>

              {/* Key Findings */}
              <section>
                <h3 className="text-sm font-semibold text-gray-300 mb-3">
                  Key Findings
                </h3>
                <ul className="space-y-2">
                  {findings.keyFindings.map((finding, index) => (
                    <li key={index} className="bg-gray-800 p-3 rounded-lg">
                      <h4 className="text-sm font-medium text-gray-200">{finding.title}</h4>
                      <p className="text-xs text-gray-400">{finding.source}</p>
                      <p className="text-sm text-gray-300">{finding.summary}</p>
                      <p className="text-xs text-gray-400">Relevance Score: {finding.relevance}</p>
                      <ul className="list-disc list-inside text-xs text-gray-400">
                        {finding.citations.map((citation, ci) => (
                          <li key={ci}>{citation}</li>
                        ))}
                      </ul>
                    </li>
                  ))}
                </ul>
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
                onClick={handleExportPDF}
              >
                <Download className="h-4 w-4 mr-2" />
                Export Research Report
              </Button>
            </div>
          </ScrollArea>
        )}

        {/* Show available research */}
        {availableResearch?.reports?.map((report: AvailableReport) => (
          <div key={report.id} className="mt-4">
            <h3 className="text-sm font-medium text-gray-400 mb-2">Available Research</h3>
            <Button
              variant="ghost"
              className="w-full justify-start text-left"
              onClick={() => setQuery(report.query)}
            >
              <div className="flex flex-col">
                <span className="text-sm">{report.query}</span>
                <span className="text-xs text-gray-400">
                  {new Date(report.timestamp).toLocaleDateString()}
                </span>
              </div>
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
} 