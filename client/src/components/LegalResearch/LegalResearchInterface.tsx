import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SearchResults } from "./SearchResults";
import { BriefAnalyzer } from "./BriefAnalyzer";
import { CitationChecker } from "./CitationChecker";
import { SearchFilters } from "./SearchFilters";
import { useToast } from "@/hooks/use-toast";
import {
  Search,
  Upload,
  BookOpen,
  Scale,
  AlertTriangle,
  Download,
} from "lucide-react";

export function LegalResearchInterface() {
  const [searchMode, setSearchMode] = useState<
    "natural" | "boolean" | "parallel"
  >("natural");
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState({
    jurisdiction: "all",
    legalTopic: "all",
    dateRange: {
      start: null,
      end: null,
    },
    documentTypes: [] as string[],
  });

  const { toast } = useToast();

  // Fetch search results
  const { data: searchResults, isLoading } = useQuery({
    queryKey: ["legal-search", query, searchMode, filters],
    queryFn: async () => {
      if (!query) return null;

      const response = await fetch("/api/legal-research/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query,
          searchMode,
          filters,
        }),
      });

      if (!response.ok) {
        throw new Error("Search failed");
      }

      return response.json();
    },
    enabled: !!query,
  });

  return (
    <div className="flex h-screen">
      {/* Left Sidebar - Search & Filters */}
      <div className="w-80 border-r border-gray-200 p-4 bg-gray-50">
        <div className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Search legal documents..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <Button variant="default" size="icon">
              <Search className="h-4 w-4" />
            </Button>
          </div>

          <Tabs
            defaultValue="natural"
            onValueChange={(v) => setSearchMode(v as any)}
          >
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="natural">Natural</TabsTrigger>
              <TabsTrigger value="boolean">Boolean</TabsTrigger>
              <TabsTrigger value="parallel">Parallel</TabsTrigger>
            </TabsList>
          </Tabs>

          <SearchFilters filters={filters} onChange={setFilters} />
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        <Tabs defaultValue="search" className="w-full">
          <TabsList className="w-full justify-start">
            <TabsTrigger value="search">
              <Search className="h-4 w-4 mr-2" />
              Search Results
            </TabsTrigger>
            <TabsTrigger value="brief">
              <Upload className="h-4 w-4 mr-2" />
              Brief Analyzer
            </TabsTrigger>
            <TabsTrigger value="citations">
              <Scale className="h-4 w-4 mr-2" />
              Citation Checker
            </TabsTrigger>
          </TabsList>

          <TabsContent value="search" className="p-4">
            <SearchResults
              results={searchResults?.documents || []}
              isLoading={isLoading}
            />
          </TabsContent>

          <TabsContent value="brief" className="p-4">
            <BriefAnalyzer />
          </TabsContent>

          <TabsContent value="citations" className="p-4">
            <CitationChecker />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
