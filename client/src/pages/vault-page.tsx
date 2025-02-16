import { useState, useEffect } from "react";
import { useDropzone } from "react-dropzone";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Upload, FileText, Folder, AlertCircle, Trash2, RefreshCw } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import Layout from "@/components/Layout";

interface VaultDocument {
  id: string;
  fileName: string;
  documentType: string;
  industry: string;
  complianceStatus: string;
  timestamp: string;
  content: string;
  metadata?: {
    confidence: number;
    recommendations: string[];
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  };
}

// Add proper type checking for recommendations
const hasRecommendations = (doc: VaultDocument): doc is VaultDocument & {
  metadata: { recommendations: string[] }
} => {
  return Boolean(
    doc.metadata?.recommendations && 
    Array.isArray(doc.metadata.recommendations) && 
    doc.metadata.recommendations.length > 0
  );
};

export default function VaultPage() {
  const [selectedDocument, setSelectedDocument] = useState<VaultDocument | null>(null);
  const [isContentModalVisible, setIsContentModalVisible] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  // Load documents from localStorage
  const [documents, setDocuments] = useState<VaultDocument[]>([]);

  useEffect(() => {
    const loadDocuments = () => {
      try {
        const storedDocs = localStorage.getItem('documentVault');
        if (storedDocs) {
          setDocuments(JSON.parse(storedDocs));
        }
      } catch (error) {
        console.error('Error loading documents:', error);
        toast({
          title: 'Error',
          description: 'Failed to load documents',
          variant: 'destructive',
        });
      }
    };

    loadDocuments();
    // Set up event listener for storage changes
    window.addEventListener('storage', loadDocuments);
    return () => window.removeEventListener('storage', loadDocuments);
  }, [toast]);

  const handleViewDocument = (doc: VaultDocument) => {
    setSelectedDocument(doc);
    setIsContentModalVisible(true);
  };

  const handleDelete = (docId: string) => {
    try {
      const updatedDocs = documents.filter(doc => doc.id !== docId);
      localStorage.setItem('documentVault', JSON.stringify(updatedDocs));
      setDocuments(updatedDocs);
      toast({
        title: 'Success',
        description: 'Document deleted successfully',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to delete document',
        variant: 'destructive',
      });
    }
  };

  const getStatusColor = (status: string) => {
    const statusLower = status.toLowerCase();
    if (statusLower.includes('compliant') || statusLower.includes('approved')) {
      return 'text-green-600';
    }
    if (statusLower.includes('review') || statusLower.includes('pending')) {
      return 'text-yellow-600';
    }
    return 'text-red-600';
  };

  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Document Vault</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Document Repository</CardTitle>
          <CardDescription>View and manage your processed documents</CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[600px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Document Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Industry</TableHead>
                  <TableHead>Compliance Status</TableHead>
                  <TableHead>Date Added</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {documents.map((doc) => (
                  <TableRow key={doc.id}>
                    <TableCell>
                      <div className="flex items-center space-x-3">
                        <FileText className="h-5 w-5 text-green-600 flex-shrink-0" />
                        <div>
                          <p className="font-medium text-sm">{doc.fileName}</p>
                          <p className="text-xs text-gray-500">
                            {new Date(doc.timestamp).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{doc.documentType}</TableCell>
                    <TableCell>{doc.industry}</TableCell>
                    <TableCell>
                      <span className={getStatusColor(doc.complianceStatus)}>
                        {doc.complianceStatus}
                      </span>
                    </TableCell>
                    <TableCell>{new Date(doc.timestamp).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <div className="flex space-x-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleViewDocument(doc)}
                        >
                          <AlertCircle className="h-4 w-4 mr-2" />
                          View Details
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          onClick={() => handleDelete(doc.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Document Details Dialog */}
      {selectedDocument && (
        <Dialog open={isContentModalVisible} onOpenChange={setIsContentModalVisible}>
          <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle>Document Details: {selectedDocument.fileName}</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <h4 className="font-medium text-sm text-gray-900">Document Type</h4>
                <p className="text-sm text-gray-700">{selectedDocument.documentType}</p>
              </div>
              <div>
                <h4 className="font-medium text-sm text-gray-900">Industry</h4>
                <p className="text-sm text-gray-700">{selectedDocument.industry}</p>
              </div>
              <div>
                <h4 className="font-medium text-sm text-gray-900">Compliance Status</h4>
                <p className={`text-sm ${getStatusColor(selectedDocument.complianceStatus)}`}>
                  {selectedDocument.complianceStatus}
                </p>
              </div>
              {selectedDocument.metadata && (
                <>
                  <div>
                    <h4 className="font-medium text-sm text-gray-900">Confidence Score</h4>
                    <p className="text-sm text-gray-700">{selectedDocument.metadata.confidence}%</p>
                  </div>
                  <div>
                    <h4 className="font-medium text-sm text-gray-900">Risk Level</h4>
                    <p className="text-sm text-gray-700">{selectedDocument.metadata.riskLevel}</p>
                  </div>
                </>
              )}
              <div className="col-span-2">
                <h4 className="font-medium text-sm text-gray-900">Content</h4>
                <p className="text-sm text-gray-700 whitespace-pre-wrap mt-2 p-4 bg-gray-50 rounded">
                  {selectedDocument.content}
                </p>
              </div>
              {selectedDocument && hasRecommendations(selectedDocument) && (
                <div className="col-span-2">
                  <h4 className="font-medium text-sm text-gray-900">Recommendations</h4>
                  <ul className="list-disc pl-5 text-sm text-gray-700 mt-2">
                    {selectedDocument.metadata.recommendations.map((rec, index) => (
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

VaultPage.getLayout = function getLayout(page: React.ReactElement) {
  return <Layout>{page}</Layout>;
};