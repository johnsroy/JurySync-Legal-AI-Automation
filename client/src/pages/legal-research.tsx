import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Gavel, LogOut, Loader2, Book, Search, FileText, AlertTriangle, Download } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { format } from 'date-fns';

interface LegalResearchResponse {
  summary: string;
  analysis: {
    legalPrinciples: string[];
    keyPrecedents: {
      case: string;
      relevance: string;
      impact: string;
    }[];
    recommendations: string[];
  };
  citations: {
    source: string;
    reference: string;
    context: string;
  }[];
  relevantCases: Array<{
    document: {
      title: string;
      content: string;
      jurisdiction: string;
      date: string;
    };
    relevance: string;
  }>;
  timeline: Array<{
    date: string;
    event: string;
  }>;
}

interface LegalDocument {
  id: number;
  title: string;
  content: string;
  documentType: string;
  date: string;
  jurisdiction: string;
}

interface FilterState {
  jurisdiction: string;
  startDate: Date | undefined;
  endDate: Date | undefined;
  legalTopic: string;
}

export default function LegalResearch() {
  const { user, logoutMutation } = useAuth();
  const { toast } = useToast();
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<LegalResearchResponse | null>(null);
  const [filters, setFilters] = useState<FilterState>({
    jurisdiction: "all",
    startDate: undefined,
    endDate: undefined,
    legalTopic: "all"
  });

  // Available filter options
  const jurisdictions = ["All", "Federal", "State", "Supreme Court"];
  const legalTopics = ["All", "Constitutional", "Criminal", "Civil Rights", "Corporate", "Environmental"];

  // Fetch pre-populated documents
  const { data: prePoulatedDocs, isLoading: isLoadingDocs } = useQuery<LegalDocument[]>({
    queryKey: ['/api/legal-research/documents', filters],
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      if (filters.jurisdiction !== 'all') searchParams.append('jurisdiction', filters.jurisdiction);
      if (filters.startDate) searchParams.append('startDate', filters.startDate.toISOString());
      if (filters.endDate) searchParams.append('endDate', filters.endDate.toISOString());
      if (filters.legalTopic !== 'all') searchParams.append('topic', filters.legalTopic);

      const response = await fetch(`/api/legal-research/documents?${searchParams.toString()}`);
      if (!response.ok) {
        throw new Error('Failed to fetch documents');
      }
      return response.json();
    }
  });

  const researchMutation = useMutation({
    mutationFn: async (query: string) => {
      const response = await fetch('/api/legal-research/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          query,
          filters,
          useDeepResearch: true
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to analyze query');
      }

      return response.json();
    },
    onSuccess: (data: LegalResearchResponse) => {
      setResult(data);
      toast({
        title: "Analysis Complete",
        description: "Deep legal research results are ready",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Analysis Failed",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const downloadReport = async () => {
    if (!result) return;

    try {
      const response = await fetch('/api/legal-research/report', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ result })
      });

      if (!response.ok) throw new Error('Failed to generate report');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `legal-research-report-${format(new Date(), 'yyyy-MM-dd')}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "Report Downloaded",
        description: "Legal research report has been generated and downloaded.",
      });
    } catch (error) {
      toast({
        title: "Download Failed",
        description: error instanceof Error ? error.message : "Failed to download report",
        variant: "destructive"
      });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card/80 backdrop-blur-lg border-b border-border">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link href="/dashboard" className="flex items-center space-x-4 hover:text-primary">
              <Gavel className="h-6 w-6 text-primary" />
              <h1 className="text-xl font-semibold text-foreground">JurySync.io</h1>
            </Link>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">
              Welcome, {user?.firstName} {user?.lastName}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => logoutMutation.mutate()}
              disabled={logoutMutation.isPending}
            >
              {logoutMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <LogOut className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="flex items-center gap-4 mb-8">
            <Book className="h-8 w-8 text-primary" />
            <h2 className="text-3xl font-bold text-foreground">Legal Research</h2>
          </div>

          {/* Filters Section */}
          <Card className="bg-card/80 backdrop-blur-lg border-border">
            <CardHeader>
              <CardTitle>Filters</CardTitle>
              <CardDescription>Refine your search results</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">Jurisdiction</label>
                  <Select
                    value={filters.jurisdiction}
                    onValueChange={(value) => setFilters(prev => ({ ...prev, jurisdiction: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select jurisdiction" />
                    </SelectTrigger>
                    <SelectContent>
                      {jurisdictions.map((j) => (
                        <SelectItem key={j.toLowerCase()} value={j.toLowerCase()}>
                          {j}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">Legal Topic</label>
                  <Select
                    value={filters.legalTopic}
                    onValueChange={(value) => setFilters(prev => ({ ...prev, legalTopic: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select topic" />
                    </SelectTrigger>
                    <SelectContent>
                      {legalTopics.map((t) => (
                        <SelectItem key={t.toLowerCase()} value={t.toLowerCase()}>
                          {t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">Date Range</label>
                  <div className="flex gap-2">
                    <Calendar
                      mode="single"
                      selected={filters.startDate}
                      onSelect={(date) => setFilters((prev) => ({ ...prev, startDate: date || undefined }))}
                      className="rounded-md border border-input"
                    />
                    <Calendar
                      mode="single"
                      selected={filters.endDate}
                      onSelect={(date) => setFilters((prev) => ({ ...prev, endDate: date || undefined }))}
                      className="rounded-md border border-input"
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Pre-populated Documents */}
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mb-8">
            {isLoadingDocs ? (
              <Card className="col-span-full bg-card border-border">
                <CardContent className="p-8">
                  <div className="flex items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                </CardContent>
              </Card>
            ) : (
              prePoulatedDocs?.map((doc) => (
                <Card
                  key={doc.id}
                  className="bg-card/80 backdrop-blur-lg border-border hover:shadow-lg transition-shadow cursor-pointer"
                  onClick={() => setQuery(`Analyze the legal principles and implications of ${doc.title}`)}
                >
                  <CardContent className="p-6">
                    <div className="space-y-4">
                      <div className="flex items-start justify-between">
                        <h3 className="font-semibold text-foreground">{doc.title}</h3>
                        <Badge variant="secondary">{doc.documentType}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {doc.content.substring(0, 150)}...
                      </p>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">
                          {new Date(doc.date).toLocaleDateString()}
                        </span>
                        <Badge variant="outline">{doc.jurisdiction}</Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>

          <div className="grid gap-6">
            {/* Query Input */}
            <Card className="bg-card/80 backdrop-blur-lg border-border">
              <CardHeader>
                <CardTitle>Research Query</CardTitle>
                <CardDescription>
                  Enter your legal research question or topic
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <Textarea
                    placeholder="Enter your legal research query (e.g., 'What are the recent precedents for fair use in digital content?')"
                    className="min-h-[120px] border border-input"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    disabled={researchMutation.isPending}
                  />
                  <Button
                    className="w-full"
                    disabled={!query.trim() || researchMutation.isPending}
                    onClick={() => researchMutation.mutate(query)}
                  >
                    {researchMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        Analyzing...
                      </>
                    ) : (
                      <>
                        <Search className="h-4 w-4 mr-2" />
                        Start Research
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Results Display */}
            {researchMutation.isPending && (
              <Card className="bg-card/80 backdrop-blur-lg border-border">
                <CardContent className="p-8">
                  <div className="flex flex-col items-center justify-center space-y-4">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <p className="text-lg font-medium text-muted-foreground">Analyzing Legal Sources...</p>
                    <p className="text-sm text-muted-foreground">
                      Searching through case law and legal databases
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            {researchMutation.isError && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Research Failed</AlertTitle>
                <AlertDescription>
                  {researchMutation.error.message}
                </AlertDescription>
              </Alert>
            )}

            {result && (
              <Card className="bg-card/80 backdrop-blur-lg border-border p-6">
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xl font-semibold">Legal Research Findings</h3>
                    <Button onClick={downloadReport}>
                      <Download className="h-4 w-4 mr-2" />
                      Download Report
                    </Button>
                  </div>

                  {/* Relevant Case Law Section */}
                  <div className="space-y-4">
                    <h4 className="text-lg font-medium">Relevant Case Law</h4>
                    <div className="grid gap-4">
                      {result.analysis.keyPrecedents.map((precedent, index) => (
                        <Card key={index} className="p-4 bg-card/50">
                          <div className="space-y-2">
                            <h5 className="font-semibold text-primary">{precedent.case}</h5>
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <p className="text-sm font-medium text-muted-foreground">Relevance</p>
                                <p className="text-sm">{precedent.relevance}</p>
                              </div>
                              <div>
                                <p className="text-sm font-medium text-muted-foreground">Impact</p>
                                <p className="text-sm">{precedent.impact}</p>
                              </div>
                            </div>
                          </div>
                        </Card>
                      ))}
                    </div>
                  </div>

                  {/* Legal Principles Section */}
                  <div className="space-y-4">
                    <h4 className="text-lg font-medium">Key Legal Principles</h4>
                    <div className="grid gap-2">
                      {result.analysis.legalPrinciples.map((principle, index) => (
                        <Card key={index} className="p-3 bg-card/50">
                          <div className="flex items-start gap-3">
                            <span className="text-primary">{index + 1}.</span>
                            <p>{principle}</p>
                          </div>
                        </Card>
                      ))}
                    </div>
                  </div>

                  {/* Citations Section */}
                  <div className="space-y-4">
                    <h4 className="text-lg font-medium">Citations and References</h4>
                    <div className="grid gap-4">
                      {result.citations.map((citation, index) => (
                        <Card key={index} className="p-4 bg-card/50">
                          <div className="space-y-2">
                            <h5 className="font-semibold text-primary">{citation.source}</h5>
                            <p className="text-sm text-muted-foreground">{citation.reference}</p>
                            <p className="text-sm italic">{citation.context}</p>
                          </div>
                        </Card>
                      ))}
                    </div>
                  </div>

                  {/* Recommendations Section */}
                  <div className="space-y-4">
                    <h4 className="text-lg font-medium">Recommendations</h4>
                    <div className="grid gap-3">
                      {result.analysis.recommendations.map((recommendation, index) => (
                        <Card key={index} className="p-4 bg-card/50">
                          <div className="flex items-start gap-3">
                            <FileText className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                            <p>{recommendation}</p>
                          </div>
                        </Card>
                      ))}
                    </div>
                  </div>
                </div>
              </Card>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}