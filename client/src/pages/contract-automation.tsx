import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Loader2, FileText, Gavel, Scale, Check, Clock, ShieldCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { useQuery } from "@tanstack/react-query";
import { debounce } from "lodash";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Progress } from "@/components/ui/progress";

// Define the template interface
interface Template {
  id: string;
  name: string;
  description: string;
  category: "EMPLOYMENT" | "NDA" | "SERVICE_AGREEMENT";
  baseContent: string;
  variables: Array<{
    name: string;
    description: string;
    required: boolean;
  }>;
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

function RequirementSuggestions({
  templateId,
  currentDescription,
  onSelect
}: {
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
      if (!response.ok) throw new Error('Failed to fetch suggestions');
      return response.json();
    },
    enabled: !!templateId
  });

  if (isLoading) return <div className="text-sm text-gray-500">Loading suggestions...</div>;
  if (error) return null;

  return (
    <div className="space-y-2">
      <h4 className="text-sm font-medium">Suggested Requirements:</h4>
      <ScrollArea className="h-40">
        {suggestions?.map((suggestion: RequirementSuggestion, index: number) => (
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

function CustomInstructionsSuggestions({
  templateId,
  currentRequirements,
  onSelect
}: {
  templateId: string;
  currentRequirements: any[];
  onSelect: (suggestion: string) => void;
}) {
  const { data: suggestions, isLoading } = useQuery({
    queryKey: ['customInstructions', templateId, currentRequirements],
    queryFn: async () => {
      const response = await fetch(`/api/templates/${templateId}/custom-instruction-suggestions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentRequirements }),
      });
      if (!response.ok) throw new Error('Failed to fetch suggestions');
      return response.json();
    },
    enabled: !!templateId && currentRequirements.length > 0
  });

  if (isLoading) return <div className="text-sm text-gray-500">Loading suggestions...</div>;

  return (
    <div className="space-y-2">
      <h4 className="text-sm font-medium">Suggested Custom Instructions:</h4>
      <ScrollArea className="h-40">
        {suggestions?.map((suggestion: any, index: number) => (
          <div
            key={index}
            className="p-3 hover:bg-gray-100 rounded cursor-pointer border-l-4 border-blue-500 mb-2"
            onClick={() => onSelect(suggestion.suggestion)}
          >
            <div className="font-medium text-sm">{suggestion.suggestion}</div>
            <p className="text-xs text-gray-600 mt-1">{suggestion.explanation}</p>
            <div className="text-xs text-blue-600 mt-1">
              Impact: {suggestion.impact}
            </div>
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

// Add new loading animation component
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


// Add MetricsWidget component
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

// Add DiffViewer component for redline comparison
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

  useEffect(() => {
    const fetchTemplates = async () => {
      try {
        setIsLoading(true);
        const response = await fetch('/api/templates');
        if (!response.ok) {
          throw new Error('Failed to fetch templates');
        }
        const data = await response.json();
        console.log("Fetched templates:", data);
        setTemplates(data);
      } catch (error) {
        console.error('Failed to fetch templates:', error);
        toast({
          title: "Error",
          description: "Failed to load contract templates",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchTemplates();
  }, [toast]);

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
    // Replace the first requirement with the suggested one
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
    <div className="container mx-auto px-4 py-8">
      {/* Add metrics section at the top */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <MetricsWidget
          title="Time Saved"
          value={metrics.timeSaved}
          icon={Clock}
          description="Average time saved per contract"
        />
        <MetricsWidget
          title="Error Reduction"
          value={metrics.errorReduction}
          icon={ShieldCheck}
          description="Reduction in contract errors"
        />
        <MetricsWidget
          title="Completion Rate"
          value={metrics.completionRate}
          icon={Check}
          description="Contracts completed successfully"
        />
        <MetricsWidget
          title="Accuracy"
          value={metrics.accuracy}
          icon={Scale}
          description="AI suggestions accuracy rate"
        />
      </div>

      {!isCustomizing ? (
        <>
          <h2 className="text-2xl font-bold mb-6">Select a Contract Template</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {templates.map((template) => (
              <Card key={template.id} className="flex flex-col">
                <CardHeader>
                  <CardTitle>{template.name}</CardTitle>
                  <CardDescription>{template.description}</CardDescription>
                </CardHeader>
                <CardContent className="flex-grow">
                  <div className="bg-gray-50 p-4 rounded-md">
                    <pre className="whitespace-pre-wrap text-sm max-h-48 overflow-y-auto">
                      {template.baseContent.slice(0, 200)}...
                    </pre>
                  </div>
                  <div className="mt-4">
                    <h4 className="font-semibold mb-2">Required Fields:</h4>
                    <ul className="list-disc list-inside text-sm text-gray-600">
                      {template.variables
                        .filter(v => v.required)
                        .map(v => (
                          <li key={v.name}>{v.description}</li>
                        ))}
                    </ul>
                  </div>
                </CardContent>
                <CardFooter>
                  <Button
                    className="w-full"
                    onClick={() => handleTemplateSelect(template)}
                  >
                    Use This Template
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        </>
      ) : (
        <>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold">Customize Your Contract</h2>
            <Button variant="outline" onClick={() => setIsCustomizing(false)}>
              Change Template
            </Button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left column: Customization form */}
            <Card className="lg:col-span-1">
              <CardHeader>
                <CardTitle>{selectedTemplate?.name}</CardTitle>
                <CardDescription>
                  Add your requirements to customize this template
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <FormLabel>Requirements</FormLabel>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={handleAddRequirement}
                        >
                          Add Requirement
                        </Button>
                      </div>

                      {form.watch("requirements").map((_, index) => (
                        <div key={index} className="space-y-4 p-4 border rounded">
                          <RequirementField
                            index={index}
                            control={form.control}
                            templateId={selectedTemplate?.id || ''}
                            onSuggestionSelect={(suggestion) => handleAutocompleteSelect(index, suggestion)}
                          />
                          <FormField
                            control={form.control}
                            name={`requirements.${index}.importance`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Importance</FormLabel>
                                <select
                                  {...field}
                                  className="w-full p-2 border rounded"
                                >
                                  <option value="HIGH">High Priority</option>
                                  <option value="MEDIUM">Medium Priority</option>
                                  <option value="LOW">Low Priority</option>
                                </select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            onClick={() => handleRemoveRequirement(index)}
                            disabled={form.watch("requirements").length <= 1}
                          >
                            Remove Requirement
                          </Button>
                        </div>
                      ))}
                    </div>

                    {selectedTemplate && (
                      <div className="mt-4">
                        <RequirementSuggestions
                          templateId={selectedTemplate.id}
                          currentDescription={form.watch("requirements")[form.watch("requirements").length - 1]?.description}
                          onSelect={handleSuggestionSelect}
                        />
                      </div>
                    )}

                    <FormField
                      control={form.control}
                      name="customInstructions"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Custom Instructions (Optional)</FormLabel>
                          <FormControl>
                            <div className="space-y-4">
                              <Textarea
                                {...field}
                                placeholder="Add any special instructions or notes..."
                                className="min-h-[100px]"
                              />
                              {selectedTemplate && (
                                <CustomInstructionsSuggestions
                                  templateId={selectedTemplate.id}
                                  currentRequirements={form.watch("requirements")}
                                  onSelect={handleCustomInstructionSelect}
                                />
                              )}
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <Button
                      type="submit"
                      className="w-full"
                      disabled={isGenerating}
                    >
                      {isGenerating ? (
                        <ContractGenerationLoadingIcon />
                      ) : (
                        <>
                          <Gavel className="h-4 w-4 mr-2" />
                          Generate Contract
                        </>
                      )}
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>

            {/* Right column: Preview and redline */}
            <div className="lg:col-span-1 space-y-6">
              {generatedContract && (
                <>
                  <Card>
                    <CardHeader>
                      <CardTitle>Generated Contract</CardTitle>
                      <CardDescription>
                        Review your generated contract with AI suggestions
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <DiffViewer
                          original={selectedTemplate?.baseContent || ''}
                          modified={generatedContract.content}
                        />
                        <div className="flex gap-4">
                          <Button onClick={() => handleDownload('pdf')}>
                            Download as PDF
                          </Button>
                          <Button onClick={() => handleDownload('docx')}>
                            Download as DOCX
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>AI Suggestions</CardTitle>
                      <CardDescription>
                        Review and apply AI-generated improvements
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ScrollArea className="h-[200px]">
                        {/* Placeholder for AI suggestions */}
                        <div className="space-y-2">
                          {[1, 2, 3].map((i) => (
                            <Alert key={i} className="cursor-pointer hover:bg-accent">
                              <AlertDescription>
                                Suggested improvement {i}
                              </AlertDescription>
                            </Alert>
                          ))}
                        </div>
                      </ScrollArea>
                    </CardContent>
                  </Card>
                </>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}