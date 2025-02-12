import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { FileUpload } from "@/components/FileUpload";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

export default function VaultPage() {
  const { toast } = useToast();

  // Query vault statistics
  const { data: stats, isLoading: isLoadingStats } = useQuery({
    queryKey: ['/api/vault/stats'],
  });

  // Query for vault documents
  const { data: documents, isLoading: isLoadingDocs } = useQuery({
    queryKey: ['/api/vault/documents'],
  });

  const handleUploadSuccess = () => {
    toast({
      title: "Upload Successful",
      description: "Document has been uploaded and processed successfully.",
    });
  };

  const handleUploadError = (error: Error) => {
    toast({
      title: "Upload Failed",
      description: error.message,
      variant: "destructive",
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Document Vault</h1>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {stats && (
          <>
            <Card className="p-4">
              <h3 className="font-semibold mb-2">Accuracy</h3>
              <p className="text-2xl font-bold">{stats.accuracy}</p>
            </Card>
            <Card className="p-4">
              <h3 className="font-semibold mb-2">Total Documents</h3>
              <p className="text-2xl font-bold">{stats.documents}</p>
            </Card>
            <Card className="p-4">
              <h3 className="font-semibold mb-2">Field Extractions</h3>
              <p className="text-2xl font-bold">{stats.fieldExtractions}</p>
            </Card>
          </>
        )}
      </div>

      <div className="bg-card rounded-lg p-4">
        <h2 className="text-xl font-semibold mb-4">Upload Document</h2>
        <FileUpload
          endpoint="/api/vault/upload"
          onSuccess={handleUploadSuccess}
          onError={handleUploadError}
        />
      </div>

      <div className="bg-card rounded-lg p-4">
        <h2 className="text-xl font-semibold mb-4">Recent Documents</h2>
        {isLoadingDocs ? (
          <div className="flex justify-center p-4">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Risk Level</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {documents?.map((doc: any) => (
                <TableRow key={doc.id}>
                  <TableCell>{doc.title}</TableCell>
                  <TableCell>{doc.documentType}</TableCell>
                  <TableCell>{doc.metadata?.riskLevel || 'N/A'}</TableCell>
                  <TableCell>
                    <Button variant="outline" size="sm">
                      View Details
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
