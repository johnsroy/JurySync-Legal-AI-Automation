import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Loader2, FileText, Gavel, Scale, Check, Clock, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { useQuery, useMutation } from "@tanstack/react-query";
import { debounce } from "lodash";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Progress } from "@/components/ui/progress";
import { ContractRedlining } from "@/components/ContractRedlining/ContractRedlining";
import { ChevronDown, ChevronRight, FolderOpen } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// Keep only necessary interfaces and schemas
interface Template {
  id: string;
  name: string;
  description: string;
  category: string;
  subcategory?: string;
  baseContent: string;
  variables: Array<{
    name: string;
    description: string;
    required: boolean;
    type: string;
  }>;
  metadata: {
    complexity: "LOW" | "MEDIUM" | "HIGH";
    estimatedTime: string;
    industry?: string;
    jurisdiction?: string;
    popularityScore: number;
    tags: string[];
    useCase: string;
    recommendedClauses: string[];
  };
  popularity: number;
}

interface TemplateCategory {
  id: string;
  name: string;
  description: string;
  icon: string;
  templates: Template[];
}

interface RequirementSuggestion {
  description: string;
  importance: "HIGH" | "MEDIUM" | "LOW";
  context: string;
}

interface AutocompleteResponse {
  suggestions: string[];
  context?: string;
}

const requirementSchema = z.object({
  description: z.string().min(1, "Description is required"),
  importance: z.enum(["HIGH", "MEDIUM", "LOW"])
});

const formSchema = z.object({
  templateId: z.string().min(1, "Please select a template"),
  requirements: z.array(requirementSchema).min(1, "At least one requirement is needed"),
  customInstructions: z.string().optional()
});

function RequirementSuggestions({ templateId, currentDescription, onSelect }: {
  templateId: string;
  currentDescription?: string;
  onSelect: (suggestion: RequirementSuggestion) => void;
}) {
  const { data: suggestions, isLoading, error } = useQuery({
    queryKey: ['suggestions', templateId, currentDescription],
    queryFn: async () => {
      const response = await fetch(`/api/templates/${templateId}/suggest-requirements`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ currentDescription }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to fetch suggestions');
      }
      return response.json();
    },
    enabled: !!templateId
  });

  if (isLoading) return <div className="text-sm text-gray-500">Loading suggestions...</div>;
  if (error) {
    console.error('Suggestion error:', error);
    return <div className="text-sm text-red-500">Failed to load suggestions</div>;
  }
  if (!suggestions?.length) return null;

  return (
    <div className="space-y-2">
      <h4 className="text-sm font-medium">Suggested Requirements:</h4>
      <ScrollArea className="h-40">
        {suggestions.map((suggestion: RequirementSuggestion, index: number) => (
          <div
            key={index}
            className="p-2 hover:bg-gray-100 rounded cursor-pointer"
            onClick={() => onSelect(suggestion)}
          >
            <div className="flex justify-between items-center">
              <span className="text-sm">{suggestion.description}</span>
              <span className="text-xs px-2 py-1 rounded bg-blue-100">{suggestion.importance}</span>
            </div>
            <p className="text-xs text-gray-500 mt-1">{suggestion.context}</p>
          </div>
        ))}
      </ScrollArea>
    </div>
  );
}

function CustomInstructionsSuggestions({ templateId, currentRequirements, onSelect }: {
  templateId: string;
  currentRequirements: any[];
  onSelect: (suggestion: string) => void;
}) {
  const { data: suggestions, isLoading, error } = useQuery({
    queryKey: ['customInstructions', templateId, JSON.stringify(currentRequirements)],
    queryFn: async () => {
      const response = await fetch(`/api/templates/${templateId}/custom-instruction-suggestions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentRequirements }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to fetch custom instructions');
      }
      return response.json();
    },
    enabled: !!templateId && currentRequirements.length > 0
  });

  if (isLoading) return <div className="text-sm text-gray-500">Loading suggestions...</div>;
  if (error) {
    console.error('Custom instructions error:', error);
    return <div className="text-sm text-red-500">Failed to load custom instructions</div>;
  }
  if (!suggestions?.length) return null;

  return (
    <div className="space-y-2">
      <h4 className="text-sm font-medium">Suggested Custom Instructions:</h4>
      <ScrollArea className="h-40">
        {suggestions.map((suggestion: any, index: number) => (
          <div
            key={index}
            className="p-3 hover:bg-gray-100 rounded cursor-pointer border-l-4 border-blue-500 mb-2"
            onClick={() => onSelect(suggestion.instruction)}
          >
            <div className="font-medium text-sm">{suggestion.instruction}</div>
            <p className="text-xs text-gray-600 mt-1">{suggestion.explanation}</p>
          </div>
        ))}
      </ScrollArea>
    </div>
  );
}

function RequirementField({
  index,
  control,
  templateId,
  onSuggestionSelect
}: {
  index: number;
  control: any;
  templateId: string;
  onSuggestionSelect: (suggestion: string) => void;
}) {
  const [debouncedSearch] = useState(() =>
    debounce((text: string) => {
      if (text.length < 2) return;
      fetch(`/api/templates/${templateId}/autocomplete?text=${encodeURIComponent(text)}`)
        .then(res => res.json())
        .then(data => setLocalSuggestions(data.suggestions || []));
    }, 300)
  );

  const [localSuggestions, setLocalSuggestions] = useState<string[]>([]);
  const [isFocused, setIsFocused] = useState(false);

  return (
    <FormField
      control={control}
      name={`requirements.${index}.description`}
      render={({ field }) => (
        <FormItem className="relative">
          <FormLabel>Requirement Description</FormLabel>
          <div className="relative">
            <FormControl>
              <Textarea
                {...field}
                placeholder="Describe your requirement..."
                className="pr-8"
                onFocus={() => setIsFocused(true)}
                onBlur={() => setTimeout(() => setIsFocused(false), 200)}
                onChange={e => {
                  field.onChange(e);
                  debouncedSearch(e.target.value);
                }}
              />
            </FormControl>
            {isFocused && localSuggestions.length > 0 && (
              <div className="absolute w-full bg-white border rounded-md shadow-lg mt-1 z-50 max-h-48 overflow-y-auto">
                {localSuggestions.map((suggestion, i) => (
                  <div
                    key={i}
                    className="p-2 hover:bg-gray-100 cursor-pointer border-l-4 border-transparent hover:border-blue-500"
                    onClick={() => {
                      onSuggestionSelect(suggestion);
                      setLocalSuggestions([]);
                    }}
                  >
                    {suggestion}
                  </div>
                ))}
              </div>
            )}
          </div>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

function ContractGenerationLoadingIcon() {
  const [iconIndex, setIconIndex] = useState(0);
  const icons = [Gavel, Scale, FileText];
  const Icon = icons[iconIndex];

  useEffect(() => {
    const interval = setInterval(() => {
      setIconIndex((prev) => (prev + 1) % icons.length);
    }, 800);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex items-center">
      <Icon className="h-5 w-5 mr-2 animate-bounce" />
      <span>Generating Contract...</span>
    </div>
  );
}

function MetricsWidget({ title, value, icon: Icon, description }: {
  title: string;
  value: string;
  icon: any;
  description: string;
}) {
  return (
    <Card>
      <CardHeader className="space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex justify-between items-center">
          <div className="space-y-1">
            <p className="text-2xl font-bold">{value}</p>
            <p className="text-xs text-muted-foreground">
              {description}
            </p>
          </div>
          <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
            <Icon className="h-6 w-6 text-primary" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function DiffViewer({ original, modified }: { original: string; modified: string }) {
  return (
    <div className="grid grid-cols-2 gap-4">
      <div className="space-y-2">
        <h3 className="text-sm font-medium">Original</h3>
        <div className="p-4 rounded-md bg-muted">
          <pre className="text-sm whitespace-pre-wrap">{original}</pre>
        </div>
      </div>
      <div className="space-y-2">
        <h3 className="text-sm font-medium">Modified</h3>
        <div className="p-4 rounded-md bg-muted">
          <pre className="text-sm whitespace-pre-wrap">{modified}</pre>
        </div>
      </div>
    </div>
  );
}


function TemplateCategoryGroup({ category, onSelectTemplate }: {
  category: TemplateCategory;
  onSelectTemplate: (template: Template) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="w-full">
      <CollapsibleTrigger className="flex items-center w-full p-4 bg-gray-800/70 rounded-lg hover:bg-gray-700/70 transition-colors">
        <div className="flex items-center flex-1">
          <FolderOpen className="h-5 w-5 text-blue-400 mr-2" />
          <span className="text-lg font-medium text-white">{category.name}</span>
          <span className="text-sm text-gray-400 ml-2">({category.templates.length})</span>
        </div>
        {isOpen ? (
          <ChevronDown className="h-5 w-5 text-gray-400" />
        ) : (
          <ChevronRight className="h-5 w-5 text-gray-400" />
        )}
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-2 space-y-2">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-2">
          {category.templates.map((template) => (
            <Card key={template.id} className="flex flex-col bg-gray-800/50 border-gray-700 hover:border-blue-500/50 transition-colors">
              <CardHeader>
                <CardTitle className="text-xl text-white">{template.name}</CardTitle>
                <CardDescription className="text-gray-400">{template.description}</CardDescription>
              </CardHeader>
              <CardContent className="flex-grow space-y-4">
                <div className="bg-gray-900/50 p-4 rounded-lg border border-gray-700">
                  <pre className="whitespace-pre-wrap text-sm text-gray-300 max-h-48 overflow-y-auto">
                    {template.baseContent.slice(0, 200)}...
                  </pre>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm text-gray-400">
                    <span>Complexity: {template.metadata.complexity}</span>
                    <span>~{template.metadata.estimatedTime}</span>
                  </div>
                  <h4 className="font-semibold text-gray-200 mb-2">Required Fields:</h4>
                  <ul className="space-y-2">
                    {template.variables
                      .filter(v => v.required)
                      .map(v => (
                        <li key={v.name} className="flex items-start space-x-2 text-gray-300">
                          <span className="text-emerald-400 mt-1">•</span>
                          <span>{v.description}</span>
                        </li>
                      ))}
                  </ul>
                </div>
              </CardContent>
              <CardFooter>
                <Button
                  className="w-full bg-gray-700 hover:bg-gray-600 text-white"
                  onClick={() => onSelectTemplate(template)}
                >
                  Use This Template
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export default function ContractAutomation() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [isCustomizing, setIsCustomizing] = useState(false);
  const [generatedContract, setGeneratedContract] = useState<{
    id: number;
    content: string;
    title: string;
  } | null>(null);
  const [autocompleteSuggestions, setAutocompleteSuggestions] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [categories, setCategories] = useState<TemplateCategory[]>([]); // Added state for categories
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      templateId: "",
      requirements: [{
        description: "",
        importance: "MEDIUM"
      }],
      customInstructions: ""
    },
  });

  const debouncedAutocomplete = useCallback(
    debounce(async (templateId: string, text: string) => {
      if (text.length < 3) return;
      try {
        const response = await fetch(
          `/api/templates/${templateId}/autocomplete?text=${encodeURIComponent(text)}`
        );
        if (response.ok) {
          const data: AutocompleteResponse = await response.json();
          setAutocompleteSuggestions(data.suggestions);
        }
      } catch (error) {
        console.error('Autocomplete error:', error);
      }
    }, 300),
    []
  );

  // Fetch templates with react-query
  const { data: templatesData, isLoading: templatesLoading } = useQuery({
    queryKey: ["templates", searchQuery, selectedCategory],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (searchQuery) params.append("search", searchQuery);
      if (selectedCategory) params.append("category", selectedCategory);
      
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
      const response = await fetch("/api/contract-automation/templates/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(variables),
      });
      if (!response.ok) throw new Error("Failed to generate contract");
      return response.json();
    }
  });

  const handleTemplateSelect = (template: Template) => {
    setSelectedTemplate(template);
    form.setValue('templateId', template.id);
    setIsCustomizing(true);
  };

  const handleAddRequirement = () => {
    const currentRequirements = form.getValues("requirements");
    form.setValue("requirements", [
      ...currentRequirements,
      {
        description: "",
        importance: "MEDIUM"
      }
    ]);
  };

  const handleRemoveRequirement = (index: number) => {
    const currentRequirements = form.getValues("requirements");
    if (currentRequirements.length > 1) {
      form.setValue(
        "requirements",
        currentRequirements.filter((_, i) => i !== index)
      );
    }
  };

  const handleSuggestionSelect = (suggestion: RequirementSuggestion) => {
    const requirements = form.getValues("requirements");
    requirements[0] = {
      description: suggestion.description,
      importance: suggestion.importance
    };
    form.setValue("requirements", requirements);
  };

  const handleAutocompleteSelect = (index: number, suggestion: string) => {
    form.setValue(`requirements.${index}.description`, suggestion);
    setAutocompleteSuggestions([]);
  };

  const handleCustomInstructionSelect = (suggestion: string) => {
    const currentInstructions = form.getValues("customInstructions") || "";
    form.setValue(
      "customInstructions",
      currentInstructions ? `${currentInstructions}\n${suggestion}` : suggestion
    );
  };

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    try {
      setIsGenerating(true);
      setGeneratedContract(null);

      const response = await fetch('/api/documents/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(values)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to generate contract");
      }

      const data = await response.json();
      setGeneratedContract(data);

      toast({
        title: "Success",
        description: "Contract generated successfully",
      });

    } catch (error: any) {
      console.error('Generation error:', error);
      toast({
        title: "Generation Error",
        description: error.message || "Failed to generate contract",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = async (format: 'pdf' | 'docx') => {
    if (!generatedContract) return;

    try {
      const response = await fetch(`/api/documents/${generatedContract.id}/download/${format}`);

      if (!response.ok) {
        throw new Error(`Failed to download ${format.toUpperCase()} file`);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;
      a.download = `${generatedContract.title}.${format}`;
      document.body.appendChild(a);
      a.click();

      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "Success",
        description: `Contract downloaded as ${format.toUpperCase()}`,
      });
    } catch (error) {
      console.error(`Download error:`, error);
      toast({
        title: "Download Error",
        description: error.message || `Failed to download ${format.toUpperCase()} file`,
        variant: "destructive",
      });
    }
  };

  const [metrics] = useState({
    timeSaved: "4.5 hrs",
    errorReduction: "65%",
    completionRate: "92%",
    accuracy: "98%"
  });

  if (!user) {
    return null;
  }

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Contract Automation</h1>
        <div className="flex gap-4">
          <div className="relative w-64">
            <Input
              placeholder="Search templates..."
              onChange={(e) => debouncedSearch(e.target.value)}
              className="pl-10"
            />
            <Search className="absolute left-3 top-2.5 h-5 w-5 text-muted-foreground" />
          </div>
        </div>
      </div>

      {templatesLoading ? (
        <Card className="p-8">
          <div className="flex justify-center items-center">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        </Card>
      ) : (
        <Tabs defaultValue="all">
          <TabsList>
            <TabsTrigger value="all">All Templates</TabsTrigger>
            {Object.keys(templatesData?.templates || {}).map((category) => (
              <TabsTrigger key={category} value={category}>
                {category}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="all">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Object.entries(templatesData?.templates || {}).map(([category, templates]) => (
                <div key={category}>
                  <h2 className="text-lg font-semibold mb-2">{category}</h2>
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

      {/* Template Customization Dialog */}
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