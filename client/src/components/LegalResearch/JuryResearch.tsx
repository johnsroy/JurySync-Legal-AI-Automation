import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SearchResults } from "./SearchResults";
import { CitationNetwork } from "./CitationNetwork";
import { BriefAnalyzer } from "./BriefAnalyzer";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

interface SearchResult {
  id: string;
  title: string;
  citation: string;
  summary: string;
  relevance: number;
  treatment: string;
}

export function JuryResearch() {
  const [query, setQuery] = useState("");
  const [searchMode, setSearchMode] = useState<"natural" | "boolean" | "parallel">("natural");
  const [activeTab, setActiveTab] = useState("search");
  const [selectedDocument, setSelectedDocument] = useState<SearchResult | null>(null);
  const { toast } = useToast();

  // Search mutation
  const searchMutation = useMutation({
    mutationFn: async (variables: { query: string; mode: string }) => {
      const response = await fetch("/api/jury-research/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(variables),
      });
      
      if (!response.ok) {
        throw new Error("Search failed");
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Search Complete",
        description: `Found ${data.results.length} results`,
      });
    },
    onError: (error) => {
      toast({
        title: "Search Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Citation analysis query
  const citationQuery = useQuery({
    queryKey: ['citations', selectedDocument?.id],
    queryFn: async () => {
      if (!selectedDocument?.id) return null;
      const response = await fetch(`/api/jury-research/citations/${selectedDocument.id}`);
      if (!response.ok) throw new Error('Failed to fetch citations');
      return response.json();
    },
    enabled: !!selectedDocument?.id,
  });

  const handleDocumentSelect = (document: SearchResult) => {
    setSelectedDocument(document);
    setActiveTab("citations");
  };

  return (
    <div className="container mx-auto p-6">
      <div className="flex flex-col space-y-6">
        {/* Search Interface */}
        <Card className="p-6">
          <div className="flex gap-4">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Enter your legal research query..."
              className="flex-1"
            />
            <Button
              onClick={() => searchMutation.mutate({ query, mode: searchMode })}
              disabled={searchMutation.isPending}
            >
              {searchMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Search
            </Button>
          </div>
          
          {/* Search Modes */}
          <Tabs value={searchMode} onValueChange={(value: any) => setSearchMode(value)} className="mt-4">
            <TabsList>
              <TabsTrigger value="natural">Natural Language</TabsTrigger>
              <TabsTrigger value="boolean">Boolean Search</TabsTrigger>
              <TabsTrigger value="parallel">Parallel Search</TabsTrigger>
            </TabsList>
          </Tabs>
        </Card>

        {/* Main Content Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="search">Search Results</TabsTrigger>
            <TabsTrigger value="citations" disabled={!selectedDocument}>
              Citation Network
            </TabsTrigger>
            <TabsTrigger value="brief" disabled={!selectedDocument}>
              Brief Analysis
            </TabsTrigger>
          </TabsList>

          <TabsContent value="search">
            {searchMutation.data && (
              <SearchResults 
                results={searchMutation.data.results}
                onDocumentSelect={handleDocumentSelect}
              />
            )}
          </TabsContent>

          <TabsContent value="citations">
            {selectedDocument && (
              <CitationNetwork 
                document={selectedDocument}
                citations={citationQuery.data}
                isLoading={citationQuery.isLoading}
              />
            )}
          </TabsContent>

          <TabsContent value="brief">
            {selectedDocument && (
              <BriefAnalyzer 
                document={selectedDocument}
                onCitationUpdate={(citations) => {
                  // Handle citation updates
                  citationQuery.refetch();
                }}
              />
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
} 