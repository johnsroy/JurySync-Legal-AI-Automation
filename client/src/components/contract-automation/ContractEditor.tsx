import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { motion, AnimatePresence } from "framer-motion";
import { SuggestionSkeleton } from "@/components/SuggestionSkeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { LegalLoadingAnimation } from "@/components/ui/loading-animation";
import {
  FileText,
  History,
  Send,
  UserCheck,
  Download,
  Edit,
  Check,
  PenTool,
  Sparkles,
  ListChecks,
  X,
  AlertTriangle,
  ThumbsUp,
  ThumbsDown,
  Info,
} from "lucide-react";
import type { DocumentAnalysis } from "@shared/schema";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { FilePond, registerPlugin } from "react-filepond";
import FilePondPluginFileValidateType from "filepond-plugin-file-validate-type";
import "filepond/dist/filepond.min.css";
import { useInterval } from "@/hooks/use-interval";
import { Badge } from "@/components/ui/badge";
import {Loader2} from 'lucide-react';


registerPlugin(FilePondPluginFileValidateType);


interface DraftRequirement {
  type: "STANDARD" | "CUSTOM";
  description: string;
  importance: "HIGH" | "MEDIUM" | "LOW";
}

interface SuggestedEdit {
  id: string;
  originalText: string;
  suggestedText: string;
  riskScore: number;
  reason: string;
  startIndex: number;
  endIndex: number;
  category?: 'LEGAL' | 'COMPLIANCE' | 'BUSINESS';
}

interface AISuggestion {
  id: string;
  category: 'CLARITY' | 'RISK' | 'COMPLIANCE';
  description: string;
  confidence: number;
  suggestedText: string;
  originalText: string;
  improvement: string;
  impact: string;
}

interface ContractEditorProps {
  documentId: string;
  content: string;
  analysis: DocumentAnalysis;
  onUpdate: () => void;
  setUploadedDocId: (documentId: string) => void;
  suggestedEdits?: SuggestedEdit[];
  onAcceptEdit?: (editId: string) => void;
  onRejectEdit?: (editId: string) => void;
  aiSuggestions?: AISuggestion[];
  onApplySuggestion?: (suggestion: AISuggestion) => void;
}

interface DocumentState {
  id: string;
  title: string;
  content: string;
  processingStatus: 'PROCESSING' | 'COMPLETED' | 'ERROR';
  analysis: DocumentAnalysis;
}

export const ContractEditor: React.FC<ContractEditorProps> = ({
  documentId,
  content,
  analysis,
  onUpdate,
  setUploadedDocId,
  suggestedEdits = [],
  onAcceptEdit,
  onRejectEdit,
  aiSuggestions = [],
  onApplySuggestion,
}) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("requirements");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedDraft, setGeneratedDraft] = useState("");
  const [editableDraft, setEditableDraft] = useState("");
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [progress, setProgress] = useState(0);
  const [downloadFormat, setDownloadFormat] = useState<'pdf' | 'docx' | 'txt'>('docx');
  const [selectedApprover, setSelectedApprover] = useState<string>("");
  const [reviewComment, setReviewComment] = useState("");
  const [requirements, setRequirements] = useState<DraftRequirement[]>([]);
  const [newRequirement, setNewRequirement] = useState("");
  const [requirementType, setRequirementType] = useState<"STANDARD" | "CUSTOM">("STANDARD");
  const [requirementImportance, setRequirementImportance] = useState<"HIGH" | "MEDIUM" | "LOW">("MEDIUM");
  const [files, setFiles] = useState<any[]>([]);
  const [showSideBySide, setShowSideBySide] = useState(false);
  const [selectedEdit, setSelectedEdit] = useState<SuggestedEdit | null>(null);
  const [selectedSuggestion, setSelectedSuggestion] = useState<AISuggestion | null>(null);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [isLoadingApproval, setIsLoadingApproval] = useState(false);
  const [uploadedDocuments, setUploadedDocuments] = useState<DocumentState[]>([]);

  const standardRequirements = [
    "Include non-disclosure agreement",
    "Add force majeure clause",
    "Include arbitration clause",
    "Add termination conditions",
    "Include payment terms",
  ];

  const handleAddRequirement = () => {
    if (!newRequirement) return;
    setRequirements([
      ...requirements,
      {
        type: requirementType,
        description: newRequirement,
        importance: requirementImportance,
      },
    ]);
    setNewRequirement("");
  };

  const handleGenerateDraft = async () => {
    if (requirements.length === 0) {
      toast({
        title: "No Requirements",
        description: "Please add at least one requirement before generating a draft.",
        variant: "destructive",
      });
      return;
    }

    setIsGenerating(true);
    setProgress(0);

    try {
      const progressInterval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 90) return prev;
          return prev + Math.floor(Math.random() * 15) + 5;
        });
      }, 800);

      const response = await apiRequest("POST", `/api/documents/${documentId}/generate-draft`, {
        requirements,
        baseContent: content,
        customInstructions: newRequirement,
      });

      clearInterval(progressInterval);
      setProgress(100);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to generate draft');
      }

      const result = await response.json();
      setGeneratedDraft(result.content);
      setEditableDraft(result.content);
      setActiveTab("draft");
      setHasUnsavedChanges(true);
      onUpdate();

      toast({
        title: "Draft Generated Successfully",
        description: "Your contract draft is ready for review.",
      });

    } catch (error: any) {
      console.error('Draft generation error:', error);
      toast({
        title: "Error Generating Draft",
        description: error.message || "Failed to generate draft. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
      setTimeout(() => setProgress(0), 1000);
    }
  };

  const isApproved = analysis.contractDetails?.workflowState?.status === "APPROVED";

  const { data: users } = useQuery({
    queryKey: ["/api/users"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/users");
      return response.json();
    },
  });

  const { data: pendingApprovals } = useQuery({
    queryKey: ["/api/approvals/pending"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/approvals/pending");
      return response.json();
    },
  });

  useEffect(() => {
    if (content) {
      setEditableDraft(content);
    }
  }, [content]);

  useEffect(() => {
    if (editableDraft !== content && editableDraft !== "") {
      setHasUnsavedChanges(true);
    }
  }, [editableDraft]);

  const handleSaveDraft = async () => {
    try {
      const response = await apiRequest("POST", `/api/documents/${documentId}/workflow`, {
        action: "review",
        content: editableDraft,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to save draft');
      }

      setHasUnsavedChanges(false);
      onUpdate();

      toast({
        title: "Draft Saved",
        description: "Changes have been saved successfully.",
      });

      queryClient.invalidateQueries({ queryKey: [`/api/documents/${documentId}`] });
      setActiveTab("redline");
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to save draft. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleRequestReview = async () => {
    try {
      if (!selectedApprover) {
        toast({
          title: "Error",
          description: "Please select an approver",
          variant: "destructive",
        });
        return;
      }

      const response = await apiRequest("POST", `/api/documents/${documentId}/request-review`, {
        approverId: selectedApprover,
        comments: reviewComment,
        documentType: analysis.documentType,
        aiAnalysis: {
          complianceScore: analysis.complianceScore,
          riskFactors: analysis.riskFactors,
          suggestedChanges: suggestedEdits,
        }
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to send review request");
      }

      queryClient.invalidateQueries({ queryKey: [`/api/documents/${documentId}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/approvals/pending"] });

      toast({
        title: "Review Requested",
        description: "Document has been sent for review with AI analysis",
      });

      setSelectedApprover("");
      setReviewComment("");
      onUpdate();

    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to request review",
        variant: "destructive",
      });
    }
  };

  const handleWorkflowAction = async (action: "approve" | "sign") => {
    try {
      const response = await apiRequest("POST", `/api/documents/${documentId}/workflow`, {
        action,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || `Failed to ${action} document`);
      }

      queryClient.invalidateQueries({ queryKey: [`/api/documents/${documentId}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/approvals/pending"] });
      onUpdate();

      toast({
        title: action === "approve" ? "Document Approved" : "Sent for Signature",
        description: action === "approve"
          ? "The document has been approved successfully"
          : "Document has been sent for digital signature",
      });

    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || `Failed to ${action} document`,
        variant: "destructive",
      });
    }
  };

  const handleDownload = async () => {
    try {
      window.location.href = `/api/documents/${documentId}/download?format=${downloadFormat}`;
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to download document. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleFilePondError = (error: any) => {
    console.error('FilePond error:', error);
    toast({
      title: "Upload Error",
      description: error.message || "Failed to upload document",
      variant: "destructive",
    });
  };

  const serverConfig = {
    process: "/api/workflow/upload",
    headers: {
      'Accept': 'application/json'
    },
    load: async (source: string, load: Function, error: Function) => {
      try {
        const data = JSON.parse(source);
        if (data.documentId) {
          setUploadedDocuments(prev => [...prev, {
            id: data.documentId,
            title: data.title,
            content: data.text,
            processingStatus: 'PROCESSING',
            analysis: data.analysis
          }]);

          setUploadedDocId(data.documentId);
          queryClient.invalidateQueries({ queryKey: ["/api/workflow/documents"] });
          load(source);

          toast({
            title: "Upload Successful",
            description: "Document uploaded and analysis started."
          });
        } else {
          error('Invalid upload response');
        }
      } catch (err: any) {
        console.error('Error processing upload response:', err);
        error('Upload processing failed');
      }
    }
  };

  useInterval(() => {
    const processingDocs = uploadedDocuments.filter(doc => doc.processingStatus === 'PROCESSING');
    if (processingDocs.length > 0) {
      processingDocs.forEach(async (doc) => {
        try {
          const response = await apiRequest('GET', `/api/workflow/documents/${doc.id}/status`);
          const status = await response.json();

          setUploadedDocuments(prev => prev.map(d => 
            d.id === doc.id ? { ...d, ...status } : d
          ));

          if (status.processingStatus === 'COMPLETED') {
            onUpdate();
            toast({
              title: "Analysis Complete",
              description: `Document "${status.title}" has been fully analyzed.`
            });
          } else if (status.processingStatus === 'ERROR') {
            toast({
              title: "Analysis Failed",
              description: `Failed to analyze "${status.title}". Please try again.`,
              variant: "destructive"
            });
          }
        } catch (error) {
          console.error('Error fetching document status:', error);
        }
      });
    }
  }, 5000);

  const renderHighlightedText = (text: string, edits: SuggestedEdit[]) => {
    let lastIndex = 0;
    const elements: JSX.Element[] = [];

    edits.sort((a, b) => a.startIndex - b.startIndex).forEach((edit, index) => {
      if (lastIndex < edit.startIndex) {
        elements.push(
          <span key={`text-${index}`}>
            {text.slice(lastIndex, edit.startIndex)}
          </span>
        );
      }

      elements.push(
        <TooltipProvider key={`tooltip-${edit.id}`}>
          <Tooltip>
            <TooltipTrigger>
              <span
                className={`px-1 rounded ${
                  edit.riskScore > 0.7
                    ? "bg-red-500/20 text-red-200"
                    : edit.riskScore > 0.4
                    ? "bg-yellow-500/20 text-yellow-200"
                    : "bg-blue-500/20 text-blue-200"
                }`}
                onClick={() => setSelectedEdit(edit)}
              >
                {edit.originalText}
              </span>
            </TooltipTrigger>
            <TooltipContent side="right" className="max-w-md p-4 space-y-2">
              <p className="font-medium">Suggested Change:</p>
              <p className="text-sm">{edit.suggestedText}</p>
              <div className="flex items-center justify-between mt-2">
                <span className="text-sm">Risk Score: {edit.riskScore * 100}%</span>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-green-400 hover:text-green-300"
                    onClick={() => onAcceptEdit?.(edit.id)}
                  >
                    <ThumbsUp className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-red-400 hover:text-red-300"
                    onClick={() => onRejectEdit?.(edit.id)}
                  >
                    <ThumbsDown className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );

      lastIndex = edit.endIndex;
    });

    if (lastIndex < text.length) {
      elements.push(
        <span key="text-final">{text.slice(lastIndex)}</span>
      );
    }

    return elements;
  };

  const tabs = [
    { id: "requirements", label: "Requirements", icon: ListChecks },
    { id: "editor", label: "Document", icon: FileText },
    ...(generatedDraft ? [{ id: "draft", label: "Generated Draft", icon: Sparkles }] : []),
    { id: "redline", label: "Version History", icon: History },
    { id: "redline-compare", label: "Redline View", icon: Edit },
  ];

  const cardVariants = {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -20 }
  };

  const pondOptions = {
    allowMultiple: true,
    maxFiles: 5,
    instantUpload: true,
    allowRevert: false
  };

  return (
    <Card className="mt-6">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="border-b px-4">
          <TabsList className="h-12">
            {tabs.map(tab => (
              <motion.div
                key={tab.id}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <TabsTrigger value={tab.id} className="px-4">
                  <tab.icon className="w-4 h-4 mr-2" />
                  <span>{tab.label}</span>
                </TabsTrigger>
              </motion.div>
            ))}
          </TabsList>
        </div>

        <TabsContent value="requirements" className="p-6">
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-semibold">Requirements</h3>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button className="inline-flex items-center justify-center rounded-full w-5 h-5 bg-muted">
                        <Info className="h-3 w-3" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>AI analyzes the document and suggests relevant requirements
                        based on industry standards and best practices.</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <motion.div
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <Button
                  onClick={handleGenerateDraft}
                  disabled={isGenerating || requirements.length === 0}
                >
                  {isGenerating ? (
                    <>
                      <LegalLoadingAnimation />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 mr-2" />
                      Generate Draft
                    </>
                  )}
                </Button>
              </motion.div>
            </div>

            <AnimatePresence>
              {isLoadingSuggestions ? (
                <motion.div
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  variants={cardVariants}
                >
                  <SuggestionSkeleton />
                </motion.div>
              ) : (
                <motion.div
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  variants={cardVariants}
                  className="space-y-4"
                >
                  <div className="flex gap-4">
                    <div className="flex-1">
                      <Label>Requirement Type</Label>
                      <Select
                        value={requirementType}
                        onValueChange={(value: "STANDARD" | "CUSTOM") => setRequirementType(value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="STANDARD">Standard Clause</SelectItem>
                          <SelectItem value="CUSTOM">Custom Requirement</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex-1">
                      <Label>Importance</Label>
                      <Select
                        value={requirementImportance}
                        onValueChange={(value: "HIGH" | "MEDIUM" | "LOW") => setRequirementImportance(value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select importance" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="HIGH">High Priority</SelectItem>
                          <SelectItem value="MEDIUM">Medium Priority</SelectItem>
                          <SelectItem value="LOW">Low Priority</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Input
                      value={newRequirement}
                      onChange={(e) => setNewRequirement(e.target.value)}
                      placeholder="Enter requirement or select from standard clauses"
                      className="flex-1"
                    />
                    <Button onClick={handleAddRequirement}>Add</Button>
                  </div>

                  {requirementType === "STANDARD" && (
                    <div className="grid grid-cols-2 gap-2 mt-4">
                      {standardRequirements.map((req) => (
                        <Button
                          key={req}
                          variant="outline"
                          className="justify-start"
                          onClick={() => setNewRequirement(req)}
                        >
                          <FileText className="w-4 h-4 mr-2" />
                          {req}
                        </Button>
                      ))}
                    </div>
                  )}

                  {requirements.map((req, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      transition={{ delay: index * 0.1 }}
                      className="flex items-center justify-between p-3 rounded-lg border"
                    >
                      <div className="flex items-center gap-2">
                        <div className={`px-2 py-1 rounded text-xs ${
                          req.importance === "HIGH"
                            ? "bg-red-100 text-red-800"
                            : req.importance === "MEDIUM"
                            ? "bg-yellow-100 text-yellow-800"
                            : "bg-green-100 text-green-800"
                        }`}>
                          {req.importance}
                        </div>
                        <span>{req.description}</span>
                      </div>
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => setRequirements(requirements.filter((_, i) => i !== index))}
                        className="text-red-500 hover:text-red-700"
                      >
                        <X className="h-4 w-4" />
                      </motion.button>
                    </motion.div>
                  ))}
                  {isGenerating && (
                    <div className="w-full space-y-2">
                      <Progress value={progress} className="w-full" />
                      <p className="text-sm text-gray-500 text-center">
                        Generating contract draft... {progress}%
                      </p>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
            <div className="mb-6">
              <h4 className="text-sm font-medium mb-2">Upload Documents</h4>
              <FilePond
                {...pondOptions}
                files={files}
                onupdatefiles={setFiles}
                server={serverConfig}
                acceptedFileTypes={[
                  'application/pdf',
                  'application/msword',
                  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
                ]}
                labelIdle='Drag & Drop your documents or <span class="filepond--label-action">Browse</span>'
                onerror={handleFilePondError}
              />
            </div>

            {uploadedDocuments.length > 0 && (
              <div className="space-y-4">
                <h4 className="text-sm font-medium">Uploaded Documents</h4>
                <div className="space-y-2">
                  {uploadedDocuments.map((doc) => (
                    <div
                      key={doc.id}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div className="flex items-center space-x-4">
                        <FileText className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <p className="font-medium">{doc.title}</p>
                          <p className="text-sm text-muted-foreground">
                            {doc.analysis.documentType} • {doc.analysis.industry}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Badge
                          variant={doc.processingStatus === 'COMPLETED' ? 'default' : 
                                 doc.processingStatus === 'ERROR' ? 'destructive' : 
                                 'secondary'}
                        >
                          {doc.processingStatus === 'PROCESSING' && (
                            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                          )}
                          {doc.processingStatus}
                        </Badge>
                        {doc.processingStatus === 'COMPLETED' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setActiveTab('editor')}
                          >
                            View Analysis
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="editor" className="p-6">
          <ScrollArea className="h-[500px] w-full border rounded-md p-4">
            <div className="prose max-w-none">
              <div className="whitespace-pre-wrap">{content}</div>
            </div>
          </ScrollArea>
        </TabsContent>

        {generatedDraft && (
          <TabsContent value="draft" className="p-6">
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">Contract Draft</h3>
                <div className="flex items-center space-x-4">
                  {hasUnsavedChanges && (
                    <Button onClick={handleSaveDraft}>
                      <Check className="w-4 h-4 mr-2" />
                      Save Changes
                    </Button>
                  )}
                  <Button onClick={handleDownload} variant="outline">
                    <Download className="w-4 h-4 mr-2" />
                    Download
                  </Button>
                </div>
              </div>
              <Textarea
                value={editableDraft}
                onChange={(e) => {
                  setEditableDraft(e.target.value);
                  setHasUnsavedChanges(true);
                }}
                className="min-h-[500px] font-mono text-sm"
                placeholder="Generated contract draft will appear here..."
              />
            </div>
          </TabsContent>
        )}

        <TabsContent value="redline" className="p-6">
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold">Version History</h3>
              <Button onClick={handleDownload} variant="outline">
                <Download className="w-4 h-4 mr-2" />
                Download
              </Button>
            </div>
            <div className="space-y-4">
              {analysis.contractDetails?.versions?.map((version: any, index: number) => (
                <div key={index} className="p-4 rounded-lg border">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h4 className="font-medium">Version {version.version}</h4>
                      <p className="text-sm text-gray-500">
                        {version.timestamp && format(new Date(version.timestamp), "PPpp")}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setEditableDraft(version.content);
                        setActiveTab("draft");
                      }}
                    >
                      <Edit className="w-4 h-4 mr-2" />
                      Edit
                    </Button>
                  </div>
                  <div className="mt-2 text-sm">
                    {version.changes?.map((change: any, changeIndex: number) => (
                      <div key={changeIndex} className="mb-1 text-gray-600">
                        • {change.description}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="redline-compare" className="p-6">
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold">Contract Redline View</h3>
              <div className="flex gap-4">
                <Button
                  variant="outline"
                  onClick={() => setShowSideBySide(!showSideBySide)}
                >
                  <Edit className="h-4 w-4 mr-2" />
                  {showSideBySide ? "Single View" : "Side by Side"}
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-6">
                <div className={`${showSideBySide ? 'grid grid-cols-2 gap-6' : 'space-y-6'}`}>
                  <div className="space-y-2">
                    {!showSideBySide && <Label>Current Version with Suggestions</Label>}
                    <ScrollArea className="h-[500px] w-full border rounded-md p-4">
                      <div className="prose max-w-none dark:prose-invert">
                        {renderHighlightedText(content, suggestedEdits)}
                      </div>
                    </ScrollArea>
                  </div>

                  {showSideBySide && (
                    <div className="space-y-2">
                      <Label>Selected Change Preview</Label>
                      <ScrollArea className="h-[500px] w-full border rounded-md p-4">
                        <div className="prose max-w-none dark:prose-invert">
                          {selectedEdit ? (
                            <div className="space-y-4">
                              <div className="p-4 rounded bg-red-500/10 border border-red-500/20">
                                <h4 className="text-red-400 mb-2">Original Text</h4>
                                <p>{selectedEdit.originalText}</p>
                              </div>
                              <div className="p-4 rounded bg-green-500/10 border border-green-500/20">
                                <h4 className="text-green-400 mb-2">Suggested Text</h4>
                                <p>{selectedEdit.suggestedText}</p>
                              </div>
                              <div className="flex justify-end gap-4 mt-4">
                                <Button
                                  variant="outline"
                                  onClick={() => onAcceptEdit?.(selectedEdit.id)}
                                  className="text-green-400 hover:text-green-300"
                                >
                                  <Check className="h-4 w-4 mr-2" />
                                  Accept Change
                                </Button>
                                <Button
                                  variant="outline"
                                  onClick={() => onRejectEdit?.(selectedEdit.id)}
                                  className="text-red-400 hover:text-red-300"
                                >
                                  <X className="h-4 w-4 mr-2" />
                                  Reject Change
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center justify-center h-full text-slate-400">
                              <p>Select a highlighted section to view suggested changes</p>
                            </div>
                          )}
                        </div>
                      </ScrollArea>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold">AI-Powered Suggestions</h4>
                  <span className="text-sm text-muted-foreground">
                    {aiSuggestions.length} suggestions
                  </span>
                </div>

                <ScrollArea className="h-[600px]">
                  <div className="space-y-4 pr-4">
                    {aiSuggestions.map((suggestion) => (
                      <Card
                        key={suggestion.id}
                        className={`p-4 transition-colors cursor-pointer hover:bg-muted/50 ${
                          selectedSuggestion?.id === suggestion.id ? 'border-primary' : ''
                        }`}
                        onClick={() => setSelectedSuggestion(suggestion)}
                      >
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              suggestion.category === 'RISK'
                                ? 'bg-red-500/10 text-red-400'
                                : suggestion.category === 'COMPLIANCE'
                                  ? 'bg-yellow-500/10 text-yellow-400'
                                  : 'bg-blue-500/10 text-blue-400'
                            }`}>
                              {suggestion.category}
                            </span>
                            <span className="text-sm text-muted-foreground">
                              {Math.round(suggestion.confidence * 100)}% confidence
                            </span>
                          </div>

                          <p className="text-sm font-medium">{suggestion.description}</p>

                          <div className="text-sm space-y-1 text-muted-foreground">
                            <p><strong>Improvement:</strong> {suggestion.improvement}</p>
                            <p><strong>Impact:</strong> {suggestion.impact}</p>
                          </div>

                          <div className="flex justify-end gap-2 mt-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => onApplySuggestion?.(suggestion)}
                            >
                              <Check className="h-4 w-4 mr-2" />
                              Apply Suggestion
                            </Button>
                          </div>
                        </div>
                      </Card>
                    ))}

                    {aiSuggestions.length === 0 && (
                      <div className="flex flex-col items-center justify-center text-center p-8 text-muted-foreground">
                        <Sparkles className="h-12 w-12 mb-4 text-primary/20" />
                        <p className="font-medium">No AI Suggestions</p>
                        <p className="text-sm">
                          The AI has not identified any suggestions for improvement at this time.
                        </p>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </div>
            </div>

            {suggestedEdits.length > 0 && (
              <div className="flex items-center justify-between p-4 bg-blue-500/10 rounded-lg">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-blue-400" />
                  <span className="text-sm">
                    {suggestedEdits.length} suggested changes found
                  </span>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => suggestedEdits.forEach(edit => onAcceptEdit?.(edit.id))}
                  >
                    Accept All
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => suggestedEdits.forEach(edit => onRejectEdit?.(edit.id))}
                  >
                    Reject All
                  </Button>
                </div>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </Card>
  );
};

export default ContractEditor;