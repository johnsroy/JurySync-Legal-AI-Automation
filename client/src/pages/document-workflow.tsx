import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Loader2, FileText, Download, Eye, CheckCircle, AlertTriangle, Info } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

export default function DocumentWorkflow() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<any>(null);
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

  const downloadPDF = async () => {
    try {
      const response = await fetch('/api/document/export', {
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
      a.download = `document-analysis.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "Export Success",
        description: "Document analysis has been downloaded.",
      });
    } catch (error) {
      toast({
        title: "Export Failed",
        description: error instanceof Error ? error.message : "Failed to export document",
        variant: "destructive"
      });
    }
  };

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
            <Card className="p-4 bg-blue-50 dark:bg-blue-900/10">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold">Document Type</h3>
                  <p className="text-sm text-muted-foreground">{analysisResult.documentType || "SOC 3 Report"}</p>
                </div>
                <FileText className="h-8 w-8 text-blue-500" />
              </div>
            </Card>
            
            <Card className="p-4 bg-emerald-50 dark:bg-emerald-900/10">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold">Industry</h3>
                  <p className="text-sm text-muted-foreground">{analysisResult.industry || "Technology"}</p>
                </div>
                <Info className="h-8 w-8 text-emerald-500" />
              </div>
            </Card>
            
            <Card className="p-4 bg-emerald-50 dark:bg-emerald-900/10">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold">Compliance Status</h3>
                  <p className="text-sm text-muted-foreground">{analysisResult.status || "COMPLIANT"}</p>
                </div>
                <CheckCircle className="h-8 w-8 text-emerald-500" />
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

            {/* Document Draft Tab */}
            <TabsContent value="draft">
              <Card className="p-6">
                <div className="flex justify-end gap-4 mb-4">
                  <Button variant="outline" onClick={() => {}}>
                    <Eye className="h-4 w-4 mr-2" />
                    Preview
                  </Button>
                  <Button onClick={downloadPDF}>
                    <Download className="h-4 w-4 mr-2" />
                    Download PDF
                  </Button>
                </div>
              </Card>
            </TabsContent>

            {/* Compliance Tab */}
            <TabsContent value="compliance">
              <Card className="p-6">
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="text-lg font-semibold">Compliance Overview</h3>
                    <Badge variant={analysisResult.complianceStatus === "Compliant" ? "success" : "destructive"}>
                      {analysisResult.complianceStatus || "Compliant"}
                    </Badge>
                  </div>
                  <div className="flex justify-end gap-4">
                    <Button variant="outline">
                      <Eye className="h-4 w-4 mr-2" />
                      Preview
                    </Button>
                    <Button>
                      <Download className="h-4 w-4 mr-2" />
                      Download PDF
                    </Button>
                  </div>
                </div>
              </Card>
            </TabsContent>

            {/* Legal Research Tab */}
            <TabsContent value="legal">
              <Card className="p-6">
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="text-lg font-semibold">Legal Analysis</h3>
                    <Badge variant="outline">
                      {analysisResult.legalStatus || "Completed"}
                    </Badge>
                  </div>
                  <div className="flex justify-end gap-4">
                    <Button variant="outline">
                      <Eye className="h-4 w-4 mr-2" />
                      Preview
                    </Button>
                    <Button>
                      <Download className="h-4 w-4 mr-2" />
                      Download PDF
                    </Button>
                  </div>
                </div>
              </Card>
            </TabsContent>

            {/* Approval Status Tab */}
            <TabsContent value="approval">
              <Card className="p-6">
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="text-lg font-semibold">Approval Status</h3>
                    <Badge variant="outline">
                      {analysisResult.approvalStatus || "Pending Review"}
                    </Badge>
                  </div>
                  <div className="flex justify-end gap-4">
                    <Button variant="outline">
                      <Eye className="h-4 w-4 mr-2" />
                      Preview
                    </Button>
                    <Button>
                      <Download className="h-4 w-4 mr-2" />
                      Download PDF
                    </Button>
                  </div>
                </div>
              </Card>
            </TabsContent>

            {/* Final Audit Tab */}
            <TabsContent value="audit">
              <Card className="p-6">
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="text-lg font-semibold">Final Audit Results</h3>
                    <Badge variant="outline">
                      {analysisResult.auditStatus || "Complete"}
                    </Badge>
                  </div>
                  <div className="flex justify-end gap-4">
                    <Button variant="outline">
                      <Eye className="h-4 w-4 mr-2" />
                      Preview
                    </Button>
                    <Button>
                      <Download className="h-4 w-4 mr-2" />
                      Download PDF
                    </Button>
                  </div>
                </div>
              </Card>
            </TabsContent>

            {/* Analysis Tab */}
            <TabsContent value="analysis">
              <Card className="p-6">
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="text-lg font-semibold">Analysis Summary</h3>
                    <Badge variant="outline">
                      {analysisResult.analysisStatus || "Complete"}
                    </Badge>
                  </div>
                  <div className="flex justify-end gap-4">
                    <Button variant="outline">
                      <Eye className="h-4 w-4 mr-2" />
                      Preview
                    </Button>
                    <Button>
                      <Download className="h-4 w-4 mr-2" />
                      Download PDF
                    </Button>
                  </div>
                </div>
              </Card>
            </TabsContent>
          </Tabs>
        )}
      </div>
    </div>
  );
}
