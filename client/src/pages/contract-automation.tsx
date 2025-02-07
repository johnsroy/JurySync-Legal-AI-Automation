import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Gavel, LogOut, Loader2, GitCompare, FileText, AlertCircle, Plus, Trash } from "lucide-react";
import { FilePond } from "react-filepond";
import { useToast } from "@/hooks/use-toast";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import "filepond/dist/filepond.min.css";

const requirementSchema = z.object({
  type: z.enum(["STANDARD", "CUSTOM", "INDUSTRY_SPECIFIC"]),
  description: z.string().min(1, "Description is required"),
  importance: z.enum(["HIGH", "MEDIUM", "LOW"]),
  industry: z.string().optional(),
  jurisdiction: z.string().optional(),
  specialClauses: z.array(z.string()).optional(),
});

const formSchema = z.object({
  templateType: z.enum(["EMPLOYMENT", "NDA", "SERVICE_AGREEMENT", "LEASE", "GENERAL"]),
  requirements: z.array(requirementSchema).min(1, "At least one requirement is needed"),
  customInstructions: z.string().optional(),
});

export default function ContractAutomation() {
  const { user, logoutMutation } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [processingState, setProcessingState] = useState<'idle' | 'uploading' | 'analyzing' | 'complete'>('idle');

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      templateType: "GENERAL",
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
    setIsUploading(true);
    setProcessingState('uploading');
    setProgress(10);

    try {
      const formData = new FormData();
      formData.append('templateType', values.templateType);
      formData.append('requirements', JSON.stringify(values.requirements));
      if (values.customInstructions) {
        formData.append('customInstructions', values.customInstructions);
      }
      formData.append('agentType', 'CONTRACT_AUTOMATION');

      setProgress(30);
      setProcessingState('analyzing');

      const response = await fetch('/api/documents/generate', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to generate document");
      }

      setProgress(80);
      const document = await response.json();

      setProgress(100);
      setProcessingState('complete');

      toast({
        title: "Document Generated Successfully",
        description: "Redirecting to the document editor...",
      });

      setTimeout(() => {
        setLocation(`/documents/${document.id}`);
      }, 1000);

    } catch (error: any) {
      console.error('Generation error:', error);
      toast({
        title: "Generation Error",
        description: error.message || "Failed to generate document. Please try again.",
        variant: "destructive",
      });
      setProcessingState('idle');
      setProgress(0);
    } finally {
      setIsUploading(false);
    }
  };

  const handleProcessFile = async (error: any, file: any) => {
    if (error) {
      toast({
        title: "Upload Error",
        description: "Failed to upload document. Please try again.",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);
    setProcessingState('uploading');
    setProgress(10);

    try {
      const formData = new FormData();
      formData.append('file', file.file);
      formData.append('title', file.filename);
      formData.append('agentType', 'CONTRACT_AUTOMATION');

      setProgress(30);
      setProcessingState('analyzing');

      const response = await fetch('/api/documents', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to process document");
      }

      setProgress(80);
      const document = await response.json();

      setProgress(100);
      setProcessingState('complete');

      toast({
        title: "Document Processed Successfully",
        description: "Redirecting to the document editor...",
      });

      setTimeout(() => {
        setLocation(`/documents/${document.id}`);
      }, 1000);

    } catch (error: any) {
      console.error('Upload error:', error);
      toast({
        title: "Processing Error",
        description: error.message || "Failed to process document. Please try again.",
        variant: "destructive",
      });
      setProcessingState('idle');
      setProgress(0);
    } finally {
      setIsUploading(false);
    }
  };

  const getProcessingMessage = () => {
    switch (processingState) {
      case 'uploading':
        return "Uploading your document...";
      case 'analyzing':
        return "Analyzing document with AI...";
      case 'complete':
        return "Processing complete!";
      default:
        return "";
    }
  };

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-yellow-50 to-green-50 animate-gradient-x">
      <header className="bg-white/80 backdrop-blur-lg border-b border-green-100">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link href="/dashboard" className="flex items-center space-x-4 hover:text-green-600">
              <Gavel className="h-6 w-6 text-green-600" />
              <h1 className="text-xl font-semibold">JurySync.io</h1>
            </Link>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">
              Welcome, {user?.firstName} {user?.lastName}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => logoutMutation.mutate()}
              disabled={logoutMutation.isPending}
            >
              {logoutMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <LogOut className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-4 mb-8">
            <GitCompare className="h-8 w-8 text-green-600" />
            <h2 className="text-3xl font-bold">Contract Automation</h2>
          </div>

          <div className="grid gap-6">
            <Card className="bg-white/80 backdrop-blur-lg">
              <CardHeader>
                <CardTitle>Generate New Contract</CardTitle>
                <CardDescription>
                  Create a new contract by specifying requirements and template type
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
                          <FormLabel>Contract Template</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select a template type" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="EMPLOYMENT">Employment Contract</SelectItem>
                              <SelectItem value="NDA">Non-Disclosure Agreement</SelectItem>
                              <SelectItem value="SERVICE_AGREEMENT">Service Agreement</SelectItem>
                              <SelectItem value="LEASE">Lease Agreement</SelectItem>
                              <SelectItem value="GENERAL">General Contract</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormDescription>
                            Choose a template that best matches your needs
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
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

                      {form.watch("requirements").map((req, index) => (
                        <div key={index} className="grid gap-4 p-4 border rounded-lg">
                          <FormField
                            control={form.control}
                            name={`requirements.${index}.type`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Type</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                  <FormControl>
                                    <SelectTrigger>
                                      <SelectValue placeholder="Select requirement type" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    <SelectItem value="STANDARD">Standard</SelectItem>
                                    <SelectItem value="CUSTOM">Custom</SelectItem>
                                    <SelectItem value="INDUSTRY_SPECIFIC">Industry Specific</SelectItem>
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name={`requirements.${index}.description`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Description</FormLabel>
                                <FormControl>
                                  <Textarea
                                    {...field}
                                    placeholder="Describe your requirement..."
                                  />
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
                                      <SelectValue placeholder="Select importance level" />
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
                              placeholder="Add any special instructions or notes..."
                            />
                          </FormControl>
                          <FormDescription>
                            Include any additional requirements or specific instructions
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <Button type="submit" className="w-full" disabled={isUploading}>
                      {isUploading ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <FileText className="h-4 w-4 mr-2" />
                      )}
                      Generate Contract
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>

            <Card className="bg-white/80 backdrop-blur-lg">
              <CardContent className="p-8">
                <div className="text-center mb-8">
                  <h3 className="text-xl font-semibold mb-2">Or Upload Existing Contract</h3>
                  <p className="text-gray-600">
                    Upload your contract for AI-powered analysis and automation
                  </p>
                </div>

                <div className="max-w-xl mx-auto">
                  <FilePond
                    allowMultiple={false}
                    acceptedFileTypes={[
                      'application/pdf',
                      'application/msword',
                      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                      'text/plain'
                    ]}
                    labelIdle='Drag & Drop your contract or <span class="filepond--label-action">Browse</span>'
                    disabled={isUploading}
                    onprocessfile={handleProcessFile}
                    onaddfilestart={() => {
                      setIsUploading(true);
                      setProcessingState('uploading');
                      setProgress(0);
                    }}
                    onremovefile={() => {
                      setIsUploading(false);
                      setProcessingState('idle');
                      setProgress(0);
                    }}
                  />

                  {processingState !== 'idle' && (
                    <div className="mt-6 space-y-4">
                      <Progress value={progress} className="w-full h-2" />
                      <div className="flex items-center justify-center gap-2 text-blue-600">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>{getProcessingMessage()}</span>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="bg-yellow-50 border-yellow-100">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-yellow-600" />
                  Supported File Types
                </CardTitle>
                <CardDescription>
                  We currently support PDF, Word documents (.doc, .docx), and plain text files.
                  For best results, ensure your document is clearly formatted.
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}