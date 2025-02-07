import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Loader2, FileText, Plus, Trash } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";

const requirementSchema = z.object({
  type: z.enum(["STANDARD", "CUSTOM", "INDUSTRY_SPECIFIC"]),
  description: z.string().min(1, "Description is required"),
  importance: z.enum(["HIGH", "MEDIUM", "LOW"])
});

const formSchema = z.object({
  templateType: z.enum(["EMPLOYMENT", "NDA", "SERVICE_AGREEMENT"]),
  requirements: z.array(requirementSchema).min(1, "At least one requirement is needed"),
  customInstructions: z.string().optional()
});

export default function ContractAutomation() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedContract, setGeneratedContract] = useState<{
    id: number;
    content: string;
    title: string;
  } | null>(null);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      templateType: "NDA",
      requirements: [{
        type: "STANDARD",
        description: "",
        importance: "MEDIUM"
      }],
      customInstructions: ""
    },
  });

  const handleRequirementAdd = () => {
    const currentRequirements = form.getValues("requirements");
    form.setValue("requirements", [
      ...currentRequirements,
      {
        type: "STANDARD",
        description: "",
        importance: "MEDIUM"
      }
    ]);
  };

  const handleRequirementRemove = (index: number) => {
    const currentRequirements = form.getValues("requirements");
    form.setValue("requirements", currentRequirements.filter((_, i) => i !== index));
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
        title: "Contract Generated Successfully",
        description: "You can now edit or download the contract",
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

  const handleEdit = () => {
    if (!generatedContract) return;
    setLocation(`/documents/${generatedContract.id}`);
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
            Create a new contract by specifying requirements
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="templateType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contract Type</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select contract type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="EMPLOYMENT">Employment Contract</SelectItem>
                        <SelectItem value="NDA">Non-Disclosure Agreement</SelectItem>
                        <SelectItem value="SERVICE_AGREEMENT">Service Agreement</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <FormLabel>Requirements</FormLabel>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleRequirementAdd}
                  >
                    <Plus className="h-4 w-4 mr-2" />
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
                            <Textarea {...field} placeholder="Describe the requirement..." />
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
                      className="w-full"
                    >
                      <Trash className="h-4 w-4 mr-2" />
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
                        placeholder="Add any special instructions..."
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button type="submit" className="w-full" disabled={isGenerating}>
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
            <CardTitle>Generated Contract</CardTitle>
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
                <Button onClick={handleEdit}>
                  Edit Contract
                </Button>
                <Button variant="outline" onClick={handleDownload}>
                  Download Contract
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}