import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
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
} from "lucide-react";
import type { DocumentAnalysis } from "@shared/schema";

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
  const [isDrafting, setIsDrafting] = useState(false);

  // Dynamic drafting
  const handleGenerateDraft = async () => {
    setIsGenerating(true);
    try {
      const response = await apiRequest("POST", `/api/documents/${documentId}/generate-draft`, {
        requirements: content,
      });
      const result = await response.json();
      onUpdate();
      toast({
        title: "Draft Generated",
        description: "New contract draft has been created based on your requirements.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error.message || "Failed to generate draft. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  // Download approved draft
  const handleDownload = async () => {
    try {
      window.location.href = `/api/documents/${documentId}/download`;
    } catch (error) {
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
    } catch (error) {
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
    } catch (error) {
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

  return (
    <Card className="mt-6">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="editor">
            <FileText className="w-4 h-4 mr-2" />
            Editor
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
              <h3 className="text-lg font-semibold">Contract Editor</h3>
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
                {isApproved && (
                  <Button
                    onClick={handleDownload}
                    variant="outline"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Download
                  </Button>
                )}
              </div>
            </div>
            <ScrollArea className="h-[500px] w-full border rounded-md p-4">
              <div className="prose max-w-none">
                <div className="whitespace-pre-wrap">{content}</div>
              </div>
            </ScrollArea>
          </div>
        </TabsContent>

        <TabsContent value="redline" className="p-4">
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Redline Analysis</h3>
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
                {isApproved && (
                  <Button
                    variant="outline"
                    onClick={handleDownload}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Download
                  </Button>
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

                {analysis.contractDetails.workflowState.signatureStatus && (
                  <div className="space-y-2">
                    <h4 className="font-medium">Signatures Required</h4>
                    <div className="grid grid-cols-2 gap-2">
                      {analysis.contractDetails.workflowState.signatureStatus.required.map((signer) => (
                        <div
                          key={signer}
                          className={`p-2 rounded-lg ${
                            analysis.contractDetails?.workflowState?.signatureStatus?.completed.includes(
                              signer
                            )
                              ? "bg-green-50 text-green-700"
                              : "bg-gray-50 text-gray-700"
                          }`}
                        >
                          {signer}
                        </div>
                      ))}
                    </div>
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