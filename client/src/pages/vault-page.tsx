import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Upload, FileText, Folder, X, FileArchive, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

// Define allowed roles that can upload documents
const UPLOAD_ALLOWED_ROLES = ["ADMIN", "LAWYER"];

export default function VaultPage() {
  const [selectedFiles, setSelectedFiles] = useState<FileList | null>(null);
  const [selectedDocument, setSelectedDocument] = useState<any>(null);
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch documents
  const { data: documentsData, isLoading: isLoadingDocuments } = useQuery({
    queryKey: ['/api/vault/documents'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/vault/documents');
      const data = await response.json();
      return data.documents;
    }
  });

  // Upload mutation
  const uploadMutation = useMutation({
    mutationFn: async (files: FileList) => {
      const formData = new FormData();
      Array.from(files).forEach(file => {
        formData.append('file', file);
      });

      const response = await apiRequest('POST', '/api/vault/documents', formData);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'Document uploaded successfully',
      });
      setSelectedFiles(null);
      queryClient.invalidateQueries({ queryKey: ['/api/vault/documents'] });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to upload document',
        variant: 'destructive',
      });
    }
  });

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      setSelectedFiles(event.target.files);
    }
  };

  const handleUpload = () => {
    if (selectedFiles) {
      uploadMutation.mutate(selectedFiles);
    }
  };

  const canUpload = user && UPLOAD_ALLOWED_ROLES.includes(user.role);

  return (
    <div className="min-h-screen bg-gradient-to-br from-yellow-50 to-green-50">
      <div className="container mx-auto px-4 py-8">
        {/* Header Section */}
        <div className="mb-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Document Vault</h1>
              <p className="text-gray-600 mt-2">Securely store and manage your legal documents</p>
            </div>
            {canUpload && (
              <Dialog>
                <DialogTrigger asChild>
                  <Button className="bg-green-600 hover:bg-green-700">
                    <Upload className="h-4 w-4 mr-2" />
                    Upload Document
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>Upload Documents</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div
                      className={cn(
                        "border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors",
                        "hover:border-green-500 hover:bg-green-50",
                        selectedFiles ? "border-green-500 bg-green-50" : "border-gray-300"
                      )}
                      onClick={() => document.querySelector<HTMLInputElement>('input[type="file"]')?.click()}
                    >
                      <input
                        type="file"
                        multiple
                        className="hidden"
                        onChange={handleFileSelect}
                        accept=".pdf,.doc,.docx,.txt"
                      />
                      <FileArchive className="mx-auto h-12 w-12 text-gray-400" />
                      <p className="mt-2 text-sm text-gray-600">
                        {selectedFiles ? (
                          <span className="text-green-600 font-medium">
                            {selectedFiles.length} file(s) selected
                          </span>
                        ) : (
                          "Click to select files or drag and drop"
                        )}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        Supports: PDF, DOC, DOCX, TXT
                      </p>
                    </div>

                    {selectedFiles && (
                      <ScrollArea className="h-[200px] rounded-md border p-4">
                        <div className="space-y-2">
                          {Array.from(selectedFiles).map((file, index) => (
                            <div
                              key={index}
                              className="flex items-center justify-between bg-white p-2 rounded-lg shadow-sm"
                            >
                              <div className="flex items-center space-x-2">
                                <FileText className="h-4 w-4 text-green-600" />
                                <span className="text-sm text-gray-700 truncate max-w-[200px]">
                                  {file.name}
                                </span>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedFiles(null);
                                }}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    )}

                    <div className="flex justify-end">
                      <Button
                        onClick={handleUpload}
                        disabled={!selectedFiles || uploadMutation.isPending}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        {uploadMutation.isPending ? (
                          <>
                            <span className="animate-spin mr-2">⌛</span>
                            Uploading...
                          </>
                        ) : (
                          <>
                            <Upload className="h-4 w-4 mr-2" />
                            Upload
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </div>

        {/* Documents Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {isLoadingDocuments ? (
            <div className="col-span-full text-center py-12">
              <span className="animate-spin mr-2">⌛</span> Loading documents...
            </div>
          ) : documentsData?.length === 0 ? (
            <div className="col-span-full">
              <Card className="border-dashed border-2 border-gray-200">
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Folder className="h-12 w-12 text-gray-400 mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No Documents Yet</h3>
                  <p className="text-gray-500 text-center mb-4">
                    {canUpload ? 'Upload your first document to get started' : 'No documents available'}
                  </p>
                  {canUpload && (
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button className="bg-green-600 hover:bg-green-700">
                          <Upload className="h-4 w-4 mr-2" />
                          Upload Document
                        </Button>
                      </DialogTrigger>
                    </Dialog>
                  )}
                </CardContent>
              </Card>
            </div>
          ) : (
            documentsData?.map((doc: any) => (
              <Card key={doc.id} className="hover:shadow-lg transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start space-x-4">
                    <FileText className="h-8 w-8 text-green-600 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-medium text-gray-900 truncate">
                        {doc.title}
                      </h3>
                      <p className="text-xs text-gray-500">
                        {new Date(doc.createdAt).toLocaleDateString()}
                      </p>
                      <p className="text-xs text-gray-500">
                        Type: {doc.documentType}
                      </p>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="mt-2"
                        onClick={() => setSelectedDocument(doc)}
                      >
                        <AlertCircle className="h-4 w-4 mr-2" />
                        View AI Insights
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* AI Insights Modal */}
        {selectedDocument && (
          <Dialog open={!!selectedDocument} onOpenChange={() => setSelectedDocument(null)}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>AI Insights: {selectedDocument.title}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium text-sm text-gray-900">Document Classification</h4>
                  <p className="text-sm text-gray-700">{selectedDocument.aiClassification}</p>
                </div>
                <div>
                  <h4 className="font-medium text-sm text-gray-900">Summary</h4>
                  <p className="text-sm text-gray-700">{selectedDocument.aiSummary}</p>
                </div>
                {selectedDocument.metadata?.keywords && (
                  <div>
                    <h4 className="font-medium text-sm text-gray-900">Keywords</h4>
                    <div className="flex flex-wrap gap-2">
                      {selectedDocument.metadata.keywords.map((keyword: string, index: number) => (
                        <span
                          key={index}
                          className="px-2 py-1 bg-green-50 text-green-700 rounded-full text-xs"
                        >
                          {keyword}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </div>
  );
}