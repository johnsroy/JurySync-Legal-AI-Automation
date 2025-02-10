import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Gavel, LogOut, Loader2, Book, Search, FileText, AlertTriangle } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";

interface LegalResearchResponse {
  summary: string;
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
  recommendations: string[];
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
  startDate: Date | null;
  endDate: Date | null;
  legalTopic: string;
}

export default function LegalResearch() {
  const { user, logoutMutation } = useAuth();
  const { toast } = useToast();
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<LegalResearchResponse | null>(null);
  const [filters, setFilters] = useState<FilterState>({
    jurisdiction: "all",
    startDate: null,
    endDate: null,
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
        body: JSON.stringify({ query, filters })
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
        description: "Legal research results are ready",
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-yellow-50 to-green-50">
      <header className="bg-white/80 backdrop-blur-lg border-b border-green-100">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link href="/dashboard" className="flex items-center space-x-4 hover:text-green-600">
              <Gavel className="h-6 w-6 text-green-600" />
              <h1 className="text-xl font-semibold">JurySync.io</h1>
            </Link>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">
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
            <Book className="h-8 w-8 text-green-600" />
            <h2 className="text-3xl font-bold">Legal Research</h2>
          </div>

          {/* Filters Section */}
          <Card className="bg-white/80 backdrop-blur-lg">
            <CardHeader>
              <CardTitle>Filters</CardTitle>
              <CardDescription>Refine your search results</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Jurisdiction</label>
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
                  <label className="text-sm font-medium">Legal Topic</label>
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
                  <label className="text-sm font-medium">Date Range</label>
                  <div className="flex gap-2">
                    <Calendar
                      mode="single"
                      selected={filters.startDate}
                      onSelect={(date) => setFilters(prev => ({ ...prev, startDate: date }))}
                      className="rounded-md border"
                    />
                    <Calendar
                      mode="single"
                      selected={filters.endDate}
                      onSelect={(date) => setFilters(prev => ({ ...prev, endDate: date }))}
                      className="rounded-md border"
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Pre-populated Documents */}
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mb-8">
            {isLoadingDocs ? (
              <Card className="col-span-full">
                <CardContent className="p-8">
                  <div className="flex items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin" />
                  </div>
                </CardContent>
              </Card>
            ) : (
              prePoulatedDocs?.map((doc) => (
                <Card
                  key={doc.id}
                  className="bg-white/80 backdrop-blur-lg hover:shadow-lg transition-shadow cursor-pointer"
                  onClick={() => setQuery(`Analyze the legal principles and implications of ${doc.title}`)}
                >
                  <CardContent className="p-6">
                    <div className="space-y-4">
                      <div className="flex items-start justify-between">
                        <h3 className="font-semibold">{doc.title}</h3>
                        <Badge variant="secondary">{doc.documentType}</Badge>
                      </div>
                      <p className="text-sm text-gray-600">
                        {doc.content.substring(0, 150)}...
                      </p>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-500">
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
            <Card className="bg-white/80 backdrop-blur-lg">
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
                    className="min-h-[120px]"
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
              <Card className="bg-white/80 backdrop-blur-lg">
                <CardContent className="p-8">
                  <div className="flex flex-col items-center justify-center space-y-4">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <p className="text-lg font-medium">Analyzing Legal Sources...</p>
                    <p className="text-sm text-gray-600">
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
              <>
                {/* Summary */}
                <Card className="bg-white/80 backdrop-blur-lg">
                  <CardHeader>
                    <CardTitle>Analysis Summary</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-gray-700">{result.summary}</p>
                  </CardContent>
                </Card>

                {/* Relevant Cases */}
                <Card className="bg-white/80 backdrop-blur-lg">
                  <CardHeader>
                    <CardTitle>Relevant Cases</CardTitle>
                    <CardDescription>
                      Found {result.relevantCases.length} related cases
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-[400px] pr-4">
                      <div className="space-y-4">
                        {result.relevantCases.map((item, index) => (
                          <Card key={index} className="bg-white">
                            <CardContent className="pt-6">
                              <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                  <h3 className="font-semibold">{item.document.title}</h3>
                                  <Badge variant="outline">{item.document.jurisdiction}</Badge>
                                </div>
                                <p className="text-sm text-gray-600">
                                  {item.document.content.substring(0, 200)}...
                                </p>
                                <div className="flex items-center justify-between text-sm">
                                  <span className="text-gray-500">
                                    {new Date(item.document.date).toLocaleDateString()}
                                  </span>
                                  <Badge>{item.relevance}</Badge>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>

                {/* Timeline */}
                <Card className="bg-white/80 backdrop-blur-lg">
                  <CardHeader>
                    <CardTitle>Legal Timeline</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {result.timeline.map((event, index) => (
                        <div key={index} className="flex items-start gap-4">
                          <div className="w-24 flex-shrink-0">
                            <span className="text-sm font-medium">{event.date}</span>
                          </div>
                          <div className="flex-1">
                            <p className="text-gray-700">{event.event}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Recommendations */}
                <Card className="bg-white/80 backdrop-blur-lg">
                  <CardHeader>
                    <CardTitle>Recommendations</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {result.recommendations.map((recommendation, index) => (
                        <li key={index} className="flex items-start gap-2">
                          <FileText className="h-5 w-5 text-green-600 mt-0.5" />
                          <span className="text-gray-700">{recommendation}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}