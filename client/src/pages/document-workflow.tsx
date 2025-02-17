import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Loader2, FileText, Download, Eye, BookOpen, ClipboardCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface AnalysisResult {
  documentType: string;
  documentDescription: string;
  industry: string;
  industryDescription: string;
  status: 'COMPLIANT' | 'NON_COMPLIANT';
  statusDescription: string;
  compliance: {
    score: number;
    issues: any[];
    recommendations: string[];
  };
  legal: {
    analysis: string;
    precedents: string[];
    risks: string[];
  };
  approval: {
    status: string;
    requiredSignoffs: string[];
    nextSteps: string[];
  };
  audit: {
    summary: string;
    findings: string[];
    recommendations: string[];
  };
}

export default function DocumentWorkflow() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const { toast } = useToast();

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const processDocument = async () => {
    if (!selectedFile) return;

    setIsProcessing(true);
    const formData = new FormData();
    formData.append('document', selectedFile);

    try {
      const response = await fetch('/api/document/process', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) throw new Error('Processing failed');

      const result = await response.json();
      setAnalysisResult(result);

      toast({
        title: "Document Processed",
        description: "Analysis complete. Review the results below.",
      });
    } catch (error) {
      toast({
        title: "Processing Failed",
        description: error instanceof Error ? error.message : "Failed to process document",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const downloadPDF = async (type: string) => {
    if (!analysisResult) return;

    try {
      const response = await fetch(`/api/document/export/${type}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ result: analysisResult })
      });

      if (!response.ok) throw new Error('Export failed');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${type.toLowerCase()}-analysis.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "Export Success",
        description: `${type} analysis has been downloaded.`,
      });
    } catch (error) {
      toast({
        title: "Export Failed",
        description: error instanceof Error ? error.message : "Failed to export document",
        variant: "destructive"
      });
    }
  };

  const TabActions = ({ type }: { type: string }) => (
    <div className="flex justify-end gap-4">
      <Button variant="outline">
        <Eye className="h-4 w-4 mr-2" />
        Preview
      </Button>
      <Button onClick={() => downloadPDF(type)}>
        <Download className="h-4 w-4 mr-2" />
        Download PDF
      </Button>
    </div>
  );

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="space-y-8">
        {/* Document Upload Section */}
        <Card className="p-6">
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <FileText className="h-8 w-8 text-primary" />
              <div>
                <h2 className="text-2xl font-semibold">Document Processing</h2>
                <p className="text-muted-foreground">Upload your document for comprehensive analysis</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <input
                type="file"
                onChange={handleFileUpload}
                accept=".pdf,.docx,.doc"
                className="flex-1 p-2 border rounded-md"
              />
              <Button
                onClick={processDocument}
                disabled={!selectedFile || isProcessing}
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  'Process Document'
                )}
              </Button>
            </div>
          </div>
        </Card>

        {/* Status Grid */}
        {analysisResult && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="p-6 bg-blue-50 dark:bg-blue-900/10">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold">Document Type</h3>
                  <p className="text-lg font-medium text-primary">{analysisResult.documentType}</p>
                  <p className="text-sm text-muted-foreground mt-1">{analysisResult.documentDescription}</p>
                </div>
                <FileText className="h-10 w-10 text-blue-500" />
              </div>
            </Card>

            <Card className="p-6 bg-emerald-50 dark:bg-emerald-900/10">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold">Industry</h3>
                  <p className="text-lg font-medium text-primary">{analysisResult.industry}</p>
                  <p className="text-sm text-muted-foreground mt-1">{analysisResult.industryDescription}</p>
                </div>
                <BookOpen className="h-10 w-10 text-emerald-500" />
              </div>
            </Card>

            <Card className="p-6 bg-emerald-50 dark:bg-emerald-900/10">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold">Compliance Status</h3>
                  <p className="text-lg font-medium text-primary">{analysisResult.status}</p>
                  <p className="text-sm text-muted-foreground mt-1">{analysisResult.statusDescription}</p>
                </div>
                <ClipboardCheck className="h-10 w-10 text-emerald-500" />
              </div>
            </Card>
          </div>
        )}

        {/* Analysis Tabs */}
        {analysisResult && (
          <Tabs defaultValue="draft" className="space-y-4">
            <TabsList className="grid grid-cols-2 md:grid-cols-6 lg:grid-cols-6">
              <TabsTrigger value="draft">Document Draft</TabsTrigger>
              <TabsTrigger value="compliance">Compliance</TabsTrigger>
              <TabsTrigger value="legal">Legal Research</TabsTrigger>
              <TabsTrigger value="approval">Approval Status</TabsTrigger>
              <TabsTrigger value="audit">Final Audit</TabsTrigger>
              <TabsTrigger value="analysis">Analysis</TabsTrigger>
            </TabsList>

            <TabsContent value="draft">
              <Card className="p-6">
                <TabActions type="draft" />
              </Card>
            </TabsContent>

            <TabsContent value="compliance">
              <Card className="p-6">
                <TabActions type="compliance" />
              </Card>
            </TabsContent>

            <TabsContent value="legal">
              <Card className="p-6">
                <TabActions type="legal" />
              </Card>
            </TabsContent>

            <TabsContent value="approval">
              <Card className="p-6">
                <TabActions type="approval" />
              </Card>
            </TabsContent>

            <TabsContent value="audit">
              <Card className="p-6">
                <TabActions type="audit" />
              </Card>
            </TabsContent>

            <TabsContent value="analysis">
              <Card className="p-6">
                <TabActions type="analysis" />
              </Card>
            </TabsContent>
          </Tabs>
        )}
      </div>
    </div>
  );
}