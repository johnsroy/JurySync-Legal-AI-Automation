import { useState } from "react";
import { useDropzone } from "react-dropzone";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Upload, FileText, Folder, AlertCircle } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

// Define allowed roles that can upload documents
const UPLOAD_ALLOWED_ROLES = ["ADMIN", "LAWYER"];

interface Document {
  id: number;
  title: string;
  createdAt: string;
  metadata?: {
    documentType: string;
    industry: string;
    classification: string;
    keywords: string[];
  };
}

export default function VaultPage() {
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch documents from both vault and workflow
  const { data: documentsData = [], isLoading: isLoadingDocuments } = useQuery<Document[]>({
    queryKey: ['/api/documents'],
    queryFn: async () => {
      try {
        // Fetch from both endpoints
        const [vaultResponse, workflowResponse] = await Promise.all([
          apiRequest('GET', '/api/vault/documents'),
          apiRequest('GET', '/api/workflow/documents')
        ]);

        const vaultDocs = await vaultResponse.json();
        const workflowDocs = await workflowResponse.json();

        // Combine and deduplicate documents by ID
        const allDocs = [...vaultDocs, ...workflowDocs];
        const uniqueDocs = Array.from(
          new Map(allDocs.map(doc => [doc.id, doc])).values()
        );

        return uniqueDocs;
      } catch (error) {
        console.error('Error fetching documents:', error);
        toast({
          title: 'Error',
          description: 'Failed to fetch documents',
          variant: 'destructive',
        });
        return [];
      }
    },
    refetchInterval: 5000 // Refresh every 5 seconds to catch new uploads
  });

  // File upload handler using react-dropzone
  const onDrop = async (acceptedFiles: File[]) => {
    for (const file of acceptedFiles) {
      const formData = new FormData();
      formData.append('file', file);
      try {
        await uploadMutation.mutateAsync(formData);
      } catch (error) {
        console.error('Upload error:', error);
      }
    }
  };

  const { getRootProps, getInputProps } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'text/plain': ['.txt']
    }
  });

  // Upload mutation
  const uploadMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const response = await apiRequest('POST', '/api/vault/documents', formData);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'Document uploaded successfully',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/documents'] });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to upload document',
        variant: 'destructive',
      });
    }
  });

  // Category analysis handlers
  const analyzeDocs = async (category: string) => {
    try {
      const response = await apiRequest('GET', `/api/vault/analyze/${category}`);
      const data = await response.json();

      // Open a modal or dialog to show the analysis results
      setSelectedDocument({
        id: 0,
        title: `${category} Analysis`,
        createdAt: new Date().toISOString(),
        metadata: {
          documentType: category,
          industry: 'Legal',
          classification: 'Analysis',
          keywords: data.keywords || []
        }
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: `Failed to analyze ${category}`,
        variant: 'destructive',
      });
    }
  };

  const canUpload = user && UPLOAD_ALLOWED_ROLES.includes(user.role);

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header Section */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Document Vault</h1>
        <p className="text-gray-600 mt-2">
          Securely store and manage your legal documents
        </p>
      </div>

      {/* Analysis Actions */}
      <div className="flex gap-4 mb-8">
        <Button 
          className="flex-1"
          onClick={() => analyzeDocs('Reps & Warranties')}
        >
          Reps & Warranties
        </Button>
        <Button 
          className="flex-1"
          onClick={() => analyzeDocs('M&A Deal Points')}
        >
          M&A Deal Points
        </Button>
        <Button 
          className="flex-1"
          onClick={() => analyzeDocs('Compliance Analysis')}
        >
          Compliance Analysis
        </Button>
      </div>

      {/* Upload Area */}
      {canUpload && (
        <div className="mb-8">
          <div
            {...getRootProps()}
            className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors hover:border-green-500 hover:bg-green-50"
          >
            <input {...getInputProps()} />
            <Upload className="mx-auto h-12 w-12 text-gray-400" />
            <p className="mt-2 text-sm text-gray-600">
              Drag & drop files here or click to select files
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Supports: PDF, DOC, DOCX, TXT
            </p>
          </div>
        </div>
      )}

      {/* Documents Table */}
      <Card className="mb-8">
        <CardContent className="p-6">
          <ScrollArea className="h-[500px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>File</TableHead>
                  <TableHead>Document Type</TableHead>
                  <TableHead>Industry</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoadingDocuments ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-4">
                      <span className="animate-spin mr-2">⌛</span> Loading documents...
                    </TableCell>
                  </TableRow>
                ) : !documentsData?.length ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-4">
                      <div className="flex flex-col items-center justify-center">
                        <Folder className="h-12 w-12 text-gray-400 mb-4" />
                        <h3 className="text-lg font-medium text-gray-900 mb-2">No Documents Yet</h3>
                        <p className="text-gray-500">
                          {canUpload ? 'Upload your first document to get started' : 'No documents available'}
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  documentsData.map((doc) => (
                    <TableRow key={doc.id}>
                      <TableCell>
                        <div className="flex items-center space-x-3">
                          <FileText className="h-5 w-5 text-green-600 flex-shrink-0" />
                          <div>
                            <p className="font-medium text-sm">{doc.title}</p>
                            <p className="text-xs text-gray-500">
                              {new Date(doc.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {doc.metadata?.documentType || "Unknown"}
                      </TableCell>
                      <TableCell>
                        {doc.metadata?.industry || "Unknown"}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedDocument(doc)}
                        >
                          <AlertCircle className="h-4 w-4 mr-2" />
                          View Details
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Document Details Modal */}
      {selectedDocument && (
        <Dialog open={!!selectedDocument} onOpenChange={() => setSelectedDocument(null)}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>{selectedDocument.title}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <h4 className="font-medium text-sm text-gray-900">Document Type</h4>
                <p className="text-sm text-gray-700">{selectedDocument.metadata?.documentType}</p>
              </div>
              <div>
                <h4 className="font-medium text-sm text-gray-900">Industry</h4>
                <p className="text-sm text-gray-700">{selectedDocument.metadata?.industry}</p>
              </div>
              {selectedDocument.metadata?.keywords && (
                <div>
                  <h4 className="font-medium text-sm text-gray-900">Keywords</h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedDocument.metadata.keywords.map((keyword, index) => (
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
  );
}