import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Search, FileText, Book } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { FilePond, registerPlugin } from "react-filepond";
import FilePondPluginFileValidateType from "filepond-plugin-file-validate-type";
import "filepond/dist/filepond.min.css";

// Register FilePond plugins
registerPlugin(FilePondPluginFileValidateType);

const searchSchema = z.object({
  query: z.string().min(1, "Please enter a search query"),
});

type SearchForm = z.infer<typeof searchSchema>;

const searchExamples = [
  "What are the key provisions of the Civil Rights Act of 1964?",
  "How has the Supreme Court's interpretation of the Fourth Amendment evolved in digital privacy cases?",
  "Analyze recent circuit court decisions on employment discrimination under the ADA",
  "Compare treatment of environmental regulations across different jurisdictions",
  "Research precedents related to intellectual property rights in AI-generated content",
  "What are the emerging trends in data privacy law across different states?"
];

export default function LegalResearch() {
  const [searchResults, setSearchResults] = useState<any>(null);
  const [selectedExample, setSelectedExample] = useState<string>("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<number | null>(null);
  const [documentSummary, setDocumentSummary] = useState<any>(null);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const { toast } = useToast();
  const [files, setFiles] = useState<any[]>([]);
  const [uploadedDocResults, setUploadedDocResults] = useState<any>(null);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [uploadedDocId, setUploadedDocId] = useState<number | null>(null);
  const [uploadedDocuments, setUploadedDocuments] = useState<any[]>([]);

  const form = useForm<SearchForm>({
    resolver: zodResolver(searchSchema),
    defaultValues: {
      query: ""
    }
  });

  // Fetch available legal documents
  const { data: legalDocuments, isLoading: isLoadingDocuments } = useQuery({
    queryKey: ["/api/legal/documents"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/legal/documents");
      return response.json();
    },
  });

  // Search mutation
  const searchMutation = useMutation({
    mutationFn: async (data: SearchForm) => {
      const response = await apiRequest("POST", "/api/legal/query", data);
      return response.json();
    },
    onSuccess: (data) => {
      setSearchResults(data);
      queryClient.invalidateQueries({ queryKey: ["/api/legal/documents"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Search Error",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Handle document analysis
  const analyzeDocument = async (documentId: number) => {
    try {
      setIsAnalyzing(true);
      setSelectedDocument(documentId);

      const response = await apiRequest("POST", `/api/legal/documents/${documentId}/analyze`);
      const data = await response.json();

      toast({
        title: "Analysis Complete",
        description: "Document analysis has been completed successfully.",
      });

      return data;
    } catch (error: any) {
      toast({
        title: "Analysis Error",
        description: error.message,
        variant: "destructive",
      });
      throw error;
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Generate document summary
  const generateSummary = async (documentId: number) => {
    try {
      setIsSummarizing(true);
      const response = await apiRequest("POST", `/api/legal/documents/${documentId}/summary`);
      const summary = await response.json();
      setDocumentSummary(summary);
      toast({
        title: "Summary Generated",
        description: "Document summary has been generated successfully.",
      });
    } catch (error: any) {
      toast({
        title: "Summary Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSummarizing(false);
    }
  };

  // Handle FilePond errors
  const handleFilePondError = (error: any) => {
    console.error('FilePond error:', error);
    toast({
      title: "Upload Error",
      description: error.message || "Failed to upload document",
      variant: "destructive",
    });
  };

  // FilePond server configuration
  const serverConfig = {
    process: "/api/legal/documents",
    headers: {
      'Accept': 'application/json'
    },
    load: async (source: string, load: Function, error: Function) => {
      try {
        const data = JSON.parse(source);
        if (data.documentId && data.content) {
          setUploadedDocId(data.documentId);

          queryClient.setQueryData(["/api/legal/documents"], (oldData: any) => {
            const existing = oldData || [];
            const newDoc = {
              id: data.documentId,
              title: data.title,
              content: data.content,
              status: "COMPLETED",
              date: new Date().toISOString()
            };
            return [newDoc, ...existing];
          });

          toast({
            title: "Document Uploaded",
            description: "Your document has been uploaded successfully and is ready for analysis.",
          });

          load(source);
        } else {
          error('Invalid upload response');
        }
      } catch (err: any) {
        console.error('Error processing upload response:', err);
        toast({
          title: "Upload Error",
          description: err.message || "Failed to process document",
          variant: "destructive",
        });
        error('Upload processing failed');
      }
    }
  };

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-8">Legal Research Assistant</h1>

      {/* Legal Documents Available for Research */}
      <Card className="p-6 mb-8">
        <h2 className="text-xl font-semibold mb-4 flex items-center">
          <Book className="mr-2" />
          Legal Documents Available for Research
        </h2>
        <div className="space-y-4">
          {isLoadingDocuments ? (
            Array(3).fill(0).map((_, index) => (
              <Skeleton key={index} className="h-24 w-full" />
            ))
          ) : (
            legalDocuments?.map((doc: any) => (
              <Card key={doc.id} className="p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-lg font-semibold">{doc.title}</h3>
                    <p className="text-sm text-gray-500 mt-1">
                      {doc.documentType} • {new Date(doc.date).toLocaleDateString()} • {doc.jurisdiction}
                    </p>
                    <p className="text-sm mt-2">{doc.content.substring(0, 150)}...</p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => analyzeDocument(doc.id)}
                      disabled={isAnalyzing && selectedDocument === doc.id}
                    >
                      {isAnalyzing && selectedDocument === doc.id ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Analyzing...
                        </>
                      ) : (
                        <>
                          <Search className="mr-2 h-4 w-4" />
                          Analyze
                        </>
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => generateSummary(doc.id)}
                      disabled={isSummarizing && selectedDocument === doc.id}
                    >
                      {isSummarizing && selectedDocument === doc.id ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Summarizing...
                        </>
                      ) : (
                        <>
                          <FileText className="mr-2 h-4 w-4" />
                          Summarize
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
      </Card>

      {/* Search Section */}
      <Card className="p-6 mb-8">
        <h2 className="text-xl font-semibold mb-4 flex items-center">
          <Search className="mr-2" />
          Search Legal Documents
        </h2>
        <div className="mb-4">
          <p className="text-sm text-gray-600 mb-2">Try these example searches:</p>
          <div className="flex flex-wrap gap-2">
            {searchExamples.map((example, index) => (
              <Button
                key={index}
                variant="outline"
                size="sm"
                onClick={() => {
                  setSelectedExample(example);
                  form.setValue("query", example);
                  form.handleSubmit((data) => searchMutation.mutate(data))();
                }}
                className="text-xs"
              >
                {example.slice(0, 50)}...
              </Button>
            ))}
          </div>
        </div>
        <form onSubmit={form.handleSubmit((data) => searchMutation.mutate(data))} className="space-y-4">
          <Textarea
            placeholder="Enter your legal research query..."
            {...form.register("query")}
            className="min-h-[100px]"
          />
          <Button
            type="submit"
            disabled={searchMutation.isPending}
            className="w-full"
          >
            {searchMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Searching...
              </>
            ) : (
              "Search"
            )}
          </Button>
        </form>
      </Card>

      {/* Search Results */}
      {searchResults && (
        <Card className="p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">Search Results</h2>
          <div className="space-y-6">
            {searchResults.summary && (
              <div>
                <h3 className="font-semibold mb-2">Analysis Summary</h3>
                <p>{searchResults.summary}</p>
              </div>
            )}

            {searchResults.patternAnalysis && (
              <div>
                <h3 className="font-semibold mb-2">Pattern Analysis</h3>
                <div className="space-y-4">
                  {searchResults.patternAnalysis.commonPrinciples?.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium mb-2">Common Legal Principles</h4>
                      <ul className="list-disc list-inside">
                        {searchResults.patternAnalysis.commonPrinciples.map((principle: string, index: number) => (
                          <li key={index} className="text-sm">{principle}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {searchResults.patternAnalysis.jurisdictionalTrends?.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium mb-2">Jurisdictional Trends</h4>
                      <ul className="list-disc list-inside">
                        {searchResults.patternAnalysis.jurisdictionalTrends.map((trend: string, index: number) => (
                          <li key={index} className="text-sm">{trend}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            )}

            {searchResults.recommendations?.length > 0 && (
              <div>
                <h3 className="font-semibold mb-2">Recommendations</h3>
                <ul className="list-disc list-inside">
                  {searchResults.recommendations.map((rec: string, index: number) => (
                    <li key={index} className="text-sm">{rec}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Document Summary */}
      {documentSummary && (
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Document Summary</h2>
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold mb-2">Executive Summary</h3>
              <p>{documentSummary.executiveSummary}</p>
            </div>
            {documentSummary.keyPoints?.length > 0 && (
              <div>
                <h3 className="font-semibold mb-2">Key Points</h3>
                <ul className="list-disc list-inside">
                  {documentSummary.keyPoints.map((point: string, index: number) => (
                    <li key={index}>{point}</li>
                  ))}
                </ul>
              </div>
            )}
            {documentSummary.legalPrinciples?.length > 0 && (
              <div>
                <h3 className="font-semibold mb-2">Legal Principles</h3>
                <ul className="list-disc list-inside">
                  {documentSummary.legalPrinciples.map((principle: string, index: number) => (
                    <li key={index}>{principle}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* File Upload Section */}
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">Upload and Research Legal Documents</h2>
        <p className="text-sm text-gray-600 mb-4">
          Upload your legal documents for instant AI-powered analysis and research insights.
        </p>
        <div className="space-y-4">
          <FilePond
            files={files}
            onupdatefiles={setFiles}
            allowMultiple={false}
            maxFiles={1}
            server={serverConfig}
            acceptedFileTypes={[
              'application/pdf',
              'application/msword',
              'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
            ]}
            labelIdle='Drag & Drop your legal document or <span class="filepond--label-action">Browse</span>'
            onerror={handleFilePondError}
          />

          {uploadedDocId && (
            <div className="mt-4 space-y-4">
              <Button
                onClick={() => uploadedDocId && analyzeDocument(uploadedDocId)}
                className="w-full"
                disabled={!uploadedDocId || isAnalyzing}
                variant="default"
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Search className="w-4 h-4 mr-2" />
                    Begin Research
                  </>
                )}
              </Button>

              {isAnalyzing && (
                <div className="mt-4">
                  <Progress value={analysisProgress} />
                  <p className="text-sm text-center mt-2">Analyzing document... {analysisProgress}%</p>
                </div>
              )}
            </div>
          )}
          {uploadedDocResults && !isAnalyzing && (
            <div className="mt-8 space-y-6">
              <h3 className="text-xl font-semibold">Document Analysis Results</h3>
              <Card className="p-6">
                <h4 className="font-medium mb-2">Summary</h4>
                <p className="text-gray-700">{uploadedDocResults.summary}</p>
              </Card>

              {uploadedDocResults.keyPoints?.length > 0 && (
                <Card className="p-6">
                  <h4 className="font-medium mb-2">Key Points</h4>
                  <ul className="list-disc list-inside space-y-2">
                    {uploadedDocResults.keyPoints.map((point: string, index: number) => (
                      <li key={index} className="text-gray-700">{point}</li>
                    ))}
                  </ul>
                </Card>
              )}

              {uploadedDocResults.legalImplications?.length > 0 && (
                <Card className="p-6">
                  <h4 className="font-medium mb-2">Legal Implications</h4>
                  <ul className="list-disc list-inside space-y-2">
                    {uploadedDocResults.legalImplications.map((implication: string, index: number) => (
                      <li key={index} className="text-gray-700">{implication}</li>
                    ))}
                  </ul>
                </Card>
              )}

              {uploadedDocResults.recommendations?.length > 0 && (
                <Card className="p-6">
                  <h4 className="font-medium mb-2">Recommendations</h4>
                  <ul className="list-disc list-inside space-y-2">
                    {uploadedDocResults.recommendations.map((rec: string, index: number) => (
                      <li key={index} className="text-gray-700">{rec}</li>
                    ))}
                  </ul>
                </Card>
              )}

              {uploadedDocResults.riskAreas?.length > 0 && (
                <Card className="p-6">
                  <h4 className="font-medium mb-2 text-red-600">Risk Areas</h4>
                  <ul className="list-disc list-inside space-y-2">
                    {uploadedDocResults.riskAreas.map((risk: string, index: number) => (
                      <li key={index} className="text-red-600">{risk}</li>
                    ))}
                  </ul>
                </Card>
              )}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}