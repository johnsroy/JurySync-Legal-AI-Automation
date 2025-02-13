import { useState, useEffect } from "react";
import { useDropzone } from "react-dropzone";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Upload, FileText, Folder, AlertCircle, Trash2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";

// Define allowed roles that can upload documents
const UPLOAD_ALLOWED_ROLES = ["ADMIN", "LAWYER"];

interface Document {
  id: number;
  title: string;
  documentType?: string;
  industry?: string;
  createdAt: string;
  analysis?: {
    documentType?: string;
    industry?: string;
    complianceStatus?: {
      status: 'PASSED' | 'FAILED' | 'PENDING';
      details: string;
      lastChecked: string;
    };
  };
  metadata?: {
    documentType?: string;
    industry?: string;
    complianceStatus?: {
      status: 'PASSED' | 'FAILED' | 'PENDING';
      details: string;
      lastChecked: string;
    };
  };
}

export default function VaultPage() {
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // File upload handler using react-dropzone
  const onDrop = (acceptedFiles: File[]) => {
    acceptedFiles.forEach(file => {
      const formData = new FormData();
      formData.append('file', file);
      uploadMutation.mutate(formData);
    });
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

  // Fetch documents from both vault and workflow
  const { data: documentsData, isLoading: isLoadingDocuments } = useQuery({
    queryKey: ['/api/vault/documents'],
    queryFn: async () => {
      try {
        console.log('Fetching documents...');
        const response = await apiRequest('GET', '/api/vault/documents');
        const data = await response.json();
        console.log('Fetched documents:', data);
        return data.documents;
      } catch (error) {
        console.error('Error fetching documents:', error);
        throw error;
      }
    }
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (documentId: number) => {
      try {
        // Try both endpoints since documents can be in either collection
        const endpoints = [
          `/api/workflow/documents/${documentId}`,
          `/api/vault/documents/${documentId}`
        ];

        for (const endpoint of endpoints) {
          try {
            const response = await apiRequest('DELETE', endpoint);
            if (response.ok) {
              return response.json();
            }
          } catch (err) {
            console.log(`Attempt to delete from ${endpoint} failed:`, err);
          }
        }
        throw new Error('Document not found in any collection');
      } catch (error: any) {
        console.error('Delete operation failed:', error);
        throw error;
      }
    },
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'Document deleted successfully',
      });
      // Refresh the documents list
      queryClient.invalidateQueries({ queryKey: ['/api/vault/documents'] });
    },
    onError: (error: any) => {
      console.error('Delete mutation error:', error);
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
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: 'Success',
        description: 'Document uploaded successfully',
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

  // Function to render compliance status
  const renderComplianceStatus = (doc: Document) => {
    const status = doc.analysis?.complianceStatus?.status || doc.metadata?.complianceStatus?.status;
    if (!status) return null;

    const statusColors = {
      PASSED: 'text-green-600 bg-green-50',
      FAILED: 'text-red-600 bg-red-50',
      PENDING: 'text-yellow-600 bg-yellow-50'
    };

    const statusColor = statusColors[status] || 'text-gray-600 bg-gray-50';

    return (
      <span className={`px-2 py-1 rounded-full text-xs ${statusColor}`}>
        {status.charAt(0) + status.slice(1).toLowerCase()}
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
                  {isLoadingDocuments ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-4">
                        <span className="animate-spin mr-2">⌛</span> Loading documents...
                      </TableCell>
                    </TableRow>
                  ) : !documentsData?.length ? (
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
                    documentsData.map((doc: Document) => (
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
                          {doc.analysis?.documentType || doc.metadata?.documentType || "Unknown"}
                        </TableCell>
                        <TableCell>
                          {doc.analysis?.industry || doc.metadata?.industry || "Unknown"}
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
                    {selectedDocument.analysis?.documentType || selectedDocument.metadata?.documentType || "Unknown"}
                  </p>
                </div>
                <div>
                  <h4 className="font-medium text-sm text-gray-900">Industry</h4>
                  <p className="text-sm text-gray-700">
                    {selectedDocument.analysis?.industry || selectedDocument.metadata?.industry || "Unknown"}
                  </p>
                </div>
                {selectedDocument.analysis?.complianceStatus && (
                  <div>
                    <h4 className="font-medium text-sm text-gray-900">Compliance Status</h4>
                    <div className="mt-1">
                      {renderComplianceStatus(selectedDocument)}
                      <p className="text-sm text-gray-600 mt-2">
                        {selectedDocument.analysis.complianceStatus.details}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        Last checked: {new Date(selectedDocument.analysis.complianceStatus.lastChecked).toLocaleString()}
                      </p>
                    </div>
                  </div>
                )}
                {(selectedDocument.analysis?.keywords || selectedDocument.metadata?.keywords) && (
                  <div>
                    <h4 className="font-medium text-sm text-gray-900">Keywords</h4>
                    <div className="flex flex-wrap gap-2">
                      {(selectedDocument.analysis?.keywords || selectedDocument.metadata?.keywords).map((keyword: string, index: number) => (
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
                {(selectedDocument.analysis?.recommendations || selectedDocument.metadata?.recommendations) && (
                  <div>
                    <h4 className="font-medium text-sm text-gray-900">Recommendations</h4>
                    <ul className="list-disc pl-4 text-sm text-gray-700">
                      {(selectedDocument.analysis?.recommendations || selectedDocument.metadata?.recommendations).map((rec: string, index: number) => (
                        <li key={index}>{rec}</li>
                      ))}
                    </ul>
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