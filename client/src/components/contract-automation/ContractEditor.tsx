import { useState, useEffect } from "react";
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
import { ComboboxDemo } from "@/components/ui/combobox";
import { useQuery } from "@tanstack/react-query";

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
  const [selectedApprover, setSelectedApprover] = useState<string>("");
  const [reviewComment, setReviewComment] = useState("");
  const [isApproved, setIsApproved] = useState(false);

  // Fetch admins for approval requests
  const { data: admins } = useQuery({
    queryKey: ["/api/users/admins"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/users/admins");
      return response.json();
    },
  });

  // Update useEffect to set initial draft content
  useEffect(() => {
    if (content) {
      setEditableDraft(content);
    }
  }, [content]);

  // Modified save draft to handle versioning
  const handleSaveDraft = async () => {
    try {
      const response = await apiRequest("POST", `/api/documents/${documentId}/workflow`, {
        action: "review",
        content: editableDraft,
      });
      const result = await response.json();
      onUpdate();

      // Update redline history
      if (result.analysis?.contractDetails?.redlineHistory) {
        setActiveTab("redline");
      }

      toast({
        title: "Draft Saved",
        description: "Your changes have been saved and a new version has been created.",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to save draft. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Modified workflow action handler with approval state
  const handleWorkflowAction = async (action: "review" | "approve" | "sign") => {
    try {
      const response = await apiRequest("POST", `/api/documents/${documentId}/workflow`, {
        action,
      });
      const result = await response.json();

      if (action === "approve") {
        setIsApproved(true);
      }

      onUpdate();
      toast({
        title: "Workflow Updated",
        description: `Document has been ${action === "approve" ? "approved" : `sent for ${action}`}`,
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update workflow. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Request review handler with single user as approver
  const handleRequestReview = async () => {
    try {
      // If no approver is selected and we have admins, use the first admin
      const approver = selectedApprover || (admins && admins[0]?.id);

      if (!approver) {
        toast({
          title: "Error",
          description: "No approver available",
          variant: "destructive",
        });
        return;
      }

      await apiRequest("POST", `/api/documents/${documentId}/request-review`, {
        approverId: approver,
        comments: reviewComment,
      });

      toast({
        title: "Review Requested",
        description: "Document has been sent for review",
      });
      onUpdate();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to request review",
        variant: "destructive",
      });
    }
  };

  // Render versions in redline view
  const renderVersions = () => {
    if (!analysis.contractDetails?.redlineHistory?.length) {
      return (
        <div className="text-center py-8 text-gray-500">
          No revisions available yet. Changes made to the document will appear here.
        </div>
      );
    }

    return analysis.contractDetails.redlineHistory.map((redline, index) => (
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
            <p className="text-xs text-gray-500 mt-2">
              Risk Level: {redline.riskLevel}/10
            </p>
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
    ));
  };

  // Approval request section
  const renderApprovalRequest = () => {
    return (
      <div className="space-y-4 mt-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">Select Approver</label>
          <Select
            value={selectedApprover}
            onValueChange={setSelectedApprover}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select an admin for review" />
            </SelectTrigger>
            <SelectContent>
              {admins?.map((admin: any) => (
                <SelectItem key={admin.id} value={admin.id.toString()}>
                  {admin.username}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Review Comments</label>
          <Textarea
            value={reviewComment}
            onChange={(e) => setReviewComment(e.target.value)}
            placeholder="Add any comments for the reviewer..."
            className="min-h-[100px]"
          />
        </div>
      </div>
    );
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

  // Workflow integration (moved up)


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
              {renderVersions()}
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
                  onClick={() => handleRequestReview()}
                  disabled={isApproved}
                >
                  <Send className="w-4 h-4 mr-2" />
                  Send for Review
                </Button>
                <Button
                  variant={isApproved ? "default" : "outline"}
                  onClick={() => handleWorkflowAction("approve")}
                  disabled={isApproved}
                >
                  {isApproved ? (
                    <>
                      <Check className="w-4 h-4 mr-2" />
                      Approved
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4 mr-2" />
                      Approve
                    </>
                  )}
                </Button>
                <Button
                  variant="default"
                  onClick={() => handleWorkflowAction("sign")}
                  disabled={!isApproved}
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

            {renderApprovalRequest()}

            {analysis.contractDetails?.workflowState && (
              <div className="space-y-4">
                <div className="flex items-center space-x-2">
                  <span className="font-medium">Current Status:</span>
                  <span className={`px-2 py-1 rounded-full text-sm ${
                    analysis.contractDetails.workflowState.status === "APPROVAL"
                      ? "bg-green-100 text-green-800"
                      : "bg-blue-100 text-blue-800"
                  }`}>
                    {analysis.contractDetails.workflowState.status}
                  </span>
                </div>

                {analysis.contractDetails.workflowState.comments && (
                  <div className="space-y-2">
                    <h4 className="font-medium">Comments</h4>
                    {analysis.contractDetails.workflowState.comments.map((comment: any, index: number) => (
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