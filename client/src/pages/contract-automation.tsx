import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Search, Wand2, Sparkles, Bot } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { debounce } from "lodash";
import { Template } from "@shared/schema/template-categories";
import { TemplateCard } from "@/components/TemplateCard";
import { TemplateCustomizationDialog } from "@/components/TemplateCustomizationDialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user

function AIFeatureCard({ title, description, icon: Icon }: { title: string; description: string; icon: any }) {
  return (
    <Card className="bg-gray-800/50 border-gray-700 hover:bg-gray-800 transition-all">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-white">
          <Icon className="h-5 w-5 text-blue-400" />
          {title}
        </CardTitle>
        <CardDescription className="text-gray-400">{description}</CardDescription>
      </CardHeader>
    </Card>
  );
}

export default function ContractAutomation() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);

  // Fetch templates with react-query
  const { data: templatesData, isLoading: templatesLoading } = useQuery({
    queryKey: ["templates", searchQuery],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (searchQuery) params.append("search", searchQuery);

      const response = await fetch(`/api/contract-automation/templates?${params}`);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to fetch templates');
      }
      return response.json();
    }
  });

  // Intelligent suggestions
  const { data: aiSuggestions } = useQuery({
    queryKey: ["suggestions", searchQuery],
    queryFn: async () => {
      const response = await fetch(`/api/contract-automation/suggestions?q=${searchQuery}`);
      if (!response.ok) throw new Error("Failed to fetch suggestions");
      return response.json();
    },
    enabled: searchQuery.length > 2
  });

  // Debounced search
  const debouncedSearch = useCallback(
    debounce((value: string) => {
      setSearchQuery(value);
    }, 300),
    []
  );

  // Template generation mutation
  const generateMutation = useMutation({
    mutationFn: async (variables: {
      templateId: string;
      variables: Record<string, string>;
      customClauses?: string[];
    }) => {
      const response = await fetch("/api/contract-automation/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(variables),
      });
      if (!response.ok) throw new Error("Failed to generate contract");
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Contract generated successfully",
      });
      setSelectedTemplate(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Generation Error",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const handleTemplateSelect = (template: Template) => {
    setSelectedTemplate(template);
  };

  const handleGenerateContract = async (variables: Record<string, string>, customClauses: string[]) => {
    if (!selectedTemplate) return;

    generateMutation.mutate({
      templateId: selectedTemplate.id,
      variables,
      customClauses
    });
  };

  useEffect(() => {
    if (aiSuggestions?.suggestions) {
      setSuggestions(aiSuggestions.suggestions);
    }
  }, [aiSuggestions]);

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100">
      <div className="container mx-auto py-6 space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">Contract Automation</h1>
            <p className="text-gray-400">AI-powered contract generation and management</p>
          </div>
          <div className="flex gap-4">
            <div className="relative w-96">
              <Input
                placeholder="Search templates or describe your needs..."
                onChange={(e) => debouncedSearch(e.target.value)}
                className="pl-10 bg-gray-800 border-gray-700 text-white"
              />
              <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
              {suggestions.length > 0 && (
                <div className="absolute w-full mt-2 bg-gray-800 border border-gray-700 rounded-md shadow-lg z-10">
                  {suggestions.map((suggestion, index) => (
                    <div
                      key={index}
                      className="px-4 py-2 hover:bg-gray-700 cursor-pointer text-sm"
                      onClick={() => setSearchQuery(suggestion)}
                    >
                      {suggestion}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <AIFeatureCard
            title="Smart Suggestions"
            description="AI-powered template recommendations based on your requirements"
            icon={Wand2}
          />
          <AIFeatureCard
            title="Intelligent Completion"
            description="Auto-complete clauses and terms as you type"
            icon={Sparkles}
          />
          <AIFeatureCard
            title="Multi-Agent Analysis"
            description="Multiple AI agents working together to perfect your contracts"
            icon={Bot}
          />
        </div>

        {templatesLoading ? (
          <Card className="p-8 bg-gray-800 border-gray-700">
            <div className="flex justify-center items-center">
              <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
            </div>
          </Card>
        ) : (
          <Tabs defaultValue="all" className="space-y-6">
            <TabsList className="bg-gray-800 border-gray-700 p-1">
              <TabsTrigger
                value="all"
                className="text-gray-300 data-[state=active]:bg-gray-700 data-[state=active]:text-white"
              >
                All Templates
              </TabsTrigger>
              {Object.keys(templatesData?.templates || {}).map((category) => (
                <TabsTrigger
                  key={category}
                  value={category}
                  className="text-gray-300 data-[state=active]:bg-gray-700 data-[state=active]:text-white"
                >
                  {category}
                </TabsTrigger>
              ))}
            </TabsList>

            <TabsContent value="all">
              <ScrollArea className="h-[calc(100vh-300px)]">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {Object.entries(templatesData?.templates || {}).map(([category, templates]) => (
                    <div key={category}>
                      <div className="flex items-center gap-2 mb-4">
                        <h2 className="text-xl font-semibold text-white">{category}</h2>
                        <Badge variant="secondary" className="bg-blue-500/20 text-blue-300">
                          {(templates as Template[]).length} templates
                        </Badge>
                      </div>
                      {(templates as Template[]).map((template) => (
                        <TemplateCard
                          key={template.id}
                          template={template}
                          onSelect={() => handleTemplateSelect(template)}
                        />
                      ))}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </TabsContent>

            {Object.entries(templatesData?.templates || {}).map(([category, templates]) => (
              <TabsContent key={category} value={category}>
                <ScrollArea className="h-[calc(100vh-300px)]">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {(templates as Template[]).map((template) => (
                      <TemplateCard
                        key={template.id}
                        template={template}
                        onSelect={() => handleTemplateSelect(template)}
                      />
                    ))}
                  </div>
                </ScrollArea>
              </TabsContent>
            ))}
          </Tabs>
        )}

        {selectedTemplate && (
          <TemplateCustomizationDialog
            template={selectedTemplate}
            onGenerate={handleGenerateContract}
            onClose={() => setSelectedTemplate(null)}
          />
        )}
      </div>
    </div>
  );
}