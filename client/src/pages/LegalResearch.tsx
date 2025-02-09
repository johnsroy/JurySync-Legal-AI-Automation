import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { FilePond, registerPlugin } from "react-filepond";
import FilePondPluginFileValidateType from "filepond-plugin-file-validate-type";
import "filepond/dist/filepond.min.css";
import { queryClient, prefetchLegalDocuments, invalidateLegalDocuments } from "@/lib/queryClient";
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
  "How does the Americans with Disabilities Act protect against discrimination?",
  "Analyze the impact of the Voting Rights Act of 1965 on electoral participation",
  "Compare the civil rights protections in recent legislation with historical precedents",
  "Research legal precedents related to disability discrimination in employment"
];

export default function LegalResearch() {
  const [searchResults, setSearchResults] = useState<any>(null);
  const [files, setFiles] = useState<any[]>([]);
  const [selectedExample, setSelectedExample] = useState<string>("");
  const [uploadedDocResults, setUploadedDocResults] = useState<any>(null);
  const { toast } = useToast();

  const form = useForm<SearchForm>({
    resolver: zodResolver(searchSchema),
    defaultValues: {
      query: selectedExample
    }
  });

  useEffect(() => {
    if (selectedExample) {
      form.setValue("query", selectedExample);
    }
  }, [selectedExample, form]);

  // Prefetch documents on component mount
  useEffect(() => {
    prefetchLegalDocuments();
  }, []);

  // Query to fetch uploaded documents with loading state
  const { data: uploadedDocuments, isLoading: isLoadingDocuments } = useQuery({
    queryKey: ["/api/legal/documents"],
    queryFn: async () => {
      const response = await fetch("/api/legal/documents");
      if (!response.ok) throw new Error("Failed to fetch documents");
      return response.json();
    },
  });

  const searchMutation = useMutation({
    mutationFn: async (data: SearchForm) => {
      const response = await fetch("/api/legal/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to search");
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

  const handleSearch = (data: SearchForm) => {
    searchMutation.mutate(data);
  };

  const handleFilePondError = (error: any) => {
    console.error('FilePond error:', error);
    toast({
      title: "Upload Error",
      description: error.message || "Failed to upload document",
      variant: "destructive",
    });
  };

  // Function to analyze a specific document
  const analyzeDocument = async (documentId: number) => {
    try {
      console.log('Starting document analysis:', documentId);
      const response = await fetch(`/api/legal/documents/${documentId}/analyze`, {
        method: "POST",
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error("Failed to analyze document");
      }

      const data = await response.json();
      console.log('Analysis results received:', data);
      setUploadedDocResults(data);

      toast({
        title: "Analysis Complete",
        description: "Document analysis has been completed successfully.",
      });
    } catch (error: any) {
      console.error('Analysis error:', error);
      toast({
        title: "Analysis Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  // Render documents list with loading state
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
      <div key={doc.id} className="flex flex-col p-4 border rounded-lg">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h3 className="font-medium">{doc.title}</h3>
            <p className="text-sm text-gray-600">
              {new Date(doc.date).toLocaleDateString()} - {doc.documentType}
            </p>
          </div>
          <Button
            onClick={() => analyzeDocument(doc.id)}
            variant="outline"
            size="sm"
          >
            <Search className="w-4 h-4 mr-2" />
            Begin Research
          </Button>
        </div>
        {doc.content && (
          <div className="mt-2 text-sm text-gray-700 max-h-32 overflow-y-auto">
            <p>{doc.content.substring(0, 200)}...</p>
          </div>
        )}
      </div>
    ));
  };

  // Render results for uploaded document analysis
  const renderUploadedDocResults = () => {
    if (!uploadedDocResults) {
      console.log('No analysis results to display');
      return null;
    }

    console.log('Rendering analysis results:', uploadedDocResults);

    return (
      <div className="mt-6 space-y-4">
        <h3 className="text-xl font-semibold">Document Analysis Results</h3>
        <div className="space-y-4">
          {/* Summary Section */}
          <Card className="p-6">
            <h4 className="font-medium mb-2">Summary</h4>
            <p className="text-gray-700">{uploadedDocResults.summary}</p>
          </Card>

          {/* Key Points Section */}
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

          {/* Legal Implications Section */}
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

          {/* Recommendations Section */}
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

          {/* Risk Areas Section */}
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
      </div>
    );
  };

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-8">Legal Research Assistant</h1>

      <div className="grid gap-8">
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
                  onClick={() => setSelectedExample(example)}
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

        {/* Upload and Research Section */}
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Upload and Research Legal Documents</h2>
          <p className="text-sm text-gray-600 mb-4">
            Upload your legal documents for instant AI-powered analysis and research insights.
          </p>
          <FilePond
            files={files}
            onupdatefiles={setFiles}
            allowMultiple={false}
            maxFiles={1}
            server={{
              process: "/api/legal/documents",
              headers: {
                'Accept': 'application/json'
              },
              load: async (source, load, error, progress, abort, headers) => {
                try {
                  console.log('Upload response received:', source);
                  const data = JSON.parse(source);
                  console.log('Parsed upload response:', data);

                  if (data.documentId) {
                    console.log('Starting analysis for document:', data.documentId);
                    await analyzeDocument(data.documentId);
                    invalidateLegalDocuments();
                  } else {
                    console.error('No document ID in response');
                    throw new Error('Invalid upload response');
                  }
                } catch (err: any) {
                  console.error('Error processing upload response:', err);
                  toast({
                    title: "Error",
                    description: "Failed to process document",
                    variant: "destructive"
                  });
                  error('Upload processing failed');
                }
              }
            }}
            acceptedFileTypes={[
              'application/pdf',
              'application/msword',
              'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
            ]}
            labelIdle='Drag & Drop your legal document or <span class="filepond--label-action">Browse</span>'
            onerror={handleFilePondError}
          />

          {/* Display analysis results */}
          {renderUploadedDocResults()}
        </Card>

        {/* Available Documents Section */}
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
                        <p className="text-sm text-gray-600">
                          Jurisdiction: {result.document.jurisdiction}
                        </p>
                        <p className="mt-2">{result.document.content.substring(0, 200)}...</p>
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              {searchResults.timeline && (
                <Card className="p-6">
                  <h3 className="text-lg font-semibold mb-4">Timeline</h3>
                  <div className="space-y-2">
                    {searchResults.timeline.map((event: any, index: number) => (
                      <div key={index} className="flex gap-4">
                        <span className="font-medium">{event.date}</span>
                        <span>{event.event}</span>
                      </div>
                    ))}
                  </div>
                </Card>
              )}
            </div>
          )
        )}
      </div>
    </div>
  );
}