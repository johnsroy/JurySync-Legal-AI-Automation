import { useState, useEffect } from "react";
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

export default function VaultPage() {
  const [filesData, setFilesData] = useState([]);
  const [sharingPolicy, setSharingPolicy] = useState('workspace');
  const [stats, setStats] = useState({ accuracy: '', documents: '', fieldExtractions: '' });
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

  // Fetch documents from both vault and workflow
  const { data: documentsData, isLoading: isLoadingDocuments } = useQuery({
    queryKey: ['/api/vault/documents'],
    queryFn: async () => {
      const [vaultResponse, workflowResponse] = await Promise.all([
        apiRequest('GET', '/api/vault/documents'),
        apiRequest('GET', '/api/workflow/documents')
      ]);

      const vaultDocs = await vaultResponse.json();
      const workflowDocs = await workflowResponse.json();

      // Combine and deduplicate documents by ID
      const allDocs = [...vaultDocs.documents, ...workflowDocs.documents];
      const uniqueDocs = Array.from(new Map(allDocs.map(doc => [doc.id, doc])).values());

      return uniqueDocs;
    }
  });

  // Upload mutation
  const uploadMutation = useMutation({
    mutationFn: async (formData) => {
      const response = await apiRequest('POST', '/api/vault/documents', formData);
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: 'Success',
        description: 'Document uploaded successfully',
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

  // Analysis functions
  const performAnalysis = async (analysisType) => {
    try {
      const response = await apiRequest('POST', '/api/vault/analyze', { analysisType });
      const data = await response.json();
      toast({
        title: 'Analysis Complete',
        description: `Analysis Result: ${data.summary}`,
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to perform analysis',
        variant: 'destructive',
      });
    }
  };

  // Update sharing policy
  const updateSharing = (e) => {
    const newPolicy = e.target.value;
    setSharingPolicy(newPolicy);
    apiRequest('POST', '/api/vault/update-sharing', { policy: newPolicy })
      .catch(err => {
        toast({
          title: 'Error',
          description: 'Failed to update sharing policy',
          variant: 'destructive',
        });
      });
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

        {/* Analysis Actions */}
        <div className="flex gap-4 mb-8">
          <Button onClick={() => performAnalysis('Reps & Warranties')}>
            Reps & Warranties
          </Button>
          <Button onClick={() => performAnalysis('M&A Deal Points')}>
            M&A Deal Points
          </Button>
          <Button onClick={() => performAnalysis('Compliance Analysis')}>
            Compliance Analysis
          </Button>
        </div>

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

        {/* Stats Section */}
        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-gray-900">{stats.accuracy || "97%"}</h2>
            <p className="text-gray-600">Accuracy on key term extraction</p>
          </div>
          <div className="text-center">
            <h2 className="text-3xl font-bold text-gray-900">{stats.documents || "10K+"}</h2>
            <p className="text-gray-600">Documents stored per vault</p>
          </div>
          <div className="text-center">
            <h2 className="text-3xl font-bold text-gray-900">{stats.fieldExtractions || "50K+"}</h2>
            <p className="text-gray-600">Field extractions per document</p>
          </div>
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