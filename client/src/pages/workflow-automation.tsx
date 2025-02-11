import { useAuth } from "@/hooks/use-auth";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Gavel,
  LogOut,
  Loader2,
  Shield,
  FileText,
  Upload,
  ChevronRight,
  History,
  BookOpen,
  FileCheck,
  RefreshCcw,
  MessageSquare,
  Users,
  AlertTriangle,
  Eye,
  Download
} from "lucide-react";
import { useState, useEffect } from "react";
import { useDropzone } from 'react-dropzone';
import { useToast } from "@/hooks/use-toast";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

// Document cleaning utility
const cleanDocumentText = (text: string): string => {
  if (!text) return '';
  return text
    .replace(/<!DOCTYPE\s+[^>]*>|<!doctype\s+[^>]*>/gi, '')
    .replace(/<\?xml\s+[^>]*\?>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

interface Comment {
  id: string;
  userId: string;
  userName: string;
  text: string;
  timestamp: Date;
  clauseId?: string;
}

interface ClauseSuggestion {
  id: string;
  text: string;
  riskScore: number;
  category: string;
  alternatives: string[];
}

export const WorkflowAutomation: React.FC = () => {
  const { user, logoutMutation } = useAuth();
  const { toast } = useToast();
  const [documentText, setDocumentText] = useState("");
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [workflowProgress, setWorkflowProgress] = useState(0);
  const [currentStage, setCurrentStage] = useState<number>(0);
  const [comments, setComments] = useState<Comment[]>([]);
  const [selectedClause, setSelectedClause] = useState<string | null>(null);

  // Query for fetching clause suggestions
  const { data: clauseSuggestions } = useQuery<ClauseSuggestion[]>({
    queryKey: ['/api/suggestions', documentText],
    queryFn: async () => {
      if (!documentText) return [];
      const response = await apiRequest('POST', '/api/suggestions', { text: documentText });
      return response.json();
    },
    enabled: !!documentText
  });

  // Mutation for adding comments
  const addCommentMutation = useMutation({
    mutationFn: async (comment: Omit<Comment, 'id' | 'timestamp'>) => {
      const response = await apiRequest('POST', '/api/comments', comment);
      return response.json();
    },
    onSuccess: (newComment) => {
      setComments(prev => [...prev, newComment]);
      toast({
        title: "Comment Added",
        description: "Your comment has been added successfully",
      });
    }
  });

  const workflowStages = [
    {
      icon: FileText,
      title: "Draft Generation",
      description: "AI-powered document drafting and formatting",
      status: currentStage >= 0 ? (currentStage === 0 ? 'processing' : 'completed') : 'pending' as const
    },
    {
      icon: Shield,
      title: "Compliance Review",
      description: "Automated compliance check and risk assessment",
      status: currentStage >= 1 ? (currentStage === 1 ? 'processing' : 'completed') : 'pending' as const
    },
    {
      icon: BookOpen,
      title: "Legal Research",
      description: "Context-aware legal research and analysis",
      status: currentStage >= 2 ? (currentStage === 2 ? 'processing' : 'completed') : 'pending' as const
    },
    {
      icon: History,
      title: "Approval",
      description: "Workflow approval and document execution",
      status: currentStage >= 3 ? (currentStage === 3 ? 'processing' : 'completed') : 'pending' as const
    },
    {
      icon: RefreshCcw,
      title: "Periodic Audit",
      description: "Continuous monitoring and compliance updates",
      status: currentStage >= 4 ? (currentStage === 4 ? 'processing' : 'completed') : 'pending' as const
    }
  ] as const;

  // Enhanced file upload handler
  const handleFileSelect = async (files: File[]) => {
    if (files.length > 5) {
      toast({
        title: "Too Many Files",
        description: "Please upload a maximum of 5 files at once",
        variant: "destructive"
      });
      return;
    }

    const totalSize = files.reduce((sum, file) => sum + file.size, 0);
    if (totalSize > 10 * 1024 * 1024) {
      toast({
        title: "Files Too Large",
        description: "Total file size should not exceed 10MB",
        variant: "destructive"
      });
      return;
    }

    setUploadedFiles(files);
    toast({
      title: "Files Added",
      description: `${files.length} file(s) ready for processing`,
    });

    // Start processing the first file
    if (files.length > 0) {
      const text = await files[0].text();
      const cleanedText = cleanDocumentText(text);
      setDocumentText(cleanedText);
      setCurrentStage(0);
    }
  };

  const handleSubmit = async () => {
    if (!documentText.trim() && uploadedFiles.length === 0) {
      toast({
        title: "No Content",
        description: "Please upload a file or enter document text",
        variant: "destructive"
      });
      return;
    }

    try {
      // Start workflow
      setCurrentStage(0);
      setWorkflowProgress(0);

      // Simulate workflow stages with actual API calls
      for (let i = 0; i <= 4; i++) {
        setCurrentStage(i);

        try {
          let response;
          const basePayload = {
            text: documentText,
            metadata: {
              type: uploadedFiles.length > 0 ? uploadedFiles[0].type : 'text/plain',
              fileName: uploadedFiles.length > 0 ? uploadedFiles[0].name : 'manual-input.txt'
            }
          };

          // Make appropriate API calls for each stage
          switch (i) {
            case 0: // Draft Generation
              response = await apiRequest('POST', '/api/workflow/draft', basePayload);
              break;
            case 1: // Compliance Check
              response = await apiRequest('POST', '/api/workflow/compliance', {
                ...basePayload,
                documentId: '1'
              });
              break;
            case 2: // Legal Research
              response = await apiRequest('POST', '/api/workflow/collaborate', {
                ...basePayload,
                documentId: '1'
              });
              break;
            case 3: // Approval
              response = await apiRequest('POST', '/api/workflow/version', {
                ...basePayload,
                documentId: '1'
              });
              break;
            case 4: // Periodic Audit
              response = await apiRequest('POST', '/api/workflow/risk', {
                ...basePayload,
                documentId: '1'
              });
              break;
          }

          if (!response.ok) {
            throw new Error(`Stage ${workflowStages[i].title} failed: ${response.statusText}`);
          }

          // Update progress
          for (let progress = 0; progress <= 100; progress += 10) {
            setWorkflowProgress(progress);
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        } catch (stageError) {
          console.error(`Error in stage ${workflowStages[i].title}:`, stageError);
          toast({
            title: `${workflowStages[i].title} Failed`,
            description: stageError instanceof Error ? stageError.message : 'Stage processing failed',
            variant: "destructive"
          });
          return;
        }
      }

      toast({
        title: "Workflow Complete",
        description: "Document has been processed successfully",
      });
    } catch (error) {
      console.error('Workflow error:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to process document. Please try again.",
        variant: "destructive"
      });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-lg border-b border-indigo-100">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link href="/dashboard" className="flex items-center space-x-4 hover:text-indigo-600">
              <Gavel className="h-6 w-6 text-indigo-600" />
              <h1 className="text-xl font-semibold">JurySync.io</h1>
            </Link>
          </div>
          <div className="hidden md:flex space-x-6">
            <Button variant="ghost" asChild>
              <Link href="/dashboard">Dashboard</Link>
            </Button>
            <Button variant="ghost" asChild>
              <Link href="/contract-automation">Contract Automation</Link>
            </Button>
            <Button variant="ghost" asChild>
              <Link href="/compliance-auditing">Compliance Audit</Link>
            </Button>
            <Button variant="ghost" asChild>
              <Link href="/legal-research">Legal Research</Link>
            </Button>
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

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Title Section */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900">
              End-to-End Legal Workflow Automation
            </h1>
            <p className="mt-2 text-gray-600">
              Streamline your legal processes with AI-powered automation
            </p>
          </div>

          {/* Workflow Progress Tracker */}
          <div className="mb-8">
            <h2 className="text-2xl font-bold mb-4">Workflow Progress</h2>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              {workflowStages.map((stage, index) => {
                const Icon = stage.icon;
                const isComplete = index < currentStage;
                const isCurrent = index === currentStage;

                return (
                  <div
                    key={stage.title}
                    className={`flex flex-col items-center p-4 rounded-lg border ${
                      isCurrent ? "border-primary bg-primary/5" :
                        isComplete ? "border-green-500 bg-green-50" : "border-gray-200"
                    }`}
                  >
                    <Icon className={`h-6 w-6 ${
                      isCurrent ? "text-primary" :
                        isComplete ? "text-green-500" : "text-gray-400"
                    }`} />
                    <span className="text-sm mt-2 text-center">{stage.title}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <Card className="bg-white/80 backdrop-blur-lg">
                <CardHeader>
                  <CardTitle>Document Upload & Editor</CardTitle>
                  <CardDescription>
                    Upload your legal documents or paste content directly
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FileUploadZone onFileSelect={handleFileSelect} />

                  {uploadedFiles.length > 0 && (
                    <div className="mt-4">
                      <h4 className="text-sm font-medium mb-2">Selected Files:</h4>
                      <ul className="space-y-2">
                        {uploadedFiles.map((file, index) => (
                          <li key={index} className="flex items-center gap-2 text-sm">
                            <FileText className="h-4 w-4" />
                            {file.name}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="relative">
                    <Textarea
                      placeholder="Or paste your document text here..."
                      className="min-h-[200px] resize-none"
                      value={documentText}
                      onChange={(e) => setDocumentText(e.target.value)}
                    />
                  </div>

                  <Button
                    className="w-full"
                    onClick={handleSubmit}
                    disabled={!documentText.trim() && uploadedFiles.length === 0}
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Process Document
                  </Button>
                </CardContent>
              </Card>

              <Card className="bg-white/80 backdrop-blur-lg">
                <CardHeader>
                  <CardTitle>Analysis & Collaboration</CardTitle>
                  <CardDescription>
                    View suggestions and collaborate with team members
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Tabs defaultValue="suggestions">
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="suggestions">Suggestions</TabsTrigger>
                      <TabsTrigger value="comments">Comments</TabsTrigger>
                    </TabsList>
                    <TabsContent value="suggestions">
                      <ScrollArea className="h-[300px] w-full rounded-md border p-4">
                        {clauseSuggestions?.map((suggestion) => (
                          <div
                            key={suggestion.id}
                            className="mb-4 p-3 rounded-lg border bg-white/50"
                          >
                            <div className="flex justify-between items-center mb-2">
                              <span className="font-medium">{suggestion.category}</span>
                              <span className={`px-2 py-1 rounded text-sm ${
                                suggestion.riskScore < 0.3 ? 'bg-green-100 text-green-800' :
                                  suggestion.riskScore < 0.7 ? 'bg-yellow-100 text-yellow-800' :
                                    'bg-red-100 text-red-800'
                              }`}>
                                Risk: {Math.round(suggestion.riskScore * 100)}%
                              </span>
                            </div>
                            <p className="text-sm text-gray-600 mb-2">{suggestion.text}</p>
                            {suggestion.alternatives.length > 0 && (
                              <div className="mt-2">
                                <span className="text-xs font-medium text-gray-500">Alternatives:</span>
                                <ul className="mt-1 space-y-1">
                                  {suggestion.alternatives.map((alt, idx) => (
                                    <li key={idx} className="text-sm text-gray-600 hover:text-indigo-600 cursor-pointer">
                                      • {alt}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        ))}
                      </ScrollArea>
                    </TabsContent>
                    <TabsContent value="comments">
                      <ScrollArea className="h-[300px] w-full rounded-md border p-4">
                        <div className="space-y-4">
                          {comments.map((comment) => (
                            <div key={comment.id} className="flex gap-4 p-3 rounded-lg border bg-white/50">
                              <div className="flex-1">
                                <div className="flex justify-between items-center mb-1">
                                  <span className="font-medium">{comment.userName}</span>
                                  <span className="text-xs text-gray-500">
                                    {new Date(comment.timestamp).toLocaleString()}
                                  </span>
                                </div>
                                <p className="text-sm text-gray-600">{comment.text}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-6">
              <Card className="bg-white/80 backdrop-blur-lg">
                <CardHeader>
                  <CardTitle>Workflow Progress</CardTitle>
                  <CardDescription>
                    Track the progress of your document through each stage
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <Progress value={workflowProgress} className="h-2" />

                  <div className="space-y-6">
                    {workflowStages.map((stage, index) => (
                      <div key={index} className="relative">
                        <WorkflowStage {...stage} />
                        {index < workflowStages.length - 1 && (
                          <div className="absolute left-5 top-14 bottom-0 w-px bg-gray-200" />
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-white/80 backdrop-blur-lg">
                <CardHeader>
                  <CardTitle>Process Analytics</CardTitle>
                  <CardDescription>Real-time workflow metrics</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {[
                    { label: "AI Suggestions", value: "15", description: "Relevant clauses" },
                    { label: "Risk Score", value: "Low", description: "Based on analysis" },
                    { label: "Processing Time", value: "2m", description: "Average" },
                    { label: "Updates", value: "5", description: "Regulatory changes" }
                  ].map((metric) => (
                    <div key={metric.label} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                      <div>
                        <p className="font-medium">{metric.label}</p>
                        <p className="text-sm text-gray-500">{metric.description}</p>
                      </div>
                      <span className="text-xl font-bold text-indigo-600">{metric.value}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Add Summary Panel */}
          <Card className="bg-white/80 backdrop-blur-lg">
            <CardHeader>
              <CardTitle>Performance Metrics</CardTitle>
              <CardDescription>Key automation and efficiency metrics</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {[
                  { label: "Tasks Automated", value: "80%", description: "Increased efficiency" },
                  { label: "Processing Time", value: "70%", description: "Time reduction" },
                  { label: "Labor Cost", value: "30-50%", description: "Cost savings" },
                  { label: "Error Reduction", value: "60%", description: "Improved accuracy" }
                ].map((metric) => (
                  <div key={metric.label} className="p-4 bg-gray-50 rounded-lg">
                    <h3 className="font-bold text-xl text-primary">{metric.value}</h3>
                    <p className="font-medium text-gray-700">{metric.label}</p>
                    <p className="text-sm text-gray-500">{metric.description}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="flex justify-end gap-4">
            <Button variant="outline" className="gap-2">
              <RefreshCcw className="h-4 w-4" />
              Retry Process
            </Button>
            <Button variant="outline" className="gap-2">
              <Eye className="h-4 w-4" />
              View Details
            </Button>
            <Button className="gap-2">
              <Download className="h-4 w-4" />
              Download Report
            </Button>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t mt-16 bg-card">
        <div className="container mx-auto px-4 py-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div>
              <div className="flex items-center space-x-2">
                <Gavel className="h-6 w-6 text-primary" />
                <span className="font-bold">JurySync</span>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                Transforming legal workflows with intelligent automation
              </p>
            </div>
            <div>
              <h3 className="font-medium mb-2">Contact</h3>
              <p className="text-sm text-muted-foreground">support@jurysync.com</p>
              <p className="text-sm text-muted-foreground">1-800-JURYSYNC</p>
            </div>
            <div>
              <h3 className="font-medium mb-2">Support</h3>
              <div className="space-y-1">
                <Button variant="link" className="p-0 h-auto text-sm">Help Center</Button>
                <Button variant="link" className="p-0 h-auto text-sm">Documentation</Button>
                <Button variant="link" className="p-0 h-auto text-sm">API Reference</Button>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

const FileUploadZone: React.FC<{ onFileSelect: (files: File[]) => void }> = ({ onFileSelect }) => {
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      'application/pdf': ['.pdf'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'text/plain': ['.txt']
    },
    onDrop: async (acceptedFiles) => {
      onFileSelect(acceptedFiles);
    },
    multiple: true
  });

  return (
    <div
      {...getRootProps()}
      className={`
        border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all
        ${isDragActive
          ? 'border-green-500 bg-green-50'
          : 'border-gray-300 hover:border-green-400 hover:bg-gray-50'
        }
      `}
    >
      <input {...getInputProps()} />
      <Upload className={`mx-auto h-12 w-12 ${isDragActive ? 'text-green-500' : 'text-gray-400'}`} />
      <p className="mt-2 text-sm text-gray-600">
        {isDragActive
          ? "Drop your documents here..."
          : "Drag and drop your documents here, or click to select"}
      </p>
      <p className="text-xs text-gray-500 mt-1">
        Supports PDF, DOCX, DOC, and TXT files
      </p>
    </div>
  );
};

const WorkflowStage: React.FC<{
  icon: React.ElementType;
  title: string;
  description: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
}> = ({ icon: Icon, title, description, status }) => {
  return (
    <div className="relative flex items-center gap-4">
      <div className={`
        w-10 h-10 rounded-full flex items-center justify-center
        ${status === 'completed' ? 'bg-green-100 text-green-600' :
          status === 'processing' ? 'bg-blue-100 text-blue-600' :
            status === 'error' ? 'bg-red-100 text-red-600' :
              'bg-gray-100 text-gray-600'}
      `}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <h4 className="font-medium text-gray-900">{title}</h4>
        <p className="text-sm text-gray-500">{description}</p>
      </div>
      {status === 'completed' && (
        <div className="absolute right-0">
          <FileCheck className="h-5 w-5 text-green-500" />
        </div>
      )}
      {status === 'processing' && (
        <div className="absolute right-0">
          <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
        </div>
      )}
      {status === 'error' && (
        <div className="absolute right-0">
          <RefreshCcw className="h-5 w-5 text-red-500" />
        </div>
      )}
    </div>
  );
};

export default WorkflowAutomation;