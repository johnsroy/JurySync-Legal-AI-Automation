import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  ListChecks
} from "lucide-react";
import type { DocumentAnalysis } from "@shared/schema";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";

interface DraftRequirement {
  type: "STANDARD" | "CUSTOM";
  description: string;
  importance: "HIGH" | "MEDIUM" | "LOW";
}

interface ContractEditorProps {
  documentId: string;
  content: string;
  analysis: DocumentAnalysis;
  onUpdate: () => void;
}

export const ContractEditor: React.FC<ContractEditorProps> = ({
  documentId,
  content,
  analysis,
  onUpdate,
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
      // Start progress animation
      const progressInterval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 90) return prev;
          return prev + Math.floor(Math.random() * 15) + 5;
        });
      }, 800);

      // Enhanced API call with requirements
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

  // Determine if document is approved
  const isApproved = analysis.contractDetails?.workflowState?.status === "APPROVED";

  // Fetch all users for approval requests
  const { data: users } = useQuery({
    queryKey: ["/api/users"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/users");
      return response.json();
    },
  });

  // Add query for pending approvals
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

      // Refresh queries to get updated versions
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

  // Handle review request
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
      });

      if (!response.ok) {
        throw new Error("Failed to send review request");
      }

      // Invalidate both documents and pending approvals queries
      queryClient.invalidateQueries({ queryKey: [`/api/documents/${documentId}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/approvals/pending"] });

      toast({
        title: "Review Requested",
        description: "Document has been sent for review",
      });

      // Reset form fields
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

      // Refresh both queries
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

  const tabs = [
    { id: "requirements", label: "Requirements", icon: ListChecks },
    { id: "editor", label: "Document", icon: FileText },
    ...(generatedDraft ? [{ id: "draft", label: "Generated Draft", icon: Sparkles }] : []),
    { id: "redline", label: "Version History", icon: History },
    { id: "approvals", label: "Approval Pending", icon: UserCheck },
    { id: "workflow", label: "Workflow", icon: History },
  ];

  return (
    <Card className="mt-6">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="border-b px-4">
          <TabsList className="h-12">
            {tabs.map(tab => (
              <TabsTrigger key={tab.id} value={tab.id} className="px-4">
                <tab.icon className="w-4 h-4 mr-2" />
                <span>{tab.label}</span>
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        {/* Requirements Tab Content */}
        <TabsContent value="requirements" className="p-6">
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold">Contract Requirements</h3>
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
            </div>

            <div className="space-y-4">
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

              <div className="space-y-2">
                {requirements.map((req, index) => (
                  <div
                    key={index}
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
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setRequirements(requirements.filter((_, i) => i !== index))}
                    >
                      Remove
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            {isGenerating && (
              <div className="w-full space-y-2">
                <Progress value={progress} className="w-full" />
                <p className="text-sm text-gray-500 text-center">
                  Generating contract draft... {progress}%
                </p>
              </div>
            )}
          </div>
        </TabsContent>

        {/* Document Tab Content */}
        <TabsContent value="editor" className="p-6">
          <ScrollArea className="h-[500px] w-full border rounded-md p-4">
            <div className="prose max-w-none">
              <div className="whitespace-pre-wrap">{content}</div>
            </div>
          </ScrollArea>
        </TabsContent>

        {/* Generated Draft Tab Content */}
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

        {/* Version History Tab */}
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

        {/* Approval Tab */}
        <TabsContent value="approvals" className="p-6">
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold">Pending Approvals</h3>
            </div>
            {!pendingApprovals || pendingApprovals.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No reviews are pending for your approval.
              </div>
            ) : (
              <div className="space-y-4">
                {pendingApprovals.map((approval: any) => (
                  <div key={approval.id} className="p-4 border rounded-lg">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-medium">{approval.document.title}</h4>
                        <p className="text-sm text-gray-500">
                          Requested by {approval.requester.username} on{" "}
                          {format(new Date(approval.createdAt), "PPpp")}
                        </p>
                        {approval.comments && (
                          <p className="mt-2 text-sm">{approval.comments}</p>
                        )}
                      </div>
                      <div className="flex space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setEditableDraft(approval.document.content);
                            setActiveTab("draft");
                          }}
                        >
                          <FileText className="w-4 h-4 mr-2" />
                          View Document
                        </Button>
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => handleWorkflowAction("approve")}
                        >
                          <Check className="w-4 h-4 mr-2" />
                          Approve
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        {/* Workflow Tab */}
        <TabsContent value="workflow" className="p-6">
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold">Workflow Status</h3>
              <div className="flex items-center space-x-4">
                <Button
                  variant="outline"
                  onClick={handleRequestReview}
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
                  <Check className="w-4 h-4 mr-2" />
                  {isApproved ? "Approved" : "Approve"}
                </Button>
                {isApproved && (
                  <Button
                    variant="default"
                    onClick={() => handleWorkflowAction("sign")}
                  >
                    <PenTool className="w-4 h-4 mr-2" />
                    Send for Signature
                  </Button>
                )}
              </div>
            </div>

            <div className="space-y-4">
              {/* Current Status Display */}
              <div className="flex items-center space-x-2">
                <span className="font-medium">Current Status:</span>
                <span className={`px-2 py-1 rounded-full text-sm ${
                  isApproved
                    ? "bg-green-100 text-green-800"
                    : analysis.contractDetails?.workflowState?.status === "REVIEW"
                      ? "bg-yellow-100 text-yellow-800"
                      : "bg-blue-100 text-blue-800"
                }`}>
                  {isApproved
                    ? "Approved"
                    : analysis.contractDetails?.workflowState?.status === "REVIEW"
                      ? "Waiting on Review"
                      : "Draft"}
                </span>
              </div>

              <div className="space-y-2">
                <Label>Select Approver</Label>
                <Select
                  value={selectedApprover}
                  onValueChange={setSelectedApprover}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a user for review" />
                  </SelectTrigger>
                  <SelectContent>
                    {users?.map((user: any) => (
                      <SelectItem key={user.id} value={user.id.toString()}>
                        {user.username}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Review Comments</Label>
                <Textarea
                  value={reviewComment}
                  onChange={(e) => setReviewComment(e.target.value)}
                  placeholder="Add any comments for the reviewer..."
                  className="min-h-[100px]"
                />
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </Card>
  );
};

export default ContractEditor;