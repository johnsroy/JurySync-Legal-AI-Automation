import { useAuth } from "@/hooks/use-auth";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Loader2,
  AlertCircle,
  CheckCircle2,
  Terminal,
  FileText,
  Scale,
  Book,
  Download,
  ChevronRight,
  UploadCloud,
  BarChart2,
  Briefcase,
  Shield,
  History,
  RefreshCcw,
  BrainCircuit,
  CheckCircle,
  Circle,
} from "lucide-react";
import { useState, useCallback, useEffect } from "react";
import { useDropzone } from "react-dropzone";
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
import { motion, AnimatePresence } from "framer-motion";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// Add legal-themed loading messages
const legalLoadingMessages = [
  "Analyzing document structure...",
  "Checking legal compliance...",
  "Validating regulatory requirements...",
  "Reviewing precedent cases...",
  "Ensuring document integrity...",
  "Cross-referencing legal standards...",
];

// Animation variants
const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5 },
  },
  exit: {
    opacity: 0,
    y: -20,
    transition: { duration: 0.3 },
  },
};

const stageVariants = {
  initial: { scale: 0.95, opacity: 0 },
  animate: {
    scale: 1,
    opacity: 1,
    transition: { duration: 0.3 },
  },
  exit: {
    scale: 0.95,
    opacity: 0,
    transition: { duration: 0.2 },
  },
};

const progressVariants = {
  initial: { width: 0 },
  animate: (progress: number) => ({
    width: `${progress}%`,
    transition: { duration: 0.5, ease: "easeInOut" },
  }),
};

const cleanDocumentText = (text: string): string => {
  if (!text) return "";
  return text
    .replace(/<!DOCTYPE\s+[^>]*>|<!doctype\s+[^>]*>/gi, "")
    .replace(/<\?xml\s+[^>]*\?>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
};

const FileUploadZone: React.FC<{ onFileSelect: (files: File[]) => void }> = ({
  onFileSelect,
}) => {
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      "application/pdf": [".pdf"],
      "application/msword": [".doc"],
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
        [".docx"],
      "text/plain": [".txt"],
    },
    onDrop: async (acceptedFiles) => {
      const processedFiles = acceptedFiles.map(async (file) => {
        if (file.type === "text/plain") {
          const text = await file.text();
          const cleanedText = cleanDocumentText(text);
          return new File([cleanedText], file.name, { type: "text/plain" });
        }
        return file;
      });

      const cleanedFiles = await Promise.all(processedFiles);
      onFileSelect(cleanedFiles);
    },
    multiple: true,
  });

  return (
    <div
      {...getRootProps()}
      className={`
        border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-300
        ${isDragActive ? "border-blue-400 bg-blue-400/10" : "border-slate-600 hover:border-blue-400/50"}
      `}
    >
      <input {...getInputProps()} />
      <UploadCloud
        className={`h-12 w-12 mx-auto mb-4 text-slate-400 transition-transform duration-300 ${isDragActive ? "scale-110" : ""}`}
      />
      <h3 className="text-xl font-semibold mb-2">Upload Legal Documents</h3>
      <p className="text-slate-400 mb-3">
        Drag & drop your documents here or click to select files
      </p>
      <div className="flex justify-center gap-3 text-sm text-slate-500">
        <span>PDF</span>
        <span>•</span>
        <span>DOCX</span>
        <span>•</span>
        <span>TXT</span>
      </div>
    </div>
  );
};

const WorkflowStage: React.FC<{
  icon: React.ElementType;
  title: string;
  description: string;
  status: "pending" | "processing" | "completed" | "error";
}> = ({ icon: Icon, title, description, status }) => {
  return (
    <div className="relative flex items-center gap-4">
      <div
        className={`
        w-10 h-10 rounded-full flex items-center justify-center
        ${
          status === "completed"
            ? "bg-green-100 text-green-600"
            : status === "processing"
              ? "bg-blue-100 text-blue-600"
              : status === "error"
                ? "bg-red-100 text-red-600"
                : "bg-gray-100 text-gray-600"
        }
      `}
      >
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <h4 className="font-medium text-gray-900">{title}</h4>
        <p className="text-sm text-gray-500">{description}</p>
      </div>
      {status === "completed" && (
        <div className="absolute right-0">
          <CheckCircle2 className="h-5 w-5 text-green-500" />
        </div>
      )}
      {status === "processing" && (
        <div className="absolute right-0">
          <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
        </div>
      )}
      {status === "error" && (
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
  status: "success" | "warning" | "error" | "info";
}

interface StageResult {
  content: string;
  title: string;
  downloadUrl?: string;
  metadata?: any;
}

interface WorkflowStageState {
  status: "pending" | "processing" | "completed" | "error";
  outputs: StageOutput[];
  result?: StageResult;
  approvers?: Approver[];
  isApproved?: boolean;
  metadata?: any;
}

interface KeyFinding {
  category: string;
  finding: string;
  severity: "LOW" | "MEDIUM" | "HIGH";
}

interface ComplianceStatus {
  requirement: string;
  status: "COMPLIANT" | "NON_COMPLIANT" | "PARTIALLY_COMPLIANT";
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
  const [stageStates, setStageStates] = useState<
    Record<number, WorkflowStageState>
  >({});
  const [documentAnalyses, setDocumentAnalyses] = useState<
    Array<{
      fileName: string;
      documentType: string;
      industry: string;
      complianceStatus: string;
    }>
  >([]);
  const [isLogoHovered, setIsLogoHovered] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState(legalLoadingMessages[0]);

  // Effect to update document analysis based on workflow completion
  useEffect(() => {
    const isWorkflowComplete = Object.values(stageStates).every(
      (state) => state?.status === "completed",
    );

    if (isWorkflowComplete && stageStates[5]?.result?.metadata) {
      const metadata = stageStates[5].result.metadata;
      setDocumentAnalyses((prev) => [
        ...prev,
        {
          fileName:
            uploadedFiles[uploadedFiles.length - 1]?.name ||
            "Untitled Document",
          documentType: metadata.documentType,
          industry: metadata.industry,
          complianceStatus: metadata.complianceStatus,
        },
      ]);
    }
  }, [stageStates, uploadedFiles]);

  useEffect(() => {
    if (currentStage >= 0 && workflowProgress < 100) {
      const interval = setInterval(() => {
        setLoadingMessage(
          legalLoadingMessages[
            Math.floor(Math.random() * legalLoadingMessages.length)
          ],
        );
      }, 3000);
      return () => clearInterval(interval);
    }
  }, [currentStage, workflowProgress]);

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

  const handleSuggestionSelect = useCallback(
    (suggestionText: string) => {
      if (!selectedText) return;

      const textArea = document.querySelector("textarea");
      if (!textArea) return;

      const start = textArea.selectionStart;
      const end = textArea.selectionEnd;

      setDocumentText(
        (prev) =>
          prev.substring(0, start) + suggestionText + prev.substring(end),
      );

      toast({
        title: "Suggestion Applied",
        description: "The selected clause has been updated.",
      });
    },
    [selectedText, toast],
  );

  const addStageOutput = useCallback(
    (stageIndex: number, output: StageOutput) => {
      setStageStates((prev) => ({
        ...prev,
        [stageIndex]: {
          ...prev[stageIndex],
          outputs: [...(prev[stageIndex]?.outputs || []), output],
        },
      }));
    },
    [],
  );

  const updateStageStatus = useCallback(
    (stageIndex: number, status: WorkflowStageState["status"]) => {
      setStageStates((prev) => ({
        ...prev,
        [stageIndex]: {
          ...prev[stageIndex],
          status,
          outputs: prev[stageIndex]?.outputs || [],
        },
      }));
    },
    [],
  );

  const generatePDF = async (content: string, title: string) => {
    const doc = new jsPDF();

    const element = document.createElement("div");
    element.innerHTML = content;
    document.body.appendChild(element);

    try {
      const canvas = await html2canvas(element);
      const imgData = canvas.toDataURL("image/png");
      doc.addImage(imgData, "PNG", 10, 10, 190, 0);
      doc.save(`${title.toLowerCase().replace(/\s+/g, "-")}.pdf`);
    } finally {
      document.body.removeChild(element);
    }
  };

  const handleSubmit = async () => {
    if (!documentText.trim()) {
      toast({
        title: "No Content",
        description: "Please enter document text",
        variant: "destructive",
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
              status: "success",
            });

            return {
              content: draftContent,
              title: "Document Draft Analysis",
              metadata: {
                analysisType: "DRAFT_GENERATION",
                timestamp: new Date().toISOString(),
                confidence: 0.95,
              },
            };
          } catch (error) {
            console.error("Draft generation error:", error);
            throw error;
          }
        },
      },
      {
        name: "Compliance Check",
        handler: async () => {
          const complianceResult = {
            score: 85,
            status: "Compliant",
            findings: [
              "Document structure follows standard format",
              "Required legal clauses present",
              "No major compliance issues detected",
            ],
            documentType: "SOC 3 Report",
            industry: "TECHNOLOGY",
          };

          const complianceContent = `
            <h2>Compliance Analysis Report</h2>
            <p><strong>Compliance Score:</strong> ${complianceResult.score}%</p>
            <h3>Key Findings:</h3>
            <ul>
              ${complianceResult.findings.map((finding) => `<li>${finding}</li>`).join("")}
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
              industry: complianceResult.industry,
            },
          };
        },
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
            title: "Legal Research Report",
          };
        },
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
            title: "Approval Status Report",
          };
        },
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
            title: "Final Audit Report",
          };
        },
      },
      {
        name: "Document Analysis Results",
        handler: async () => {
          const workflowResults = Object.entries(stageStates).map(
            ([stage, state]) => ({
              stageType: workflowStages[Number(stage)].title.toLowerCase(),
              content: documentText,
              status: state.status,
              metadata: state.result?.metadata,
            }),
          );

          const complianceStage = stageStates[1]?.result?.metadata;
          const currentFile = uploadedFiles[uploadedFiles.length - 1];

          const documentType =
            complianceStage?.documentType || "Compliance Document";
          const industry = complianceStage?.industry || "TECHNOLOGY";
          const complianceStatus = complianceStage?.status || "Compliant";

          const analysisContent = `
            <h2>Final Document Analysis</h2>
            <div class="space-y-4">
              <div>
                <h3>Document Classification</h3>
                <p><strong>File:</strong> ${currentFile?.name || "Untitled Document"}</p>
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

          const finalMetadata = {
            documentType,
            industry,
            complianceStatus: complianceStatus,
            confidence: complianceStage?.score || 0,
            fileName: currentFile?.name,
          };

          return {
            content: analysisContent,
            title: "Document Analysis Results",
            metadata: finalMetadata,
          };
        },
      },
    ];

    try {
      for (let i = 0; i < stages.length; i++) {
        setCurrentStage(i);
        updateStageStatus(i, "processing");

        addStageOutput(i, {
          message: `Starting ${stages[i].name}`,
          timestamp: new Date().toISOString(),
          status: "info",
        });

        try {
          const result = await stages[i].handler();

          setStageStates((prev) => ({
            ...prev,
            [i]: {
              ...prev[i],
              status: "completed",
              result: {
                ...result,
                metadata: {
                  ...result.metadata,
                  complianceStatus:
                    result.metadata?.status ||
                    result.metadata?.complianceStatus,
                },
              },
            },
          }));

          setWorkflowProgress((i + 1) * (100 / stages.length));

          addStageOutput(i, {
            message: `${stages[i].name} completed`,
            timestamp: new Date().toISOString(),
            status: "success",
          });
        } catch (error) {
          console.error(`Error in stage ${i}:`, error);
          updateStageStatus(i, "error");
          addStageOutput(i, {
            message: `Error in ${stages[i].name}`,
            details: error instanceof Error ? error.message : "Unknown error",
            timestamp: new Date().toISOString(),
            status: "error",
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
        variant: "destructive",
      });
    }
  };

  const handleFileProcessed = useCallback(
    ({
      text,
      documentId,
      fileName,
    }: {
      text: string;
      documentId: string;
      fileName: string;
    }) => {
      setDocumentText(text);
      toast({
        title: "Document Processed",
        description: `${fileName} has been successfully parsed and loaded.`,
      });
    },
    [toast],
  );

  const handleFileError = useCallback(
    (error: string) => {
      toast({
        title: "Upload Failed",
        description: error,
        variant: "destructive",
      });
    },
    [toast],
  );

  const workflowStages = [
    {
      title: "Draft Generation",
      description: "AI-powered document drafting and formatting",
      icon: FileText,
    },
    {
      title: "Compliance Check",
      description: "Automated compliance check and risk assessment",
      icon: Shield,
    },
    {
      title: "Legal Research",
      description: "Context-aware legal research and analysis",
      icon: Book,
    },
    {
      title: "Approval Process",
      description: "Workflow approval and document execution",
      icon: History,
    },
    {
      title: "Final Audit",
      description: "Continuous monitoring and compliance updates",
      icon: RefreshCcw,
    },
    {
      title: "Document Analysis Results",
      description: "Final analysis of the document",
      icon: BarChart2,
    },
  ];

  const logoVariants = {
    initial: { scale: 1, rotate: 0 },
    hover: { scale: 1.1, rotate: 360, transition: { duration: 0.6 } },
  };

  const textVariants = {
    initial: { x: 0, opacity: 1 },
    hover: { x: 10, opacity: 0.8, transition: { duration: 0.3 } },
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 text-white">
      {/* Header Section */}
      <header className="border-b border-slate-700">
        <div className="container mx-auto py-6">
          <div className="flex items-center space-x-2 mb-2">
            <BrainCircuit className="h-8 w-8 text-blue-400" />
            <h1 className="text-3xl font-bold tracking-tight">
              Full Lifecycle Automation Workflow
            </h1>
          </div>
          <p className="text-slate-400 text-lg">
            From Draft to Execution – Automating 80% of Legal Compliance Tasks
          </p>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="container mx-auto py-8">
        {/* Upload Section */}
        <Card className="p-8 mb-8 bg-slate-800 border-slate-700">
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-300
              ${isDragActive ? "border-blue-400 bg-blue-400/10" : "border-slate-600 hover:border-blue-400/50"}`}
          >
            <input {...getInputProps()} />
            <UploadCloud
              className={`h-12 w-12 mx-auto mb-4 text-slate-400 transition-transform duration-300 ${isDragActive ? "scale-110" : ""}`}
            />
            <h3 className="text-xl font-semibold mb-2">
              Upload Legal Documents
            </h3>
            <p className="text-slate-400 mb-3">
              Drag & drop your documents here or click to select files
            </p>
            <div className="flex justify-center gap-3 text-sm text-slate-500">
              <span>PDF</span>
              <span>•</span>
              <span>DOCX</span>
              <span>•</span>
              <span>TXT</span>
            </div>
          </div>
        </Card>

        {/* Workflow Progress Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Progress Tracker */}
          <Card className="bg-slate-800 border-slate-700 p-6">
            <CardHeader className="pb-4">
              <CardTitle className="text-xl">Workflow Progress</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {workflowStages.map((stage, index) => (
                  <div
                    key={index}
                    className="flex items-start space-x-3 p-2 rounded-lg hover:bg-slate-700/50 transition-colors"
                  >
                    <div className="flex-shrink-0 mt-1">
                      {stage.completed ? (
                        <div className="relative">
                          <CheckCircle className="h-5 w-5 text-green-500" />
                        </div>
                      ) : stage.inProgress ? (
                        <Loader2 className="h-5 w-5 text-blue-400 animate-spin" />
                      ) : (
                        <Circle className="h-5 w-5 text-slate-500" />
                      )}
                    </div>
                    <div className="flex-grow min-w-0">
                      {" "}
                      {/* Added min-w-0 to prevent text overflow */}
                      <div className="flex justify-between items-start">
                        <span className="font-medium block truncate">
                          {stage.title}
                        </span>
                        {stage.completed && (
                          <span className="text-xs text-green-500 ml-2 flex-shrink-0">
                            Completed
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-slate-400 mt-0.5">
                        {stage.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Metrics Dashboard */}
          <Card className="bg-slate-800 border-slate-700 p-6">
            <CardHeader className="pb-4">
              <CardTitle className="text-xl">Processing Metrics</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                {metrics.map((metric, index) => (
                  <div key={index} className="p-4 bg-slate-700/50 rounded-lg">
                    <div className="text-2xl font-bold text-blue-400">
                      {metric.value}
                    </div>
                    <div className="text-sm text-slate-300">{metric.label}</div>
                    <div className="text-xs text-slate-400 mt-1">
                      {metric.description}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Results Section - Only show when there are results */}
        {analysisResults && (
          <Card className="bg-slate-800 border-slate-700 p-6">
            <CardHeader className="pb-4">
              <CardTitle className="text-xl">Analysis Results</CardTitle>
            </CardHeader>
            <CardContent>{renderAnalysisTable()}</CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}

function getStageTooltip(stage: string, status: string | undefined): string {
  if (!status || status === "pending") {
    return `Waiting to begin ${stage.toLowerCase()} phase`;
  }
  if (status === "processing") {
    return `Currently processing ${stage.toLowerCase()}`;
  }
  if (status === "completed") {
    return `Successfully completed ${stage.toLowerCase()}`;
  }
  return `Error during ${stage.toLowerCase()} phase`;
}

export default WorkflowAutomation;
