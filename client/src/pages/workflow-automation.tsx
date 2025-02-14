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
  BarChart3,
  CheckCircle2
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
  const [currentStage, setCurrentStage] = useState<number>(0);
  const [stageStates, setStageStates] = useState<Record<number, WorkflowStageState>>({});
  const [documentAnalysis, setDocumentAnalysis] = useState<{
    fileName: string;
    documentType: string;
    industry: string;
    complianceStatus: string;
  } | null>(null);

  // Update document analysis whenever stage state changes
  useEffect(() => {
    const currentStageState = stageStates[currentStage];
    if (currentStageState?.status === 'completed' && currentStageState.result?.metadata) {
      const metadata = currentStageState.result.metadata;
      setDocumentAnalysis(prev => ({
        fileName: uploadedFiles[0]?.name || prev?.fileName || 'Untitled Document',
        documentType: metadata.documentType || prev?.documentType || 'Unknown',
        industry: metadata.industry || prev?.industry || 'Unknown',
        complianceStatus: metadata.complianceStatus || prev?.complianceStatus || 'Pending'
      }));
    }
  }, [currentStage, stageStates, uploadedFiles]);

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

    const stages = [
      {
        name: "Draft Generation",
        handler: async () => {
          const metadata = await documentAnalyticsService.processWorkflowResults([{
            stageType: "classification",
            content: documentText
          }]);

          setDocumentAnalysis(prev => ({
            fileName: uploadedFiles[0]?.name || prev?.fileName || 'Untitled Document',
            documentType: metadata.documentType || 'Unknown',
            industry: metadata.industry || 'Unknown',
            complianceStatus: metadata.complianceStatus || 'Pending'
          }));

          return {
            content: `Generated content...`,
            title: "Generated Legal Draft",
            metadata
          };
        }
      },
      {
        name: "Compliance Check",
        handler: async () => {
          // Simulate compliance analysis
          const complianceContent = `
            <h2>Compliance Analysis Report</h2>
            <p><strong>Overall Compliance Score:</strong> 85%</p>
            <h3>Key Findings:</h3>
            <ul>
              <li>✅ GDPR Compliance: Satisfactory</li>
              <li>⚠️ Data Protection: Minor revisions needed</li>
              <li>✅ Contract Terms: Compliant with local laws</li>
            </ul>
            <h3>Recommendations:</h3>
            <p>1. Add specific data retention periods</p>
            <p>2. Include breach notification procedures</p>
          `;

          // Add compliance analysis
          const metadata = await documentAnalyticsService.processWorkflowResults([{
            stageType: "compliance",
            content: documentText,
            status: "COMPLIANT", // This will be determined by actual compliance check
            riskScore: 85
          }]);

          setStageStates(prev => ({
            ...prev,
            1: {
              ...prev[1],
              metadata
            }
          }));

          return {
            content: complianceContent,
            title: "Compliance Analysis Report",
            metadata
          };
        }
      },
      {
        name: "Legal Research",
        handler: async () => {
          // Simulate legal research
          const researchContent = `
            <h2>Legal Research Findings</h2>
            <h3>Relevant Case Law:</h3>
            <ul>
              <li><a href="#">Smith v. Johnson (2024) - Similar contract dispute</a></li>
              <li><a href="#">Tech Corp v. Data Inc (2023) - Data protection precedent</a></li>
            </ul>
            <h3>Regulatory Framework:</h3>
            <ul>
              <li>Electronic Communications Privacy Act</li>
              <li>State Data Protection Laws</li>
            </ul>
            <h3>Additional Resources:</h3>
            <p>📚 Recommended Reading:</p>
            <ul>
              <li><a href="#">Guide to Modern Contract Law</a></li>
              <li><a href="#">Digital Privacy Compliance Handbook</a></li>
            </ul>
          `;

          const metadata = await documentAnalyticsService.processWorkflowResults([{
            stageType: "research",
            content: documentText
          }]);

          setStageStates(prev => ({
            ...prev,
            2: {
              ...prev[2],
              metadata
            }
          }));

          return {
            content: researchContent,
            title: "Legal Research Report",
            metadata
          };
        }
      },
      {
        name: "Approval Process",
        handler: async () => {
          try {
            // Perform approval analysis
            const approvalAnalysis = await approvalAuditService.performApprovalAnalysis(documentText);

            const approvalContent = `
              <h2>Document Approval Analysis</h2>
              <div class="mb-4">
                <h3 class="text-lg font-semibold">Risk Assessment</h3>
                <p class="text-xl font-bold ${
                  approvalAnalysis.riskScore < 30 ? 'text-green-600' :
                  approvalAnalysis.riskScore < 70 ? 'text-yellow-600' : 'text-red-600'
                }">Risk Score: ${approvalAnalysis.riskScore}/100</p>
                <p class="mt-2"><strong>Recommendation:</strong> ${approvalAnalysis.approvalRecommendation}</p>
              </div>

              <div class="mb-4">
                <h3 class="text-lg font-semibold">Key Findings</h3>
                <ul class="list-disc pl-5">
                  ${approvalAnalysis.keyFindings.map((finding: KeyFinding) => `
                    <li class="mb-2">
                      <span class="font-medium">${finding.category}:</span>
                      <span class="ml-2">${finding.finding}</span>
                      <span class="ml-2 px-2 py-1 text-sm rounded ${
                        finding.severity === 'LOW' ? 'bg-green-100 text-green-800' :
                        finding.severity === 'MEDIUM' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-red-100 text-red-800'
                      }">${finding.severity}</span>
                    </li>
                  `).join('')}
                </ul>
              </div>

              <div>
                <h3 class="text-lg font-semibold">Compliance Status</h3>
                <div class="grid gap-4">
                  ${approvalAnalysis.legalCompliance.map((item: ComplianceStatus) => `
                    <div class="p-4 rounded border">
                      <p class="font-medium">${item.requirement}</p>
                      <p class="mt-1 ${
                        item.status === 'COMPLIANT' ? 'text-green-600' :
                        item.status === 'NON_COMPLIANT' ? 'text-red-600' :
                        'text-yellow-600'
                      }">${item.status}</p>
                      <p class="mt-1 text-sm text-gray-600">${item.details}</p>
                    </div>
                  `).join('')}
                </div>
              </div>

              <div class="mt-6">
                <div id="approvalFormContainer"></div>
              </div>
            `;

            // Return the content and wait for approval
            return {
              content: approvalContent,
              title: "Approval Analysis Report"
            };
          } catch (error) {
            console.error("Approval process error:", error);
            throw error;
          }
        }
      },
      {
        name: "Final Audit",
        handler: async () => {
          // Generate final audit report
          const auditReport = await approvalAuditService.generateFinalAudit(
            documentText,
            stageStates
          );

          const auditContent = `
            <h2>Final Audit Report</h2>

            <div class="mb-6">
              <h3 class="text-lg font-semibold">Document Integrity</h3>
              <p class="text-xl font-bold mb-2">Score: ${auditReport.documentIntegrity.score}/100</p>
              <ul class="list-disc pl-5">
                ${auditReport.documentIntegrity.issues.map((issue: string) => `
                  <li class="text-gray-700">${issue}</li>
                `).join('')}
              </ul>
            </div>

            <div class="mb-6">
              <h3 class="text-lg font-semibold">Compliance Verification</h3>
              <div class="grid gap-4">
                ${auditReport.complianceVerification.map((item: {
                  regulation: string;
                  status: string;
                  recommendations: string[];
                }) => `
                  <div class="p-4 rounded border">
                    <p class="font-medium">${item.regulation}</p>
                    <p class="mt-1 ${
                      item.status.includes('COMPLIANT') ? 'text-green-600' : 'text-yellow-600'
                    }">${item.status}</p>
                    <ul class="mt-2 list-disc pl-5">
                      ${item.recommendations.map((rec: string) => `
                        <li class="text-sm text-gray-600">${rec}</li>
                      `).join('')}
                    </ul>
                  </div>
                `).join('')}
              </div>
            </div>

            <div class="mb-6">
              <h3 class="text-lg font-semibold">Risk Assessment</h3>
              <p class="text-xl font-bold mb-2 ${
                auditReport.riskAssessment.overallRisk === 'LOW' ? 'text-green-600' :
                auditReport.riskAssessment.overallRisk === 'MEDIUM' ? 'text-yellow-600' :
                'text-red-600'
              }">Overall Risk: ${auditReport.riskAssessment.overallRisk}</p>
              <div class="grid gap-4">
                ${auditReport.riskAssessment.categories.map((category: {
                  name: string;
                  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
                  details: string;
                }) => `
                  <div class="p-4 rounded border">
                    <p class="font-medium">${category.name}</p>
                    <p class="mt-1 ${
                      category.riskLevel === 'LOW' ? 'text-green-600' :
                      category.riskLevel === 'MEDIUM' ? 'text-yellow-600' :
                      'text-red-600'
                    }">${category.riskLevel}</p>
                    <p class="mt-1 text-sm text-gray-600">${category.details}</p>
                  </div>
                `).join('')}
              </div>
            </div>

            <div>
              <h3 class="text-lg font-semibold">Audit Trail</h3>
              <div class="space-y-2">
                ${auditReport.auditTrail.map((entry: {
                  timestamp: string;
                  action: string;
                  details: string;
                }) => `
                  <div class="flex items-start gap-2 text-sm">
                    <span class="text-gray-500">${new Date(entry.timestamp).toLocaleString()}</span>
                    <span class="font-medium">${entry.action}</span>
                    <span class="text-gray-600">${entry.details}</span>
                  </div>
                `).join('')}
              </div>
            </div>
          `;

          return {
            content: auditContent,
            title: "Final Audit Report"
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
          details: "Initializing process...",
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
              result,
              outputs: [...(prev[i]?.outputs || [])]
            }
          }));

          setWorkflowProgress((i + 1) * (100 / stages.length));

          addStageOutput(i, {
            message: `${stages[i].name} completed`,
            details: "Results ready for review",
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
    setDocumentAnalysis({
      fileName,
      documentType: 'Analyzing...',
      industry: 'Analyzing...',
      complianceStatus: 'In Progress'
    });
    toast({
      title: "Document Processed",
      description: "The document has been successfully parsed and loaded.",
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
      icon: BookOpen
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
    }
  ];


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
              Document Workflow Automation
            </h1>
            <p className="mt-2 text-gray-600">
              Process and analyze legal documents with AI assistance
            </p>
          </div>

          {/* Document Analysis Results Card - Moved to top */}
          <Card className="bg-white/80 backdrop-blur-lg">
            <CardHeader>
              <CardTitle>Document Analysis Results</CardTitle>
              <CardDescription>
                Automated classification and compliance assessment
              </CardDescription>
            </CardHeader>
            <CardContent>
              <DocumentAnalysisTable
                analysis={documentAnalysis}
                isLoading={!documentAnalysis || documentAnalysis.documentType === 'Analyzing...'}
              />
            </CardContent>
          </Card>

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
                          }/>
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
  );
}

export default WorkflowAutomation;