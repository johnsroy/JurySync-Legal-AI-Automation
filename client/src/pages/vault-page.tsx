import { useState, useEffect, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Upload, FileText, Folder, AlertCircle, Trash2, RefreshCw, CheckCircle2, XCircle, Eye } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import Layout from "@/components/Layout";
import { documentStore, type VaultDocument } from '../lib/documentStore';

// Define allowed roles that can upload documents
const UPLOAD_ALLOWED_ROLES = ["ADMIN", "LAWYER"];

// Document type categorization
const documentTypes = {
  contract: ['agreement', 'contract', 'lease', 'license'],
  legal: ['brief', 'motion', 'petition', 'complaint', 'affidavit'],
  corporate: ['bylaws', 'resolution', 'minutes', 'incorporation'],
  regulatory: ['compliance', 'regulation', 'policy', 'guideline'],
  financial: ['invoice', 'statement', 'report', 'audit']
};

// Industry categorization
const industries = {
  technology: ['software', 'it', 'tech', 'digital', 'cyber', 'data'],
  healthcare: ['medical', 'health', 'hospital', 'pharma', 'clinical'],
  finance: ['banking', 'financial', 'investment', 'insurance'],
  realestate: ['property', 'real estate', 'lease', 'tenant'],
  manufacturing: ['production', 'industrial', 'manufacturing', 'factory']
};

export default function VaultPage() {
  const [documents, setDocuments] = useState<VaultDocument[]>([]);
  const [selectedDocument, setSelectedDocument] = useState<VaultDocument | null>(null);
  const [isContentModalVisible, setIsContentModalVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Helper function to categorize document type
  const categorizeDocumentType = async (content: string): Promise<string> => {
    const contentLower = content.toLowerCase();
    
    for (const [category, keywords] of Object.entries(documentTypes)) {
      if (keywords.some(keyword => contentLower.includes(keyword))) {
        return category.charAt(0).toUpperCase() + category.slice(1);
      }
    }
    
    // Use AI to analyze content and determine document type
    try {
      const aiResult = await analyzeDocumentType(content);
      return aiResult;
    } catch (error) {
      console.error('Document type analysis failed:', error);
      return "Miscellaneous";
    }
  };

  // Helper function to categorize industry
  const categorizeIndustry = async (content: string): Promise<string> => {
    const contentLower = content.toLowerCase();
    
    for (const [category, keywords] of Object.entries(industries)) {
      if (keywords.some(keyword => contentLower.includes(keyword))) {
        return category.charAt(0).toUpperCase() + category.slice(1);
      }
    }
    
    // Use AI to analyze content and determine industry
    try {
      const aiResult = await analyzeIndustry(content);
      return aiResult;
    } catch (error) {
      console.error('Industry analysis failed:', error);
      return "General";
    }
  };

  // AI-powered document analysis
  const analyzeDocumentType = async (content: string): Promise<string> => {
    try {
      const response = await fetch('/api/analyze/document-type', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content })
      });
      
      if (!response.ok) throw new Error('Analysis failed');
      const data = await response.json();
      return data.documentType;
    } catch (error) {
      console.error('Document type analysis failed:', error);
      return "Unknown";
    }
  };

  const analyzeIndustry = async (content: string): Promise<string> => {
    try {
      const response = await fetch('/api/analyze/industry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content })
      });
      
      if (!response.ok) throw new Error('Analysis failed');
      const data = await response.json();
      return data.industry;
    } catch (error) {
      console.error('Industry analysis failed:', error);
      return "Unknown";
    }
  };

  // Analyze compliance status
  const analyzeCompliance = async (content: string): Promise<string> => {
    try {
      const response = await fetch('/api/analyze/compliance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content })
      });
      
      if (!response.ok) throw new Error('Analysis failed');
      const data = await response.json();
      return data.status;
    } catch (error) {
      console.error('Compliance analysis failed:', error);
      return "Pending Review";
    }
  };

  const loadDocuments = useCallback(async () => {
    try {
      setIsLoading(true);
      console.log('Loading documents...');
      const docs = documentStore.getDocuments();
      console.log('Loaded documents:', docs);
      setDocuments(docs);
    } catch (error) {
      console.error('Error loading documents:', error);
      toast({
        title: 'Error',
        description: 'Failed to load documents',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadDocuments();
    
    // Listen for storage changes
    const handleStorageChange = (e: StorageEvent) => {
      console.log('Storage event:', e);
      if (e.key === 'vaultDocuments') {
        console.log('Vault documents changed, reloading...');
        loadDocuments();
      }
    };
    
    // Also listen for custom events
    const handleCustomEvent = () => {
      console.log('Custom event received, reloading documents...');
      loadDocuments();
    };
    
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('vaultUpdated', handleCustomEvent);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('vaultUpdated', handleCustomEvent);
    };
  }, [loadDocuments]);

  const handleDelete = async (id: string) => {
    try {
      documentStore.deleteDocument(id);
      loadDocuments();
      toast({
        title: 'Success',
        description: 'Document deleted successfully',
      });
    } catch (error) {
      console.error('Error deleting document:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete document',
        variant: 'destructive',
      });
    }
  };

  const handleRefresh = () => {
    loadDocuments();
    toast({
      title: 'Success',
      description: 'Document list refreshed',
    });
  };

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

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (documentId: string) => {
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
  const renderDocumentType = (doc: VaultDocument) => {
    return (
      <div className="flex items-center gap-2">
        <FileText className="h-4 w-4 text-blue-600" />
        <span>{doc.documentType || "Unknown"}</span>
      </div>
    );
  };

  // Function to render compliance status
  const renderComplianceStatus = (doc: VaultDocument) => {
    const status = doc.complianceStatus.toLowerCase();
    let color = 'text-yellow-600';
    let Icon = AlertCircle;

    if (status.includes('compliant')) {
      color = 'text-green-600';
      Icon = CheckCircle2;
    } else if (status.includes('non-compliant')) {
      color = 'text-red-600';
      Icon = XCircle;
    }

    return (
      <div className={`flex items-center gap-2 ${color}`}>
        <Icon className="h-4 w-4" />
        <span>{doc.complianceStatus}</span>
      </div>
    );
  };

  // Add loading state handling
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
      </div>
    );
  }

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
            >
              <RefreshCw className="h-4 w-4" />
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
                  {documents.length === 0 ? (
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
                    documents.map((doc: VaultDocument) => (
                      <TableRow key={doc.id}>
                        <TableCell>
                          <div className="flex items-center space-x-3">
                            <FileText className="h-5 w-5 text-blue-600 flex-shrink-0" />
                            <div>
                              <p className="font-medium text-sm">{doc.fileName}</p>
                              <p className="text-xs text-gray-500">
                                {new Date(doc.timestamp).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-blue-600" />
                            <span>{doc.documentType}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-purple-600">
                            {doc.industry}
                          </span>
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
                              <Eye className="h-4 w-4 mr-2" />
                              View
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                              onClick={() => {
                                if (window.confirm('Are you sure you want to delete this document?')) {
                                  handleDelete(doc.id);
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
                <DialogTitle>Document Details: {selectedDocument.fileName}</DialogTitle>
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
                    {selectedDocument.industry || "Unknown"}
                  </p>
                </div>
                {selectedDocument.complianceStatus && (
                  <div>
                    <h4 className="font-medium text-sm text-gray-900">Compliance Status</h4>
                    <div className="mt-1">
                      {renderComplianceStatus(selectedDocument)}
                    </div>
                  </div>
                )}
                {selectedDocument?.metadata?.research && (
                  <div>
                    <h4 className="font-medium text-sm text-gray-900 mt-4">Legal Research</h4>
                    <div className="mt-2 space-y-3">
                      {selectedDocument.metadata.research.relevantCases?.map((caseItem, index) => (
                        <div key={index} className="p-3 bg-gray-50 rounded-lg">
                          <a 
                            href={caseItem.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-800 font-medium text-sm"
                          >
                            {caseItem.title}
                          </a>
                          <p className="text-xs text-gray-600 mt-1">{caseItem.summary}</p>
                        </div>
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