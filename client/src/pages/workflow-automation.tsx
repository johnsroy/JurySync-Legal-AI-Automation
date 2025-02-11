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
  AlertTriangle
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
      title: "Intelligent Draft",
      description: "AI-powered document drafting with suggestions",
      status: currentStage >= 0 ? (currentStage === 0 ? 'processing' : 'completed') : 'pending' as const
    },
    {
      icon: Shield,
      title: "Compliance Check",
      description: "Automated compliance and risk assessment",
      status: currentStage >= 1 ? (currentStage === 1 ? 'processing' : 'completed') : 'pending' as const
    },
    {
      icon: Users,
      title: "Collaboration",
      description: "Team review and annotations",
      status: currentStage >= 2 ? (currentStage === 2 ? 'processing' : 'completed') : 'pending' as const
    },
    {
      icon: History,
      title: "Version Control",
      description: "Document versioning and audit trail",
      status: currentStage >= 3 ? (currentStage === 3 ? 'processing' : 'completed') : 'pending' as const
    },
    {
      icon: AlertTriangle,
      title: "Risk Analysis",
      description: "Continuous risk monitoring and updates",
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

        // Make appropriate API calls for each stage
        switch (i) {
          case 0: // Intelligent Draft
            await apiRequest('POST', '/api/workflow/draft', { text: documentText });
            break;
          case 1: // Compliance Check
            await apiRequest('POST', '/api/workflow/compliance', { documentId: '1' });
            break;
          case 2: // Collaboration
            await apiRequest('POST', '/api/workflow/collaborate', { documentId: '1' });
            break;
          case 3: // Version Control
            await apiRequest('POST', '/api/workflow/version', { documentId: '1' });
            break;
          case 4: // Risk Analysis
            await apiRequest('POST', '/api/workflow/risk', { documentId: '1' });
            break;
        }

        // Update progress
        for (let progress = 0; progress <= 100; progress += 10) {
          setWorkflowProgress(progress);
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      toast({
        title: "Workflow Complete",
        description: "Document has been processed successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to process document. Please try again.",
        variant: "destructive"
      });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50">
      <header className="bg-white/80 backdrop-blur-lg border-b border-indigo-100">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link href="/dashboard" className="flex items-center space-x-4 hover:text-indigo-600">
              <Gavel className="h-6 w-6 text-indigo-600" />
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

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900">
              Intelligent Legal Document Workflow
            </h1>
            <p className="mt-2 text-gray-600">
              AI-Powered Document Processing with Real-Time Collaboration
            </p>
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
        </div>
      </main>
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