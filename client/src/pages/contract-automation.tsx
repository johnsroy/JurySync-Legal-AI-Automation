import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Loader2, FileText, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { useQuery } from "@tanstack/react-query";
import { debounce } from "lodash";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

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

function RequirementField({
  index,
  control,
  suggestions,
  onSuggestionSelect
}: {
  index: number;
  control: any;
  suggestions: string[];
  onSuggestionSelect: (suggestion: string) => void;
}) {
  return (
    <FormField
      control={control}
      name={`requirements.${index}.description`}
      render={({ field }) => (
        <FormItem>
          <FormLabel>Requirement Description</FormLabel>
          <div className="relative">
            <FormControl>
              <Textarea {...field} placeholder="Describe your requirement..." />
            </FormControl>
            {suggestions.length > 0 && (
              <div className="absolute w-full bg-white border rounded-md shadow-lg mt-1 z-10">
                {suggestions.map((suggestion, i) => (
                  <div
                    key={i}
                    className="p-2 hover:bg-gray-100 cursor-pointer"
                    onClick={() => onSuggestionSelect(suggestion)}
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
    const currentRequirements = form.getValues("requirements");
    form.setValue("requirements", [
      ...currentRequirements,
      {
        description: suggestion.description,
        importance: suggestion.importance
      }
    ]);
  };

  const handleAutocompleteSelect = (index: number, suggestion: string) => {
    form.setValue(`requirements.${index}.description`, suggestion);
    setAutocompleteSuggestions([]);
  };


  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    try {
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

          <Card className="mb-6">
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
                          suggestions={autocompleteSuggestions}
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
                          <Textarea
                            {...field}
                            placeholder="Add any special instructions or notes..."
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button type="submit" className="w-full">
                    <FileText className="h-4 w-4 mr-2" />
                    Generate Contract
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>

          {generatedContract && (
            <Card>
              <CardHeader>
                <CardTitle>{generatedContract.title}</CardTitle>
                <CardDescription>
                  Review your generated contract below
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="p-4 border rounded bg-gray-50">
                    <pre className="whitespace-pre-wrap font-mono text-sm">
                      {generatedContract.content}
                    </pre>
                  </div>
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
          )}
        </>
      )}
    </div>
  );
}