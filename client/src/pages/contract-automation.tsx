import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Search, Wand2, Sparkles, Bot } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { debounce } from "lodash";
import { Template } from "@shared/schema/template-categories";
import { TemplateCard } from "@/components/TemplateCard";
import { TemplateCustomizationDialog } from "@/components/TemplateCustomizationDialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

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
  const [selectedCategory, setSelectedCategory] = useState("all");

  // Fetch templates with react-query
  const { data, isLoading: templatesLoading, error } = useQuery({
    queryKey: ["templates", searchQuery],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (searchQuery) params.append("search", searchQuery);

      const response = await fetch(`/api/contract-automation/templates?${params}`);
      if (!response.ok) {
        throw new Error('Failed to fetch templates');
      }
      const data = await response.json();
      return data.templates as Template[];
    }
  });

  // Group templates by category
  const groupedTemplates = data?.reduce((acc, template) => {
    const category = template.category;
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(template);
    return acc;
  }, {} as Record<string, Template[]>) || {};

  // Get unique categories
  const categories = Object.keys(groupedTemplates);

  // Debounced search
  const debouncedSearch = useCallback(
    debounce((value: string) => {
      setSearchQuery(value);
    }, 300),
    []
  );

  const handleTemplateSelect = (template: Template) => {
    setSelectedTemplate(template);
  };

  if (!user) {
    return null;
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-900 text-gray-100 flex items-center justify-center">
        <Card className="bg-gray-800/50 border-gray-700 p-6">
          <CardHeader>
            <CardTitle className="text-red-400">Error Loading Templates</CardTitle>
            <CardDescription>{error instanceof Error ? error.message : 'Failed to load templates'}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
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
                placeholder="Search templates..."
                onChange={(e) => debouncedSearch(e.target.value)}
                className="pl-10 bg-gray-800 border-gray-700 text-white"
              />
              <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
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
              {categories.map((category) => (
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
                <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                  {Object.entries(groupedTemplates).map(([category, templates]) => (
                    <div key={category} className="space-y-4">
                      <div className="flex items-center gap-2">
                        <h2 className="text-xl font-semibold text-white">{category}</h2>
                        <Badge variant="secondary" className="bg-blue-500/20 text-blue-300">
                          {templates.length} templates
                        </Badge>
                      </div>
                      {templates.map((template) => (
                        <TemplateCard
                          key={template.id}
                          template={template}
                          onSelect={handleTemplateSelect}
                        />
                      ))}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </TabsContent>

            {categories.map((category) => (
              <TabsContent key={category} value={category}>
                <ScrollArea className="h-[calc(100vh-300px)]">
                  <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                    {groupedTemplates[category].map((template) => (
                      <TemplateCard
                        key={template.id}
                        template={template}
                        onSelect={handleTemplateSelect}
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
            isOpen={!!selectedTemplate}
            onClose={() => setSelectedTemplate(null)}
          />
        )}
      </div>
    </div>
  );
}