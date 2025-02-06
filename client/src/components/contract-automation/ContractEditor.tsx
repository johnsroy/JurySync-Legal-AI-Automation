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
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";

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
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [progress, setProgress] = useState(0);
  const [downloadFormat, setDownloadFormat] = useState<'pdf' | 'docx' | 'txt'>('docx');
  const [selectedApprover, setSelectedApprover] = useState<string>("");
  const [reviewComment, setReviewComment] = useState("");
  const [isApproved, setIsApproved] = useState(false);

  // Fetch all users for approval requests
  const { data: users } = useQuery({
    queryKey: ["/api/users"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/users");
      return response.json();
    },
  });

  // Track changes to editableDraft
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

  const handleGenerateDraft = async () => {
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
        requirements: content,
      });

      clearInterval(progressInterval);
      setProgress(100);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to generate draft');
      }

      const result = await response.json();
      if (!result.content) {
        throw new Error('No content received from server');
      }

      setGeneratedDraft(result.content);
      setEditableDraft(result.content);
      setActiveTab("draft");
      setHasUnsavedChanges(false);
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

  const handleSaveDraft = async () => {
    try {
      const response = await apiRequest("POST", `/api/documents/${documentId}/workflow`, {
        action: "review",
        content: editableDraft,
      });
      const result = await response.json();
      setHasUnsavedChanges(false);
      onUpdate();

      toast({
        title: "Draft Saved",
        description: "Your changes have been saved as a new version.",
      });

      // Show the updated versions in redline view
      setActiveTab("redline");
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to save draft. Please try again.",
        variant: "destructive",
      });
    }
  };

  const renderVersions = () => {
    const versions = analysis.contractDetails?.versions || [];

    if (versions.length === 0) {
      return (
        <div className="text-center py-8 text-gray-500">
          No revisions available yet. Changes made to the document will appear here.
        </div>
      );
    }

    return versions.map((version, index) => (
      <div key={index} className="p-4 mb-4 rounded-lg border border-gray-200">
        <div className="flex justify-between items-start mb-2">
          <div>
            <h4 className="font-medium">Version {version.version}</h4>
            <p className="text-sm text-gray-500">
              {format(new Date(version.changes[0].timestamp), "PPpp")}
            </p>
          </div>
          <div className="space-x-2">
            <Button variant="outline" size="sm" onClick={() => setEditableDraft(version.content)}>
              <Edit className="w-4 h-4 mr-2" />
              Edit
            </Button>
          </div>
        </div>
        <div className="mt-2 text-sm">
          {version.changes.map((change, changeIndex) => (
            <div key={changeIndex} className="mb-1 text-gray-600">
              • {change.description} by {change.user}
            </div>
          ))}
        </div>
      </div>
    ));
  };

  // Show the Generated Draft tab only if a draft has been generated
  const tabs = [
    { id: "editor", label: "Requirements", icon: FileText },
    ...(generatedDraft ? [{ id: "draft", label: "Generated Draft", icon: Edit }] : []),
    { id: "redline", label: "Redline View", icon: AlertTriangle },
    { id: "workflow", label: "Workflow", icon: History },
  ];

  return (
    <Card className="mt-6">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          {tabs.map(tab => (
            <TabsTrigger key={tab.id} value={tab.id}>
              <tab.icon className="w-4 h-4 mr-2" />
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* Requirements Tab Content */}
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
                {editableDraft || isApproved && (
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

        {/* Generated Draft Tab Content - Only shown if draft exists */}
        {generatedDraft && (
          <TabsContent value="draft" className="p-4">
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">Contract Draft</h3>
                <div className="space-x-2">
                  {hasUnsavedChanges && (
                    <Button onClick={handleSaveDraft}>
                      <Check className="w-4 h-4 mr-2" />
                      Save Changes
                    </Button>
                  )}
                  {editableDraft || isApproved && (
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
                onChange={(e) => {
                  setEditableDraft(e.target.value);
                  setHasUnsavedChanges(true);
                }}
                className="min-h-[500px] font-mono"
                placeholder="Generated contract draft will appear here..."
              />
            </div>
          </TabsContent>
        )}

        <TabsContent value="redline" className="p-4">
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold">Redline Analysis</h3>
              {editableDraft || isApproved && (
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
                {editableDraft || isApproved && (
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

            <div className="space-y-4">
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
                    {users?.map((user: any) => (
                      <SelectItem key={user.id} value={user.id.toString()}>
                        {user.username}
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

            {analysis.contractDetails?.workflowState && (
              <div className="space-y-4">
                <div className="flex items-center space-x-2">
                  <span className="font-medium">Current Status:</span>
                  <span className={`px-2 py-1 rounded-full text-sm ${
                    analysis.contractDetails?.workflowState?.status === "APPROVAL"
                      ? "bg-green-100 text-green-800"
                      : "bg-blue-100 text-blue-800"
                  }`}>
                    {analysis.contractDetails?.workflowState?.status || "NEW"}
                  </span>
                </div>

                {analysis.contractDetails?.workflowState?.comments && (
                  <div className="space-y-2">
                    <h4 className="font-medium">Comments</h4>
                    {analysis.contractDetails?.workflowState?.comments.map((comment: any, index: number) => (
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