import { useState } from "react";
import { useDropzone } from "react-dropzone";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Upload, FileText, Folder, AlertCircle, CheckCircle, XCircle } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

// Define allowed roles that can upload documents
const UPLOAD_ALLOWED_ROLES = ["ADMIN", "LAWYER"];

export default function VaultPage() {
  const [selectedDocument, setSelectedDocument] = useState(null);
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // File upload handler using react-dropzone
  const onDrop = acceptedFiles => {
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

  // Fetch documents
  const { data: documentsData, isLoading: isLoadingDocuments } = useQuery({
    queryKey: ['/api/vault/documents'],
    queryFn: async () => {
      try {
        console.log('Fetching documents...');
        const response = await apiRequest('GET', '/api/vault/documents');
        const data = await response.json();

        // Deduplicate documents based on content hash or filename
        const uniqueDocs = Array.from(
          new Map(
            data.documents.map(doc => [
              doc.content ? doc.content.slice(0, 100) : doc.title, // Use content prefix or title as key
              doc
            ])
          ).values()
        );

        console.log('Fetched unique documents:', uniqueDocs.length);
        return uniqueDocs;
      } catch (error) {
        console.error('Error fetching documents:', error);
        throw error;
      }
    }
  });

  // Upload mutation
  const uploadMutation = useMutation({
    mutationFn: async (formData) => {
      const response = await apiRequest('POST', '/api/vault/upload', formData);
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: 'Success',
        description: 'Document uploaded and analyzed successfully',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/vault/documents'] });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to upload document',
        variant: 'destructive',
      });
    }
  });

  const canUpload = user && UPLOAD_ALLOWED_ROLES.includes(user.role);

  const getComplianceStatusBadge = (doc) => {
    const status = doc.analysis?.complianceStatus?.status || 'NOT_APPLICABLE';
    switch (status) {
      case 'PASSED':
        return (
          <Badge variant="success" className="flex items-center gap-1">
            <CheckCircle className="h-4 w-4" />
            Passed
          </Badge>
        );
      case 'FAILED':
        return (
          <Badge variant="destructive" className="flex items-center gap-1">
            <XCircle className="h-4 w-4" />
            Failed
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary" className="flex items-center gap-1">
            <AlertCircle className="h-4 w-4" />
            N/A
          </Badge>
        );
    }
  };

  return (
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
                        {doc.analysis?.documentType || "Unknown"}
                      </TableCell>
                      <TableCell>
                        {doc.analysis?.industry || "Unknown"}
                      </TableCell>
                      <TableCell>
                        {getComplianceStatusBadge(doc)}
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
                  {selectedDocument.analysis?.documentType || "Unknown"}
                </p>
              </div>
              <div>
                <h4 className="font-medium text-sm text-gray-900">Industry</h4>
                <p className="text-sm text-gray-700">
                  {selectedDocument.analysis?.industry || "Unknown"}
                </p>
              </div>
              <div>
                <h4 className="font-medium text-sm text-gray-900">Compliance Status</h4>
                <div className="mt-1">
                  {getComplianceStatusBadge(selectedDocument)}
                  {selectedDocument.analysis?.complianceStatus?.details && (
                    <p className="text-sm text-gray-600 mt-2">
                      {selectedDocument.analysis.complianceStatus.details}
                    </p>
                  )}
                </div>
              </div>
              {selectedDocument.analysis?.keywords && (
                <div>
                  <h4 className="font-medium text-sm text-gray-900">Keywords</h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedDocument.analysis.keywords.map((keyword, index) => (
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
              {selectedDocument.analysis?.recommendations && (
                <div>
                  <h4 className="font-medium text-sm text-gray-900">Recommendations</h4>
                  <ul className="list-disc pl-4 text-sm text-gray-700">
                    {selectedDocument.analysis.recommendations.map((rec, index) => (
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
  );
}