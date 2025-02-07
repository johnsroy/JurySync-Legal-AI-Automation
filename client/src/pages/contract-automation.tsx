import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Loader2, FileText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";

// Define the template interface
interface Template {
  id: string;
  name: string;
  description: string;
  category: "EMPLOYMENT" | "NDA" | "SERVICE_AGREEMENT";
  variables: Array<{
    name: string;
    description: string;
    required: boolean;
  }>;
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

export default function ContractAutomation() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isGenerating, setIsGenerating] = useState(false);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [generatedContract, setGeneratedContract] = useState<{
    id: number;
    content: string;
    title: string;
  } | null>(null);

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

  // Fetch templates on component mount
  useEffect(() => {
    const fetchTemplates = async () => {
      try {
        const response = await fetch('/api/templates');
        if (!response.ok) {
          throw new Error('Failed to fetch templates');
        }
        const data = await response.json();
        setTemplates(data);
      } catch (error) {
        console.error('Failed to fetch templates:', error);
        toast({
          title: "Error",
          description: "Failed to load contract templates",
          variant: "destructive",
        });
      }
    };

    fetchTemplates();
  }, [toast]);

  // Handle template selection
  const handleTemplateSelect = (templateId: string) => {
    const template = templates.find(t => t.id === templateId);
    setSelectedTemplate(template || null);
    form.setValue('templateId', templateId);
  };

  const handleRequirementAdd = () => {
    const currentRequirements = form.getValues("requirements");
    form.setValue("requirements", [
      ...currentRequirements,
      {
        description: "",
        importance: "MEDIUM"
      }
    ]);
  };

  const handleRequirementRemove = (index: number) => {
    const currentRequirements = form.getValues("requirements");
    if (currentRequirements.length > 1) {
      form.setValue(
        "requirements",
        currentRequirements.filter((_, i) => i !== index)
      );
    }
  };

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    try {
      setIsGenerating(true);
      setGeneratedContract(null);

      console.log("Submitting contract generation request:", values);

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
      console.log("Generated contract:", data);

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

  const handleDownload = () => {
    if (!generatedContract) return;

    const blob = new Blob([generatedContract.content], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${generatedContract.title}.txt`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  if (!user) {
    return null;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Generate New Contract</CardTitle>
          <CardDescription>
            Select a template and specify your requirements
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="templateId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contract Template</FormLabel>
                    <Select onValueChange={handleTemplateSelect} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a template" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {templates.map((template) => (
                          <SelectItem key={template.id} value={template.id}>
                            {template.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {selectedTemplate && (
                      <p className="text-sm text-gray-500 mt-2">
                        {selectedTemplate.description}
                      </p>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />

              {selectedTemplate && (
                <>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <FormLabel>Requirements</FormLabel>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleRequirementAdd}
                      >
                        Add Requirement
                      </Button>
                    </div>

                    {form.watch("requirements").map((_, index) => (
                      <div key={index} className="space-y-4 p-4 border rounded">
                        <FormField
                          control={form.control}
                          name={`requirements.${index}.description`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Requirement Description</FormLabel>
                              <FormControl>
                                <Textarea {...field} placeholder="Describe your requirement..." />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name={`requirements.${index}.importance`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Importance</FormLabel>
                              <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select importance" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="HIGH">High</SelectItem>
                                  <SelectItem value="MEDIUM">Medium</SelectItem>
                                  <SelectItem value="LOW">Low</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          onClick={() => handleRequirementRemove(index)}
                          disabled={form.watch("requirements").length <= 1}
                        >
                          Remove Requirement
                        </Button>
                      </div>
                    ))}
                  </div>

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
                </>
              )}

              <Button 
                type="submit" 
                className="w-full" 
                disabled={isGenerating || !selectedTemplate}
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Generating...
                  </>
                ) : (
                  <>
                    <FileText className="h-4 w-4 mr-2" />
                    Generate Contract
                  </>
                )}
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
              <Button onClick={handleDownload}>
                Download Contract
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}