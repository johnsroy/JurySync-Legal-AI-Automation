import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  AlertTriangle,
  Check,
  FileText,
  History,
  Send,
  UserCheck,
  AlertCircle,
  Download,
  Edit,
} from "lucide-react";
import type { DocumentAnalysis } from "@shared/schema";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface ContractEditorProps {
  documentId: string;
  content: string;
  analysis: DocumentAnalysis;
  onUpdate: () => void;
}

export function ContractEditor({
  documentId,
  content,
  analysis,
  onUpdate,
}: ContractEditorProps) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("editor");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedDraft, setGeneratedDraft] = useState("");
  const [editableDraft, setEditableDraft] = useState("");
  const [progress, setProgress] = useState(0);
  const [downloadFormat, setDownloadFormat] = useState<'pdf' | 'docx' | 'txt'>('docx');

  // Update the draft generation handler to better handle responses and errors
  const handleGenerateDraft = async () => {
    setIsGenerating(true);
    setProgress(0);

    try {
      // Start progress animation
      const progressInterval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 90) return prev; // Cap at 90% until complete
          return prev + Math.floor(Math.random() * 15) + 5; // More dynamic progress
        });
      }, 800);

      const response = await apiRequest("POST", `/api/documents/${documentId}/generate-draft`, {
        requirements: content,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to generate draft');
      }

      const result = await response.json();

      // Clear interval and complete progress
      clearInterval(progressInterval);
      setProgress(100);

      if (!result.content) {
        throw new Error('No content received from server');
      }

      setGeneratedDraft(result.content);
      setEditableDraft(result.content);
      setActiveTab("draft");
      onUpdate();

      toast({
        title: "Draft Generated Successfully",
        description: "Your contract draft is ready for review.",
        variant: "default",
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
      // Reset progress after a delay
      setTimeout(() => setProgress(0), 1000);
    }
  };

  // Save edited draft
  const handleSaveDraft = async () => {
    try {
      const response = await apiRequest("POST", `/api/documents/${documentId}/workflow`, {
        action: "review",
        content: editableDraft,
      });
      await response.json();
      onUpdate();
      toast({
        title: "Draft Saved",
        description: "Your changes have been saved and sent for review.",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to save draft. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Update download handler
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

  // Real-time redlining
  const handleAnalyzeClause = async (clause: string) => {
    try {
      const response = await apiRequest("POST", `/api/documents/${documentId}/analyze-clause`, {
        clause,
      });
      const result = await response.json();
      toast({
        title: "Clause Analysis Complete",
        description: result.riskLevel > 7 ? "High-risk clause detected" : "Clause analysis completed",
        variant: result.riskLevel > 7 ? "destructive" : "default",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to analyze clause. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Workflow integration
  const handleWorkflowAction = async (action: "review" | "approve" | "sign") => {
    try {
      const response = await apiRequest("POST", `/api/documents/${documentId}/workflow`, {
        action,
      });
      const result = await response.json();
      onUpdate();
      toast({
        title: "Workflow Updated",
        description: `Document has been sent for ${action}`,
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update workflow. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Check if document is in an approved state
  const isApproved = analysis.contractDetails?.workflowState?.status === "APPROVAL" ||
                    analysis.contractDetails?.workflowState?.status === "SIGNATURE" ||
                    analysis.contractDetails?.workflowState?.status === "COMPLETED";

  // Show download button only if there's a draft or the document is approved
  const showDownloadButton = generatedDraft || isApproved;

  return (
    <Card className="mt-6">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="editor">
            <FileText className="w-4 h-4 mr-2" />
            Requirements
          </TabsTrigger>
          <TabsTrigger value="draft">
            <Edit className="w-4 h-4 mr-2" />
            Generated Draft
          </TabsTrigger>
          <TabsTrigger value="redline">
            <AlertTriangle className="w-4 h-4 mr-2" />
            Redline View
          </TabsTrigger>
          <TabsTrigger value="workflow">
            <History className="w-4 h-4 mr-2" />
            Workflow
          </TabsTrigger>
        </TabsList>

        <TabsContent value="editor" className="p-4">
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold">Contract Requirements</h3>
              <div className="space-x-2">
                <Button
                  onClick={handleGenerateDraft}
                  disabled={isGenerating}
                >
                  {isGenerating ? (
                    <>Generating...</>
                  ) : (
                    <>
                      <FileText className="w-4 h-4 mr-2" />
                      Generate Draft
                    </>
                  )}
                </Button>
                {showDownloadButton && (
                  <div className="space-x-2">
                    <Select
                      value={downloadFormat}
                      onValueChange={(value: 'pdf' | 'docx' | 'txt') => setDownloadFormat(value)}
                    >
                      <SelectTrigger className="w-[100px]">
                        <SelectValue placeholder="Format" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pdf">PDF</SelectItem>
                        <SelectItem value="docx">DOCX</SelectItem>
                        <SelectItem value="txt">TXT</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      onClick={handleDownload}
                      variant="outline"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Download
                    </Button>
                  </div>
                )}
              </div>
            </div>

            {/* Progress bar */}
            {isGenerating && (
              <div className="w-full space-y-2">
                <Progress value={progress} className="w-full" />
                <p className="text-sm text-gray-500 text-center">
                  Generating contract draft... {progress}%
                </p>
              </div>
            )}

            <ScrollArea className="h-[500px] w-full border rounded-md p-4">
              <div className="prose max-w-none">
                <div className="whitespace-pre-wrap">{content}</div>
              </div>
            </ScrollArea>
          </div>
        </TabsContent>

        <TabsContent value="draft" className="p-4">
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold">Contract Draft</h3>
              <div className="space-x-2">
                <Button onClick={handleSaveDraft}>
                  <Check className="w-4 h-4 mr-2" />
                  Save Changes
                </Button>
                {showDownloadButton && (
                  <div className="space-x-2">
                    <Select
                      value={downloadFormat}
                      onValueChange={(value: 'pdf' | 'docx' | 'txt') => setDownloadFormat(value)}
                    >
                      <SelectTrigger className="w-[100px]">
                        <SelectValue placeholder="Format" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pdf">PDF</SelectItem>
                        <SelectItem value="docx">DOCX</SelectItem>
                        <SelectItem value="txt">TXT</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      onClick={handleDownload}
                      variant="outline"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Download
                    </Button>
                  </div>
                )}
              </div>
            </div>
            <Textarea
              value={editableDraft}
              onChange={(e) => setEditableDraft(e.target.value)}
              className="min-h-[500px] font-mono"
              placeholder="Generated contract draft will appear here..."
            />
          </div>
        </TabsContent>
        <TabsContent value="redline" className="p-4">
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold">Redline Analysis</h3>
              {showDownloadButton && (
                <div className="space-x-2">
                  <Select
                    value={downloadFormat}
                    onValueChange={(value: 'pdf' | 'docx' | 'txt') => setDownloadFormat(value)}
                  >
                    <SelectTrigger className="w-[100px]">
                      <SelectValue placeholder="Format" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pdf">PDF</SelectItem>
                      <SelectItem value="docx">DOCX</SelectItem>
                      <SelectItem value="txt">TXT</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    onClick={handleDownload}
                    variant="outline"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Download
                  </Button>
                </div>
              )}
            </div>
            <div className="space-y-2">
              {analysis.contractDetails?.redlineHistory?.map((redline, index) => (
                <div
                  key={index}
                  className={`p-4 rounded-lg border ${
                    redline.riskLevel > 7
                      ? "border-red-200 bg-red-50"
                      : redline.riskLevel > 4
                      ? "border-yellow-200 bg-yellow-50"
                      : "border-green-200 bg-green-50"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <p className="font-medium">Original Clause:</p>
                      <p className="text-sm text-gray-600">{redline.clause}</p>
                      <p className="font-medium mt-2">Suggested Change:</p>
                      <p className="text-sm text-gray-600">{redline.suggestion}</p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleAnalyzeClause(redline.clause)}
                      >
                        <AlertCircle className="w-4 h-4 mr-2" />
                        Analyze
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="workflow" className="p-4">
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold">Workflow Status</h3>
              <div className="space-x-2">
                <Button
                  variant="outline"
                  onClick={() => handleWorkflowAction("review")}
                >
                  <Send className="w-4 h-4 mr-2" />
                  Send for Review
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleWorkflowAction("approve")}
                >
                  <Check className="w-4 h-4 mr-2" />
                  Approve
                </Button>
                <Button
                  variant="default"
                  onClick={() => handleWorkflowAction("sign")}
                >
                  <UserCheck className="w-4 h-4 mr-2" />
                  Send for Signature
                </Button>
                {showDownloadButton && (
                  <div className="space-x-2">
                    <Select
                      value={downloadFormat}
                      onValueChange={(value: 'pdf' | 'docx' | 'txt') => setDownloadFormat(value)}
                    >
                      <SelectTrigger className="w-[100px]">
                        <SelectValue placeholder="Format" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pdf">PDF</SelectItem>
                        <SelectItem value="docx">DOCX</SelectItem>
                        <SelectItem value="txt">TXT</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      onClick={handleDownload}
                      variant="outline"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Download
                    </Button>
                  </div>
                )}
              </div>
            </div>

            {analysis.contractDetails?.workflowState && (
              <div className="space-y-4">
                <div className="flex items-center space-x-2">
                  <span className="font-medium">Current Status:</span>
                  <span className="px-2 py-1 rounded-full text-sm bg-blue-100 text-blue-800">
                    {analysis.contractDetails.workflowState.status}
                  </span>
                </div>

                {analysis.contractDetails.workflowState.comments && (
                  <div className="space-y-2">
                    <h4 className="font-medium">Comments</h4>
                    {analysis.contractDetails.workflowState.comments.map((comment, index) => (
                      <div key={index} className="p-3 rounded-lg bg-gray-50">
                        <p className="text-sm text-gray-600">{comment.text}</p>
                        <div className="mt-1 text-xs text-gray-500">
                          {comment.user} - {new Date(comment.timestamp).toLocaleString()}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </Card>
  );
}