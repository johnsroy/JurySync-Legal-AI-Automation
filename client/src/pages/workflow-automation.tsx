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
  AlertTriangle,
  Clock,
  BarChart3
} from "lucide-react";
import { useState } from "react";
import { useDropzone } from 'react-dropzone';
import { useToast } from "@/hooks/use-toast";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { PredictiveSuggestions } from "@/components/ContractRedlining/PredictiveSuggestions";

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

// Enhanced FileUploadZone with preprocessing
const FileUploadZone: React.FC<{ onFileSelect: (files: File[]) => void }> = ({ onFileSelect }) => {
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      'application/pdf': ['.pdf'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'text/plain': ['.txt']
    },
    onDrop: async (acceptedFiles) => {
      const processedFiles = acceptedFiles.map(async (file) => {
        if (file.type === 'text/plain') {
          const text = await file.text();
          const cleanedText = cleanDocumentText(text);
          return new File(
            [cleanedText],
            file.name,
            { type: 'text/plain' }
          );
        }
        return file;
      });

      const cleanedFiles = await Promise.all(processedFiles);
      onFileSelect(cleanedFiles);
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

interface StageOutput {
  message: string;
  details?: string;
  timestamp: string;
  status: 'success' | 'warning' | 'error' | 'info';
}

interface WorkflowStageState {
  status: 'pending' | 'processing' | 'completed' | 'error';
  outputs: StageOutput[];
}

export const WorkflowAutomation: React.FC = () => {
  const { user, logoutMutation } = useAuth();
  const { toast } = useToast();
  const [documentText, setDocumentText] = useState("");
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [workflowProgress, setWorkflowProgress] = useState(0);
  const [currentStage, setCurrentStage] = useState<number>(0);
  const [selectedText, setSelectedText] = useState("");
  const [stageStates, setStageStates] = useState<Record<number, WorkflowStageState>>({});

  // Enhanced text selection handler
  const handleTextSelect = () => {
    const selection = window.getSelection();
    if (selection && selection.toString().trim()) {
      const selectedContent = selection.toString().trim();
      setSelectedText(selectedContent);
      // Trigger suggestions loading when text is selected
      toast({
        title: "Text Selected",
        description: "Loading relevant suggestions...",
      });
    }
  };

  const handleSuggestionSelect = (suggestionText: string) => {
    setDocumentText((prevText) => {
      if (!selectedText) return prevText;
      return prevText.replace(selectedText, suggestionText);
    });
    toast({
      title: "Suggestion Applied",
      description: "The selected clause has been updated.",
    });
  };

  const addStageOutput = (stageIndex: number, output: StageOutput) => {
    setStageStates(prev => ({
      ...prev,
      [stageIndex]: {
        ...prev[stageIndex],
        outputs: [...(prev[stageIndex]?.outputs || []), output]
      }
    }));
  };

  const updateStageStatus = (stageIndex: number, status: WorkflowStageState['status']) => {
    setStageStates(prev => ({
      ...prev,
      [stageIndex]: {
        ...prev[stageIndex],
        status,
        outputs: prev[stageIndex]?.outputs || []
      }
    }));
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

    // Reset progress
    setCurrentStage(0);
    setWorkflowProgress(0);
    setStageStates({});

    // Simulate workflow stages with detailed outputs
    for (let i = 0; i <= 4; i++) {
      setCurrentStage(i);
      updateStageStatus(i, 'processing');

      // Simulate stage processing with outputs
      for (let progress = 0; progress <= 100; progress += 20) {
        setWorkflowProgress(progress);

        // Add stage-specific outputs
        const timestamp = new Date().toISOString();
        switch (i) {
          case 0:
            addStageOutput(i, {
              message: "Analyzing document structure",
              details: `Processing ${progress}% complete`,
              timestamp,
              status: 'info'
            });
            break;
          case 1:
            addStageOutput(i, {
              message: "Running compliance checks",
              details: `Verified ${progress}% of regulatory requirements`,
              timestamp,
              status: 'info'
            });
            break;
          case 2:
            addStageOutput(i, {
              message: "Conducting legal research",
              details: `Analyzed ${progress}% of relevant case law`,
              timestamp,
              status: 'info'
            });
            break;
          case 3:
            addStageOutput(i, {
              message: "Processing approvals",
              details: `Workflow approval progress: ${progress}%`,
              timestamp,
              status: 'info'
            });
            break;
          case 4:
            addStageOutput(i, {
              message: "Performing periodic audit",
              details: `Audit completion: ${progress}%`,
              timestamp,
              status: 'info'
            });
            break;
        }

        await new Promise(resolve => setTimeout(resolve, 200));
      }

      updateStageStatus(i, 'completed');
    }
  };

  const workflowStages = [
    {
      icon: FileText,
      title: "Draft Generation",
      description: "AI-powered document drafting and formatting",
      status: currentStage >= 0 ? (currentStage === 0 ? 'processing' : 'completed') : 'pending'
    },
    {
      icon: Shield,
      title: "Compliance Auditing",
      description: "Automated compliance check and risk assessment",
      status: currentStage >= 1 ? (currentStage === 1 ? 'processing' : 'completed') : 'pending'
    },
    {
      icon: BookOpen,
      title: "Legal Research & Summarization",
      description: "Context-aware legal research and analysis",
      status: currentStage >= 2 ? (currentStage === 2 ? 'processing' : 'completed') : 'pending'
    },
    {
      icon: History,
      title: "Approval & Execution",
      description: "Workflow approval and document execution",
      status: currentStage >= 3 ? (currentStage === 3 ? 'processing' : 'completed') : 'pending'
    },
    {
      icon: RefreshCcw,
      title: "Periodic Audit",
      description: "Continuous monitoring and compliance updates",
      status: currentStage >= 4 ? (currentStage === 4 ? 'processing' : 'completed') : 'pending'
    }
  ];

  const handleFileSelect = (files: File[]) => {
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
      description: `${files.length} file(s) ready for upload`,
    });
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
        <div className="max-w-6xl mx-auto space-y-6">
          {/* Title Section */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900">
              Full Lifecycle Automation Workflow
            </h1>
            <p className="mt-2 text-gray-600">
              From Draft to Execution – Automating 80% of Legal Compliance Tasks
            </p>
          </div>

          {/* Navigation */}
          <div className="flex justify-center gap-4 mb-8">
            {[
              { icon: Shield, label: "Compliance Audit", href: "/compliance-auditing" },
              { icon: FileText, label: "Contract Automation", href: "/contract-automation" },
              { icon: BookOpen, label: "Legal Research", href: "/legal-research" },
              { icon: History, label: "History & Reports", href: "/reports" }
            ].map((item) => (
              <Link key={item.href} href={item.href}>
                <Button variant="outline" className="gap-2">
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Button>
              </Link>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Document Upload and Editor Section */}
            <div className="lg:col-span-2 space-y-6">
              <Card className="bg-white/80 backdrop-blur-lg">
                <CardHeader>
                  <CardTitle>Document Upload</CardTitle>
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
                      onMouseUp={handleTextSelect}
                      onKeyUp={handleTextSelect}
                      onSelect={handleTextSelect}
                    />
                  </div>

                  <Button
                    className="w-full"
                    onClick={handleSubmit}
                    disabled={!documentText.trim() && uploadedFiles.length === 0}
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Submit for Automation
                  </Button>
                </CardContent>
              </Card>

              {/* Stage Output Display */}
              {Object.entries(stageStates).map(([stageIndex, state]) => (
                <Card key={stageIndex} className="bg-white/80 backdrop-blur-lg">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      {workflowStages[Number(stageIndex)].icon}
                      {workflowStages[Number(stageIndex)].title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {state.outputs.map((output, idx) => (
                      <div
                        key={idx}
                        className={`p-4 rounded-lg border ${
                          output.status === 'error' ? 'border-red-200 bg-red-50' :
                            output.status === 'warning' ? 'border-yellow-200 bg-yellow-50' :
                              output.status === 'success' ? 'border-green-200 bg-green-50' :
                                'border-blue-200 bg-blue-50'
                        }`}
                      >
                        <p className="font-medium">{output.message}</p>
                        {output.details && (
                          <p className="text-sm text-muted-foreground mt-1">
                            {output.details}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground mt-2">
                          {new Date(output.timestamp).toLocaleTimeString()}
                        </p>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Predictive Suggestions Section */}
            <div className="space-y-6">
              <PredictiveSuggestions
                selectedText={selectedText}
                onSuggestionSelect={handleSuggestionSelect}
              />
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
                        <WorkflowStage
                          icon={stage.icon}
                          title={stage.title}
                          description={stage.description}
                          status={stageStates[index]?.status || 'pending'}
                        />
                        {index < workflowStages.length - 1 && (
                          <div className="absolute left-5 top-14 bottom-0 w-px bg-gray-200" />
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default WorkflowAutomation;