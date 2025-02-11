import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { FilePond, registerPlugin } from "react-filepond";
import FilePondPluginFileValidateType from "filepond-plugin-file-validate-type";
import "filepond/dist/filepond.min.css";
import { queryClient, prefetchLegalDocuments, invalidateLegalDocuments, apiRequest } from "@/lib/queryClient";
import { Loader2, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";

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
  const [files, setFiles] = useState<any[]>([]);
  const [selectedExample, setSelectedExample] = useState<string>("");
  const [uploadedDocResults, setUploadedDocResults] = useState<any>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [uploadedDocId, setUploadedDocId] = useState<number | null>(null);
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<'search' | 'summary'>('search');
  const [selectedDocument, setSelectedDocument] = useState<number | null>(null);
  const [documentSummary, setDocumentSummary] = useState<any>(null);
  const [isSummarizing, setIsSummarizing] = useState(false);

  const form = useForm<SearchForm>({
    resolver: zodResolver(searchSchema),
    defaultValues: {
      query: ""
    }
  });

  useEffect(() => {
    if (selectedExample) {
      form.setValue("query", selectedExample);
      form.handleSubmit(handleSearch)();
    }
  }, [selectedExample, form]);

  useEffect(() => {
    prefetchLegalDocuments();
  }, []);

  const { data: uploadedDocuments, isLoading: isLoadingDocuments } = useQuery({
    queryKey: ["/api/legal/documents"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/legal/documents");
      return response.json();
    },
  });

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

  const handleSearch = async (data: SearchForm) => {
    try {
      setSearchResults(null);
      await searchMutation.mutateAsync(data);
    } catch (error) {
      console.error('Search error:', error);
    }
  };

  const simulateProgress = () => {
    setAnalysisProgress(0);
    const interval = setInterval(() => {
      setAnalysisProgress((prev) => {
        if (prev >= 90) {
          clearInterval(interval);
          return prev;
        }
        return prev + 10;
      });
    }, 500);
    return interval;
  };

  const analyzeDocument = async (documentId: number) => {
    try {
      setIsAnalyzing(true);
      const progressInterval = simulateProgress();

      const response = await apiRequest("POST", `/api/legal/documents/${documentId}/analyze`);
      const data = await response.json();

      clearInterval(progressInterval);
      setAnalysisProgress(100);
      setUploadedDocResults({...data});

      toast({
        title: "Analysis Complete",
        description: "Document analysis has been completed successfully.",
      });

      setTimeout(() => {
        setAnalysisProgress(0);
        setIsAnalyzing(false);
      }, 1000);

      return data;
    } catch (error: any) {
      setIsAnalyzing(false);
      setAnalysisProgress(0);
      console.error('Analysis error:', error);
      toast({
        title: "Analysis Error",
        description: error.message,
        variant: "destructive",
      });
      throw error;
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

  const renderDocumentsList = () => {
    if (isLoadingDocuments) {
      return Array(3).fill(0).map((_, index) => (
        <div key={index} className="flex flex-col p-4 border rounded-lg animate-pulse">
          <Skeleton className="h-6 w-3/4 mb-2" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      ));
    }

    return uploadedDocuments?.map((doc: any) => (
      <Card key={doc.id} className="p-4">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h3 className="font-medium text-lg">{doc.title}</h3>
            <p className="text-sm text-gray-600">
              {new Date(doc.date).toLocaleDateString()} - {doc.documentType}
            </p>
            <p className="text-sm text-gray-700 mt-1">Jurisdiction: {doc.jurisdiction}</p>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => analyzeDocument(doc.id)}
              variant="outline"
              size="sm"
              disabled={isAnalyzing}
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Search className="w-4 h-4 mr-2" />
                  Analyze
                </>
              )}
            </Button>
            <Button
              onClick={() => {
                setSelectedDocument(doc.id);
                generateSummary(doc.id);
              }}
              variant="outline"
              size="sm"
              disabled={isSummarizing && selectedDocument === doc.id}
            >
              {isSummarizing && selectedDocument === doc.id ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Summarizing...
                </>
              ) : (
                "Generate Summary"
              )}
            </Button>
          </div>
        </div>
        {doc.content && (
          <div className="mt-2 text-sm text-gray-700 max-h-32 overflow-y-auto">
            <p>{doc.content.substring(0, 200)}...</p>
          </div>
        )}
      </Card>
    ));
  };

  const generateSummary = async (documentId: number) => {
    try {
      setIsSummarizing(true);
      const response = await apiRequest("POST", `/api/legal/documents/${documentId}/summary`);
      const summary = await response.json();
      setDocumentSummary(summary);
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


  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-8">Legal Research Assistant</h1>

      <div className="flex space-x-4 mb-6">
        <Button
          variant={activeTab === 'search' ? 'default' : 'outline'}
          onClick={() => setActiveTab('search')}
        >
          Search & Analysis
        </Button>
        <Button
          variant={activeTab === 'summary' ? 'default' : 'outline'}
          onClick={() => setActiveTab('summary')}
        >
          Document Summary
        </Button>
      </div>

      <div className="grid gap-8">
        {activeTab === 'search' ? (
          <>
            <Card className="p-6">
              <h2 className="text-xl font-semibold mb-4">Search Legal Documents</h2>
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
                      }}
                      className="text-xs"
                    >
                      {example.slice(0, 50)}...
                    </Button>
                  ))}
                </div>
              </div>
              <form onSubmit={form.handleSubmit(handleSearch)} className="space-y-4">
                <div>
                  <Textarea
                    placeholder="Enter your legal research query..."
                    {...form.register("query")}
                    className="min-h-[100px]"
                  />
                  {form.formState.errors.query && (
                    <p className="text-red-500 text-sm mt-1">{form.formState.errors.query.message}</p>
                  )}
                </div>
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
                    <>
                      <Search className="mr-2 h-4 w-4" />
                      Begin Research
                    </>
                  )}
                </Button>
              </form>
            </Card>

            {searchResults && (
              <div className="space-y-4">
                <Card className="p-6">
                  <h3 className="text-lg font-semibold mb-2">Summary</h3>
                  <p>{searchResults.summary}</p>
                </Card>

                {searchResults.relevantCases?.length > 0 && (
                  <Card className="p-6">
                    <h3 className="text-lg font-semibold mb-4">Relevant Cases</h3>
                    <div className="space-y-4">
                      {searchResults.relevantCases.map((result: any, index: number) => (
                        <div key={index} className="border-b last:border-0 pb-4">
                          <h4 className="font-medium">{result.document.title}</h4>
                          <p className="text-sm text-gray-600 mt-1">
                            Jurisdiction: {result.document.jurisdiction} |
                            Relevance: {result.relevance}
                          </p>
                          <p className="mt-2 text-gray-700">{result.document.content.substring(0, 200)}...</p>
                        </div>
                      ))}
                    </div>
                  </Card>
                )}

                {searchResults.visualAids?.citationNetwork && (
                  <Card className="p-6">
                    <h3 className="text-lg font-semibold mb-4">Citation Network</h3>
                    <div className="h-64 bg-gray-50 rounded-lg p-4">
                      {/* Placeholder for citation network visualization */}
                      <p className="text-gray-500 text-center">Citation network visualization would be rendered here</p>
                    </div>
                  </Card>
                )}

                {searchResults.timeline && (
                  <Card className="p-6">
                    <h3 className="text-lg font-semibold mb-4">Legal Timeline</h3>
                    <div className="space-y-2">
                      {searchResults.timeline.map((event: any, index: number) => (
                        <div key={index} className="flex gap-4 items-start">
                          <span className="font-medium text-gray-600 min-w-[100px]">{event.date}</span>
                          <div>
                            <span className="text-gray-700">{event.event}</span>
                            <p className="text-sm text-gray-500">{event.significance}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </Card>
                )}

                {searchResults.recommendations?.length > 0 && (
                  <Card className="p-6">
                    <h3 className="text-lg font-semibold mb-4">Recommendations</h3>
                    <ul className="list-disc list-inside space-y-2">
                      {searchResults.recommendations.map((rec: string, index: number) => (
                        <li key={index} className="text-gray-700">{rec}</li>
                      ))}
                    </ul>
                  </Card>
                )}
              </div>
            )}
          </>
        ) : (
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">Generate Document Summary</h2>
            <div className="space-y-4">
              {uploadedDocuments?.map((doc: any) => (
                <div key={doc.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <h3 className="font-medium">{doc.title}</h3>
                    <p className="text-sm text-gray-600">
                      {new Date(doc.date).toLocaleDateString()} - {doc.documentType}
                    </p>
                  </div>
                  <Button
                    onClick={() => {
                      setSelectedDocument(doc.id);
                      generateSummary(doc.id);
                    }}
                    variant="outline"
                    size="sm"
                    disabled={isSummarizing && selectedDocument === doc.id}
                  >
                    {isSummarizing && selectedDocument === doc.id ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Summarizing...
                      </>
                    ) : (
                      "Generate Summary"
                    )}
                  </Button>
                </div>
              ))}

              {documentSummary && (
                <div className="mt-8 space-y-6">
                  <Card className="p-6">
                    <h3 className="text-lg font-semibold mb-4">Executive Summary</h3>
                    <p className="text-gray-700">{documentSummary.executiveSummary}</p>
                  </Card>

                  <Card className="p-6">
                    <h3 className="text-lg font-semibold mb-4">Key Points</h3>
                    <ul className="list-disc list-inside space-y-2">
                      {documentSummary.keyPoints?.map((point: string, index: number) => (
                        <li key={index} className="text-gray-700">{point}</li>
                      ))}
                    </ul>
                  </Card>

                  <Card className="p-6">
                    <h3 className="text-lg font-semibold mb-4">Legal Principles</h3>
                    <ul className="list-disc list-inside space-y-2">
                      {documentSummary.legalPrinciples?.map((principle: string, index: number) => (
                        <li key={index} className="text-gray-700">{principle}</li>
                      ))}
                    </ul>
                  </Card>

                  {documentSummary.timeline && (
                    <Card className="p-6">
                      <h3 className="text-lg font-semibold mb-4">Timeline</h3>
                      <div className="space-y-2">
                        {documentSummary.timeline.map((event: any, index: number) => (
                          <div key={index} className="flex gap-4 items-start">
                            <span className="font-medium text-gray-600 min-w-[100px]">{event.date}</span>
                            <span className="text-gray-700">{event.event}</span>
                          </div>
                        ))}
                      </div>
                    </Card>
                  )}
                </div>
              )}
            </div>
          </Card>
        )}
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

                <div className="p-4 border rounded-lg">
                  <h4 className="text-sm font-medium mb-2">Document Preview</h4>
                  <div className="max-h-48 overflow-y-auto p-4 bg-gray-50 rounded border text-sm">
                    {uploadedDocuments?.find((doc: any) => doc.id === uploadedDocId)?.content ? (
                      <p className="whitespace-pre-wrap">
                        {uploadedDocuments.find((doc: any) => doc.id === uploadedDocId)?.content.substring(0, 500)}
                        {uploadedDocuments.find((doc: any) => doc.id === uploadedDocId)?.content.length > 500 && '...'}
                      </p>
                    ) : (
                      <p className="text-gray-500">Loading document content...</p>
                    )}
                  </div>
                </div>

                {isAnalyzing && (
                  <div className="mt-4">
                    <Progress value={analysisProgress} className="w-full" />
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
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Documents Available for Research</h2>
          <p className="text-sm text-gray-600 mb-4">
            You can conduct research on any of the following legal documents, including sample cases and your uploaded materials:
          </p>
          <div className="space-y-4">
            {renderDocumentsList()}
          </div>
        </Card>
        {searchMutation.isPending ? (
          <div className="flex justify-center items-center p-8">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : (
          searchResults && (
            <div className="space-y-4">

            </div>
          )
        )}
      </div>
    </div>
  );
}