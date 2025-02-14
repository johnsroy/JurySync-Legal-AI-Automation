import { useState } from "react";
import { useDropzone } from "react-dropzone";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Upload, FileText, Folder, AlertCircle, Trash2, RefreshCw } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

// Define allowed roles that can upload documents
const UPLOAD_ALLOWED_ROLES = ["ADMIN", "LAWYER"];

interface DocumentAnalysis {
  documentType: string;
  industry: string;
  complianceStatus: string;
  confidence?: number;
  details?: {
    findings: string[];
    scope: string | null;
    keyTerms: string[];
    recommendations: string[];
  };
}

interface Document {
  id: number;
  title: string;
  createdAt: string;
  analysis: DocumentAnalysis;
}

export default function VaultPage() {
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // File upload handler
  const onDrop = async (acceptedFiles: File[]) => {
    const promises = acceptedFiles.map(file => {
      const formData = new FormData();
      formData.append('file', file);
      return uploadMutation.mutateAsync(formData);
    });

    try {
      await Promise.all(promises);
    } catch (error) {
      console.error('Upload failed:', error);
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

  // Add refresh function
  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await queryClient.invalidateQueries({ queryKey: ['/api/vault/documents'] });
      toast({
        title: 'Success',
        description: 'Document list refreshed successfully',
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  // Fetch documents
  const { data: documents = [], isLoading } = useQuery({
    queryKey: ['/api/vault/documents'],
    queryFn: async () => {
      try {
        const response = await apiRequest('GET', '/api/vault/documents');
        const data = await response.json();
        return data.documents;
      } catch (error) {
        console.error('Error fetching documents:', error);
        throw error;
      }
    },
    staleTime: 1000, // Consider data fresh for 1 second
    cacheTime: 5 * 60 * 1000, // Keep data in cache for 5 minutes
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (documentId: number) => {
      const response = await apiRequest('DELETE', `/api/vault/documents/${documentId}`);
      if (!response.ok) {
        throw new Error('Failed to delete document');
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'Document deleted successfully',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/vault/documents'] });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete document',
        variant: 'destructive',
      });
    }
  });

  // Upload mutation
  const uploadMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const response = await apiRequest('POST', '/api/vault/upload', formData);
      if (!response.ok) {
        throw new Error('Upload failed');
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'Document uploaded and analyzed successfully',
      });
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

  const canUpload = user && UPLOAD_ALLOWED_ROLES.includes(user.role);

  // Function to render document type with proper M&A classification
  const renderDocumentType = (doc: Document) => {
    const type = doc.analysis?.documentType;
    if (!type) return "Unknown";

    // Special handling for M&A documents to ensure proper display
    if (type.toLowerCase().includes('m&a') || 
        type.toLowerCase().includes('merger') || 
        type.toLowerCase().includes('acquisition')) {
      return type.startsWith('M&A Agreement') ? type : `M&A Agreement - ${type}`;
    }

    return type;
  };

  // Function to render compliance status
  const renderComplianceStatus = (doc: Document) => {
    if (!doc.analysis?.complianceStatus) return null;

    const statusColors = {
      'Compliant': 'text-green-600 bg-green-50',
      'Non-Compliant': 'text-red-600 bg-red-50',
      'Needs Review': 'text-yellow-600 bg-yellow-50'
    };

    const statusColor = statusColors[doc.analysis.complianceStatus as keyof typeof statusColors] || 'text-gray-600 bg-gray-50';

    return (
      <span className={`px-2 py-1 rounded-full text-xs ${statusColor}`}>
        {doc.analysis.complianceStatus}
      </span>
    );
  };

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
            <Button
              onClick={handleRefresh}
              variant="outline"
              size="sm"
              className="flex items-center gap-2"
              disabled={isRefreshing}
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
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
                    <TableHead>Compliance Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-4">
                        <span className="animate-spin mr-2">⌛</span> Loading documents...
                      </TableCell>
                    </TableRow>
                  ) : !documents.length ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-4">
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
                    documents.map((doc: Document) => (
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
                        <TableCell>{renderDocumentType(doc)}</TableCell>
                        <TableCell>
                          {doc.analysis?.industry || "Unknown"}
                        </TableCell>
                        <TableCell>
                          {renderComplianceStatus(doc)}
                        </TableCell>
                        <TableCell>
                          <div className="flex space-x-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setSelectedDocument(doc)}
                            >
                              <AlertCircle className="h-4 w-4 mr-2" />
                              View Details
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                              onClick={() => {
                                if (window.confirm('Are you sure you want to delete this document?')) {
                                  deleteMutation.mutate(doc.id);
                                }
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Document Details Dialog */}
        {selectedDocument && (
          <Dialog open={!!selectedDocument} onOpenChange={() => setSelectedDocument(null)}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Document Details: {selectedDocument.title}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium text-sm text-gray-900">Document Type</h4>
                  <p className="text-sm text-gray-700">
                    {renderDocumentType(selectedDocument)}
                  </p>
                </div>
                <div>
                  <h4 className="font-medium text-sm text-gray-900">Industry</h4>
                  <p className="text-sm text-gray-700">
                    {selectedDocument.analysis?.industry || "Unknown"}
                  </p>
                </div>
                {selectedDocument.analysis?.complianceStatus && (
                  <div>
                    <h4 className="font-medium text-sm text-gray-900">Compliance Status</h4>
                    <div className="mt-1">
                      {renderComplianceStatus(selectedDocument)}
                    </div>
                  </div>
                )}
                {selectedDocument.analysis?.details && (
                  <>
                    {selectedDocument.analysis.details.scope && (
                      <div>
                        <h4 className="font-medium text-sm text-gray-900">Scope</h4>
                        <p className="text-sm text-gray-700">{selectedDocument.analysis.details.scope}</p>
                      </div>
                    )}
                    {selectedDocument.analysis.details.findings?.length > 0 && (
                      <div>
                        <h4 className="font-medium text-sm text-gray-900">Key Findings</h4>
                        <ul className="list-disc pl-5 text-sm text-gray-700">
                          {selectedDocument.analysis.details.findings.map((finding, index) => (
                            <li key={index}>{finding}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {selectedDocument.analysis.details.recommendations?.length > 0 && (
                      <div>
                        <h4 className="font-medium text-sm text-gray-900">Recommendations</h4>
                        <ul className="list-disc pl-5 text-sm text-gray-700">
                          {selectedDocument.analysis.details.recommendations.map((rec, index) => (
                            <li key={index}>{rec}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </>
                )}
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </div>
  );
}