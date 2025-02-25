import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Progress } from "@/components/ui/progress";
import { Loader2, FileText, Download, Eye, BookOpen, ClipboardCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface AnalysisResult {
  documentType: string;
  documentDescription: string;
  industry: string;
  industryDescription: string;
  status: 'COMPLIANT' | 'NON_COMPLIANT';
  statusDescription: string;
  content?: string;
  aiAnalysis?: any;
}

export default function DocumentWorkflow() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const { toast } = useToast();

  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > 100 * 1024 * 1024) {
        toast({
          title: "File too large",
          description: "Maximum file size is 100MB",
          variant: "destructive"
        });
        return;
      }
      setSelectedFile(file);
      setUploadProgress(0);
    }
  }, [toast]);

  const processDocument = async () => {
    if (!selectedFile) return;

    setIsProcessing(true);
    setUploadProgress(0);
    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      console.log('Uploading file:', {
        name: selectedFile.name,
        type: selectedFile.type,
        size: selectedFile.size
      });

      const xhr = new XMLHttpRequest();
      const promise = new Promise((resolve, reject) => {
        xhr.upload.addEventListener('progress', (event) => {
          if (event.lengthComputable) {
            const progress = Math.round((event.loaded * 100) / event.total);
            setUploadProgress(progress);
          }
        });

        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(JSON.parse(xhr.responseText));
          } else {
            reject(new Error(`Upload failed: ${xhr.statusText}`));
          }
        });

        xhr.addEventListener('error', () => reject(new Error('Upload failed')));
      });

      xhr.open('POST', '/api/workflow/upload');
      xhr.send(formData);

      const result = await promise;
      console.log('Upload response:', result);

      toast({
        title: "Upload Successful",
        description: "Document uploaded successfully. Starting analysis...",
      });

      const analysisResponse = await fetch('/api/workflow/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ documentId: result.documentId })
      });

      if (!analysisResponse.ok) {
        throw new Error('Analysis failed');
      }

      const analysisResult = await analysisResponse.json();
      setAnalysisResult({
        ...analysisResult.analysis,
        content: result.text
      });

      toast({
        title: "Analysis Complete",
        description: "Document processed and analysis ready.",
      });
    } catch (error) {
      console.error('Document processing error:', error);
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
        <Card className="p-6">
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <FileText className="h-8 w-8 text-primary" />
              <div>
                <h2 className="text-2xl font-semibold">Document Processing</h2>
                <p className="text-muted-foreground">Upload your document for AI-powered analysis</p>
              </div>
            </div>

            <div className="space-y-4">
              <input
                type="file"
                onChange={handleFileUpload}
                accept=".pdf,.docx,.doc,.txt"
                className="flex-1 p-2 border rounded-md w-full"
              />

              {selectedFile && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>{selectedFile.name}</span>
                    <span>{Math.round(selectedFile.size / 1024)} KB</span>
                  </div>

                  {(isProcessing || uploadProgress > 0) && (
                    <div className="space-y-2">
                      <Progress value={uploadProgress} className="w-full" />
                      <p className="text-sm text-muted-foreground text-center">
                        {uploadProgress}% {isProcessing ? "Processing..." : "Uploaded"}
                      </p>
                    </div>
                  )}
                </div>
              )}

              <Button
                onClick={processDocument}
                disabled={!selectedFile || isProcessing}
                className="w-full"
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

        {analysisResult && (
          <div className="space-y-6">
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
                    <Badge variant={analysisResult.status === 'COMPLIANT' ? 'success' : 'destructive'}>
                      {analysisResult.status}
                    </Badge>
                    <p className="text-sm text-muted-foreground mt-1">{analysisResult.statusDescription}</p>
                  </div>
                  <ClipboardCheck className="h-10 w-10 text-emerald-500" />
                </div>
              </Card>
            </div>

            <Tabs defaultValue="legal" className="space-y-4">
              <TabsList className="grid grid-cols-2 md:grid-cols-6 lg:grid-cols-6">
                <TabsTrigger value="legal">Legal Research</TabsTrigger>
                <TabsTrigger value="compliance">Compliance</TabsTrigger>
                <TabsTrigger value="draft">Document Draft</TabsTrigger>
                <TabsTrigger value="approval">Approval Status</TabsTrigger>
                <TabsTrigger value="audit">Final Audit</TabsTrigger>
                <TabsTrigger value="analysis">Analysis</TabsTrigger>
              </TabsList>

              <TabsContent value="legal">
                <Card className="p-6">
                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xl font-semibold">Legal Research Findings</h3>
                      <Button onClick={() => downloadPDF('legal')}>
                        <Download className="h-4 w-4 mr-2" />
                        Download Report
                      </Button>
                    </div>
                    <div className="space-y-4">
                      <h4 className="text-lg font-medium">Executive Summary</h4>
                      <Card className="p-4 bg-card/50">
                        <p className="text-foreground">{analysisResult?.legalAnalysis?.summary}</p>
                      </Card>
                    </div>

                    <div className="space-y-4">
                      <h4 className="text-lg font-medium">Key Legal Principles</h4>
                      <div className="grid gap-3">
                        {analysisResult?.legalAnalysis?.analysis?.legalPrinciples?.map((principle, index) => (
                          <Card key={index} className="p-4 bg-card/50">
                            <div className="flex items-start gap-3">
                              <span className="text-primary font-semibold">{index + 1}.</span>
                              <p className="text-foreground">{principle}</p>
                            </div>
                          </Card>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h4 className="text-lg font-medium">Key Legal Precedents</h4>
                      <div className="grid gap-4">
                        {analysisResult?.legalAnalysis?.analysis?.keyPrecedents?.map((precedent, index) => (
                          <Card key={index} className="p-4 bg-card/50">
                            <div className="space-y-3">
                              <h5 className="font-semibold text-primary">{precedent.case}</h5>
                              <div className="grid md:grid-cols-2 gap-4">
                                <div>
                                  <p className="text-sm font-medium text-muted-foreground">Relevance</p>
                                  <p className="text-foreground">{precedent.relevance}</p>
                                </div>
                                <div>
                                  <p className="text-sm font-medium text-muted-foreground">Impact</p>
                                  <p className="text-foreground">{precedent.impact}</p>
                                </div>
                              </div>
                            </div>
                          </Card>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h4 className="text-lg font-medium">Citations and References</h4>
                      <div className="grid gap-4">
                        {analysisResult?.legalAnalysis?.citations?.map((citation, index) => (
                          <Card key={index} className="p-4 bg-card/50">
                            <div className="space-y-2">
                              <h5 className="font-semibold text-primary">{citation.source}</h5>
                              <p className="text-sm text-muted-foreground">{citation.reference}</p>
                              <p className="text-sm italic">{citation.context}</p>
                            </div>
                          </Card>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h4 className="text-lg font-medium">Recommendations</h4>
                      <div className="grid gap-3">
                        {analysisResult?.legalAnalysis?.analysis?.recommendations?.map((recommendation, index) => (
                          <Card key={index} className="p-4 bg-card/50">
                            <div className="flex items-start gap-3">
                              <FileText className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                              <p className="text-foreground">{recommendation}</p>
                            </div>
                          </Card>
                        ))}
                      </div>
                    </div>
                  </div>
                </Card>
              </TabsContent>
              <TabsContent value="compliance">
                <Card className="p-6">
                  <TabActions type="compliance" />
                </Card>
              </TabsContent>
              <TabsContent value="draft">
                <Card className="p-6">
                  <TabActions type="draft" />
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
          </div>
        )}
      </div>
    </div>
  );
}