import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { debounce } from "lodash";
import { Template, TemplateCategory } from "@shared/schema/template-categories";
import { TemplateCard } from "@/components/TemplateCard";
import { TemplateCustomizationDialog } from "@/components/TemplateCustomizationDialog";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user

export default function ContractAutomation() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

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

  if (!user) {
    return null;
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-white">Contract Automation</h1>
        <div className="flex gap-4">
          <div className="relative w-64">
            <Input
              placeholder="Search templates..."
              onChange={(e) => debouncedSearch(e.target.value)}
              className="pl-10 bg-gray-800 border-gray-700 text-white"
            />
            <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
          </div>
        </div>
      </div>

      {templatesLoading ? (
        <Card className="p-8 bg-gray-800 border-gray-700">
          <div className="flex justify-center items-center">
            <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
          </div>
        </Card>
      ) : (
        <Tabs defaultValue="all" className="space-y-6">
          <TabsList className="bg-gray-800 border-gray-700">
            <TabsTrigger value="all" className="text-gray-300 data-[state=active]:bg-gray-700">
              All Templates
            </TabsTrigger>
            {Object.keys(templatesData?.templates || {}).map((category) => (
              <TabsTrigger 
                key={category} 
                value={category}
                className="text-gray-300 data-[state=active]:bg-gray-700"
              >
                {category}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="all">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Object.entries(templatesData?.templates || {}).map(([category, templates]) => (
                <div key={category}>
                  <h2 className="text-lg font-semibold mb-2 text-white">{category}</h2>
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
          </TabsContent>

          {Object.entries(templatesData?.templates || {}).map(([category, templates]) => (
            <TabsContent key={category} value={category}>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {(templates as Template[]).map((template) => (
                  <TemplateCard
                    key={template.id}
                    template={template}
                    onSelect={() => handleTemplateSelect(template)}
                  />
                ))}
              </div>
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
  );
}