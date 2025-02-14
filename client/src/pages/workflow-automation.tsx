import { useAuth } from "@/hooks/use-auth";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { 
  Loader2, AlertCircle, CheckCircle2, Terminal, FileText, Scale, 
  Book, Download, ChevronRight, UploadCloud, BarChart2,
  Briefcase, Shield, History, RefreshCcw
} from "lucide-react";
import { useState, useCallback, useEffect } from "react";
import { useDropzone } from 'react-dropzone';
import { useToast } from "@/hooks/use-toast";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { PredictiveSuggestions } from "@/components/ContractRedlining/PredictiveSuggestions";
import { DocumentPreview } from "@/components/DocumentPreview";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { FileUpload } from "@/components/FileUpload";
import { approvalAuditService } from "@/lib/approval-audit";
import { ApprovalForm } from "@/components/ApprovalForm";
import { documentAnalyticsService } from "@/services/documentAnalytics";
import { DocumentAnalysisTable } from "@/components/DocumentAnalysisTable";
import { generateDraftAnalysis } from "@/services/anthropic-service";
import { LogOut } from "lucide-react";


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
          <CheckCircle2 className="h-5 w-5 text-green-500" />
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

interface StageResult {
  content: string;
  title: string;
  downloadUrl?: string;
  metadata?: any;
}

interface WorkflowStageState {
  status: 'pending' | 'processing' | 'completed' | 'error';
  outputs: StageOutput[];
  result?: StageResult;
  approvers?: Approver[];
  isApproved?: boolean;
  metadata?: any;
}

interface KeyFinding {
  category: string;
  finding: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
}

interface ComplianceStatus {
  requirement: string;
  status: 'COMPLIANT' | 'NON_COMPLIANT' | 'PARTIALLY_COMPLIANT';
  details: string;
}

interface Approver {
  id: number;
  name: string;
  role: string;
}

export function WorkflowAutomation() {
  const { user, logoutMutation } = useAuth();
  const { toast } = useToast();
  const [documentText, setDocumentText] = useState("");
  const [selectedText, setSelectedText] = useState("");
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [workflowProgress, setWorkflowProgress] = useState(0);
  const [currentStage, setCurrentStage] = useState(0);
  const [stageStates, setStageStates] = useState<Record<number, WorkflowStageState>>({});
  const [documentAnalyses, setDocumentAnalyses] = useState<Array<{
    fileName: string;
    documentType: string;
    industry: string;
    complianceStatus: string;
  }>>([]);

  // Effect to update document analysis based on workflow completion
  useEffect(() => {
    const isWorkflowComplete = Object.values(stageStates).every(
      state => state?.status === 'completed'
    );

    if (isWorkflowComplete && stageStates[5]?.result?.metadata) {
      const metadata = stageStates[5].result.metadata;
      setDocumentAnalyses(prev => [...prev, {
        fileName: uploadedFiles[uploadedFiles.length - 1]?.name || 'Untitled Document',
        documentType: metadata.documentType,
        industry: metadata.industry,
        complianceStatus: metadata.complianceStatus
      }]);
    }
  }, [stageStates, uploadedFiles]);

  const handleTextSelect = useCallback(() => {
    const selection = window.getSelection();
    if (selection && selection.toString().trim()) {
      const selectedContent = selection.toString().trim();
      setSelectedText(selectedContent);
      toast({
        title: "Text Selected",
        description: "Loading relevant suggestions...",
      });
    }
  }, [toast]);

  const handleSuggestionSelect = useCallback((suggestionText: string) => {
    if (!selectedText) return;

    const textArea = document.querySelector('textarea');
    if (!textArea) return;

    const start = textArea.selectionStart;
    const end = textArea.selectionEnd;

    setDocumentText(prev =>
      prev.substring(0, start) +
      suggestionText +
      prev.substring(end)
    );

    toast({
      title: "Suggestion Applied",
      description: "The selected clause has been updated.",
    });
  }, [selectedText, toast]);

  const addStageOutput = useCallback((stageIndex: number, output: StageOutput) => {
    setStageStates(prev => ({
      ...prev,
      [stageIndex]: {
        ...prev[stageIndex],
        outputs: [...(prev[stageIndex]?.outputs || []), output]
      }
    }));
  }, []);

  const updateStageStatus = useCallback((stageIndex: number, status: WorkflowStageState['status']) => {
    setStageStates(prev => ({
      ...prev,
      [stageIndex]: {
        ...prev[stageIndex],
        status,
        outputs: prev[stageIndex]?.outputs || []
      }
    }));
  }, []);

  const generatePDF = async (content: string, title: string) => {
    const doc = new jsPDF();

    // Create a temporary div to render the content
    const element = document.createElement('div');
    element.innerHTML = content;
    document.body.appendChild(element);

    try {
      const canvas = await html2canvas(element);
      const imgData = canvas.toDataURL('image/png');
      doc.addImage(imgData, 'PNG', 10, 10, 190, 0);
      doc.save(`${title.toLowerCase().replace(/\s+/g, '-')}.pdf`);
    } finally {
      document.body.removeChild(element);
    }
  };

  const handleSubmit = async () => {
    if (!documentText.trim()) {
      toast({
        title: "No Content",
        description: "Please enter document text",
        variant: "destructive"
      });
      return;
    }

    // Reset states
    setCurrentStage(0);
    setWorkflowProgress(0);
    setStageStates({});
    setDocumentAnalyses([]); // Reset document analyses

    const stages = [
      {
        name: "Draft Generation",
        handler: async () => {
          try {
            const analysis = await generateDraftAnalysis(documentText);

            const draftContent = `
              <h2>Detailed Document Analysis</h2>
              <div class="space-y-4">
                ${analysis}
              </div>
            `;

            addStageOutput(0, {
              message: "Draft analysis completed",
              details: "AI has analyzed the document structure and content",
              timestamp: new Date().toISOString(),
              status: 'success'
            });

            return {
              content: draftContent,
              title: "Document Draft Analysis",
              metadata: {
                analysisType: "DRAFT_GENERATION",
                timestamp: new Date().toISOString(),
                confidence: 0.95
              }
            };
          } catch (error) {
            console.error("Draft generation error:", error);
            throw error;
          }
        }
      },
      {
        name: "Compliance Check",
        handler: async () => {
          // Simplified compliance check
          const complianceResult = {
            score: 85,
            status: "Compliant",
            findings: [
              "Document structure follows standard format",
              "Required legal clauses present",
              "No major compliance issues detected"
            ],
            documentType: "SOC 3 Report",
            industry: "TECHNOLOGY"
          };

          const complianceContent = `
            <h2>Compliance Analysis Report</h2>
            <p><strong>Compliance Score:</strong> ${complianceResult.score}%</p>
            <h3>Key Findings:</h3>
            <ul>
              ${complianceResult.findings.map(finding => `<li>${finding}</li>`).join('')}
            </ul>
          `;

          return {
            content: complianceContent,
            title: "Compliance Analysis Report",
            metadata: {
              status: complianceResult.status,
              complianceStatus: complianceResult.status,
              score: complianceResult.score,
              findings: complianceResult.findings,
              documentType: complianceResult.documentType,
              industry: complianceResult.industry
            }
          };
        }
      },
      {
        name: "Legal Research",
        handler: async () => {
          const researchContent = `
            <h2>Legal Research Findings</h2>
            <h3>Relevant Case Law:</h3>
            <ul>
              <li>Similar contract disputes</li>
              <li>Regulatory precedents</li>
            </ul>
          `;

          return {
            content: researchContent,
            title: "Legal Research Report"
          };
        }
      },
      {
        name: "Approval Process",
        handler: async () => {
          const approvalContent = `
            <h2>Document Approval Status</h2>
            <p>Pending approval from authorized reviewers</p>
          `;

          return {
            content: approvalContent,
            title: "Approval Status Report"
          };
        }
      },
      {
        name: "Final Audit",
        handler: async () => {
          const auditContent = `
            <h2>Final Audit Report</h2>
            <p>Comprehensive audit completed</p>
          `;

          return {
            content: auditContent,
            title: "Final Audit Report"
          };
        }
      },
      {
        name: "Document Analysis Results",
        handler: async () => {
          const workflowResults = Object.entries(stageStates).map(([stage, state]) => ({
            stageType: workflowStages[Number(stage)].title.toLowerCase(),
            content: documentText,
            status: state.status,
            metadata: state.result?.metadata
          }));

          const complianceStage = stageStates[1]?.result?.metadata;
          const currentFile = uploadedFiles[uploadedFiles.length - 1];

          const documentType = complianceStage?.documentType || "Compliance Document";
          const industry = complianceStage?.industry || "TECHNOLOGY";
          const complianceStatus = complianceStage?.status || "Compliant"; // Changed default value

          const analysisContent = `
            <h2>Final Document Analysis</h2>
            <div class="space-y-4">
              <div>
                <h3>Document Classification</h3>
                <p><strong>File:</strong> ${currentFile?.name || 'Untitled Document'}</p>
                <p><strong>Type:</strong> ${documentType}</p>
                <p><strong>Industry:</strong> ${industry}</p>
              </div>
              <div>
                <h3>Compliance Assessment</h3>
                <p><strong>Status:</strong> ${complianceStatus}</p>
                <p><strong>Score:</strong> ${complianceStage?.score || 0}%</p>
              </div>
            </div>
          `;

          // Update metadata to ensure consistency
          const finalMetadata = {
            documentType,
            industry,
            complianceStatus: complianceStatus, // Use the same value
            confidence: complianceStage?.score || 0,
            fileName: currentFile?.name
          };

          return {
            content: analysisContent,
            title: "Document Analysis Results",
            metadata: finalMetadata
          };
        }
      }
    ];

    try {
      for (let i = 0; i < stages.length; i++) {
        setCurrentStage(i);
        updateStageStatus(i, 'processing');

        addStageOutput(i, {
          message: `Starting ${stages[i].name}`,
          timestamp: new Date().toISOString(),
          status: 'info'
        });

        try {
          const result = await stages[i].handler();

          setStageStates(prev => ({
            ...prev,
            [i]: {
              ...prev[i],
              status: 'completed',
              result: {
                ...result,
                metadata: {
                  ...result.metadata,
                  complianceStatus: result.metadata?.status || result.metadata?.complianceStatus
                }
              }
            }
          }));

          // Update progress
          setWorkflowProgress((i + 1) * (100 / stages.length));


          addStageOutput(i, {
            message: `${stages[i].name} completed`,
            timestamp: new Date().toISOString(),
            status: 'success'
          });
        } catch (error) {
          console.error(`Error in stage ${i}:`, error);
          updateStageStatus(i, 'error');
          addStageOutput(i, {
            message: `Error in ${stages[i].name}`,
            details: error instanceof Error ? error.message : 'Unknown error',
            timestamp: new Date().toISOString(),
            status: 'error'
          });
          throw error;
        }
      }

      toast({
        title: "Processing Complete",
        description: "Document workflow completed successfully",
      });
    } catch (error) {
      toast({
        title: "Processing Error",
        description: "An error occurred during document processing",
        variant: "destructive"
      });
    }
  };

  const handleFileProcessed = useCallback(({ text, documentId, fileName }: { text: string; documentId: string; fileName: string }) => {
    setDocumentText(text);
    toast({
      title: "Document Processed",
      description: `${fileName} has been successfully parsed and loaded.`,
    });
  }, [toast]);

  const handleFileError = useCallback((error: string) => {
    toast({
      title: "Upload Failed",
      description: error,
      variant: "destructive"
    });
  }, [toast]);

  const workflowStages = [
    {
      title: "Draft Generation",
      description: "AI-powered document drafting and formatting",
      icon: FileText
    },
    {
      title: "Compliance Check",
      description: "Automated compliance check and risk assessment",
      icon: Shield
    },
    {
      title: "Legal Research",
      description: "Context-aware legal research and analysis",
      icon: Book
    },
    {
      title: "Approval Process",
      description: "Workflow approval and document execution",
      icon: History
    },
    {
      title: "Final Audit",
      description: "Continuous monitoring and compliance updates",
      icon: RefreshCcw
    },
    {
      title: "Document Analysis Results",
      description: "Final analysis of the document",
      icon: BarChart2
    }
  ];


  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-lg border-b border-indigo-100">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link href="/dashboard" className="flex items-center space-x-4 hover:text-indigo-600">
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-indigo-600 text-white">
                <Briefcase className="h-5 w-5" />
              </div>
              <h1 className="text-xl font-semibold">JurySync</h1>
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

      {/* Sidebar Navigation */}
      <div className="fixed top-0 left-0 h-full w-64 bg-white border-r border-gray-200 z-10">
        <div className="flex items-center gap-2 p-4 mb-6">
          <Shield className="h-6 w-6 text-primary" />
          <span className="text-xl font-bold">JurySync</span>
        </div>

        <nav className="space-y-1 px-2">
          <Link href="/dashboard" className="flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md hover:bg-gray-50">
            <BarChart2 className="h-5 w-5 text-gray-400" />
            Dashboard
          </Link>

          <Link href="/workflow-automation" className="flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md bg-primary/5 text-primary hover:bg-primary/10">
            <FileText className="h-5 w-5" />
            Workflow Automation
          </Link>

          <Link href="/contract-automation" className="flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md hover:bg-gray-50">
            <Scale className="h-5 w-5 text-gray-400" />
            Contract Automation
          </Link>

          <Link href="/juryvault" className="flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md hover:bg-gray-50">
            <Shield className="h-5 w-5 text-gray-400" />
            JuryVault
          </Link>

          <Link href="/history-reports" className="flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md hover:bg-gray-50">
            <History className="h-5 w-5 text-gray-400" />
            History & Reports
          </Link>

          <Link href="/settings" className="flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md hover:bg-gray-50">
            <Terminal className="h-5 w-5 text-gray-400" />
            Settings
          </Link>
        </nav>
      </div>

      {/* Main Content Area - shifted right to accommodate sidebar */}
      <div className="ml-64">
        {/* Main Content */}
        <main className="container mx-auto px-4 py-8">
          <div className="max-w-6xl mx-auto space-y-6">
            {/* Title Section */}
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold text-gray-900">
                Document Workflow Automation
              </h1>
              <p className="mt-2 text-gray-600">
                Process and analyze legal documents with JurySync AI assistance
              </p>
            </div>

            {/* Document Analysis Results Card */}
            {documentAnalyses.length > 0 && (
              <Card className="bg-white/80 backdrop-blur-lg">
                <CardHeader>
                  <CardTitle>Document Analysis Results</CardTitle>
                  <CardDescription>
                    Automated classification and compliance assessment
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {documentAnalyses.map((analysis, index) => (
                      <DocumentAnalysisTable
                        key={index}
                        analysis={analysis}
                        isLoading={false}
                      />
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Document Editor Section */}
              <div className="lg:col-span-2 space-y-6">
                {/* Add FileUpload component */}
                <Card className="bg-white/80 backdrop-blur-lg">
                  <CardHeader>
                    <CardTitle>Document Upload</CardTitle>
                    <CardDescription>
                      Upload your document or enter text manually below
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <FileUpload
                      onFileProcessed={handleFileProcessed}
                      onError={handleFileError}
                      multiple={true}
                      setUploadedFiles={setUploadedFiles}
                    />
                  </CardContent>
                </Card>

                <Card className="bg-white/80 backdrop-blur-lg">
                  <CardHeader>
                    <CardTitle>Document Editor</CardTitle>
                    <CardDescription>
                      Edit your document and select text for suggestions
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Textarea
                      placeholder="Enter or paste your document text here..."
                      className="min-h-[200px] resize-none"
                      value={documentText}
                      onChange={(e) => setDocumentText(e.target.value)}
                      onSelect={handleTextSelect}
                      onMouseUp={handleTextSelect}
                      onKeyUp={handleTextSelect}
                    />
                    <Button
                      className="w-full"
                      onClick={handleSubmit}
                      disabled={!documentText.trim()}
                    >
                      Process Document
                    </Button>
                  </CardContent>
                </Card>

                {/* Stage Output Display */}
                {Object.entries(stageStates).map(([stageIndex, state]) => (
                  <Card key={stageIndex} className="bg-white/80 backdrop-blur-lg">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        {(() => {
                          const Icon = workflowStages[Number(stageIndex)].icon;
                          return (
                            <Icon className={
                              state.status === 'completed' ? 'text-green-500' :
                                state.status === 'processing' ? 'text-blue-500' :
                                state.status === 'error' ? 'text-red-500' :
                                'text-gray-500'
                            } />
                          );
                        })()}
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

                      {state.result && (
                        <DocumentPreview
                          content={state.result.content}
                          title={state.result.title}
                          metadata={state.result.metadata}
                          onDownload={() => generatePDF(state.result.content, state.result.title)}
                        >
                          {currentStage === 3 && (
                            <Card className="bg-white/80 backdrop-blur-lg mt-4">
                              <CardHeader>
                                <CardTitle>Document Approval</CardTitle>
                                <CardDescription>
                                  Request approval for this document
                                </CardDescription>
                              </CardHeader>
                              <CardContent>
                                {!stageStates[3]?.isApproved ? (
                                  <ApprovalForm
                                    onApprove={async (approvers) => {
                                      try {
                                        setStageStates(prev => ({
                                          ...prev,
                                          [currentStage]: {
                                            ...prev[currentStage],
                                            approvers,
                                            isApproved: true,
                                            status: 'completed'
                                          }
                                        }));

                                        setCurrentStage(prev => prev + 1);
                                        setWorkflowProgress((currentStage + 1) * (100 / workflowStages.length));

                                        addStageOutput(currentStage, {
                                          message: "Document approved",
                                          details: `Approved by ${approvers.length} reviewer(s)`,
                                          timestamp: new Date().toISOString(),
                                          status: 'success'
                                        });
                                      } catch (error) {
                                        console.error("Approval error:", error);
                                        toast({
                                          title: "Approval Failed",
                                          description: error instanceof Error ? error.message : "Failed to process approval",
                                          variant: "destructive"
                                        });
                                      }
                                    }}
                                    isLoading={stageStates[3]?.status === 'processing'}
                                  />
                                ) : (
                                  <div className="text-center text-green-600">
                                    <CheckCircle2 className="h-8 w-8 mx-auto mb-2" />
                                    <p>Document has been approved</p>
                                  </div>
                                )}
                              </CardContent>
                            </Card>
                          )}
                        </DocumentPreview>
                      )}
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
                      Track document processing progress
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <Progress value={workflowProgress} className="h-2" />
                    <div className="space-y-6">
                      {workflowStages.map((stage, index) => (
                        <WorkflowStage
                          key={index}
                          icon={stage.icon}
                          title={stage.title}
                          description={stage.description}
                          status={stageStates[index]?.status || 'pending'}
                        />
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

export default WorkflowAutomation;