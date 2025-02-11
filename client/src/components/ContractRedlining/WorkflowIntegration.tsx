import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  FileSignature, 
  ClipboardCheck, 
  Clock, 
  CheckCircle2, 
  AlertCircle,
  FileEdit 
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Version {
  id: number;
  versionNumber: number;
  status: "draft" | "review" | "approved" | "rejected";
  authorId: number;
  content: string;
  changes: {
    description: string;
    modifiedSections: Array<{
      type: "ADDITION" | "DELETION" | "MODIFICATION";
      content: string;
      lineNumber?: number;
    }>;
  };
  createdAt: string;
}

interface WorkflowIntegrationProps {
  contractId: number;
  currentVersion: number;
}

export function WorkflowIntegration({ contractId, currentVersion }: WorkflowIntegrationProps) {
  const { toast } = useToast();
  const [versions, setVersions] = useState<Version[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState<Version | null>(null);
  const [showEditor, setShowEditor] = useState(false);

  // Fetch version history
  const fetchVersionHistory = async () => {
    try {
      const response = await fetch(`/api/contract-analysis/${contractId}/versions`);
      const data = await response.json();

      if (response.ok && data.success) {
        setVersions(data.versions);
      } else {
        throw new Error(data.error || 'Failed to fetch version history');
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to fetch version history",
        variant: "destructive",
      });
    }
  };

  const handleEditVersion = async (version: Version) => {
    setSelectedVersion(version);
    setShowEditor(true);
  };

  const handleSignature = async () => {
    try {
      setIsLoading(true);
      // Initialize Documenso signing process
      const response = await fetch(`/api/contract-analysis/${contractId}/signature`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          documentId: contractId,
          versionId: selectedVersion?.id || versions[0]?.id
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to initiate e-signature process');
      }

      toast({
        title: "Success",
        description: "E-signature process initiated",
      });

      // Refresh version history after successful signature request
      await fetchVersionHistory();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to start e-signature process",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleInternalReview = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/contract-analysis/${contractId}/review`, {
        method: 'POST'
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to initiate internal review');
      }

      toast({
        title: "Success",
        description: "Internal review process initiated",
      });

      // Refresh version history after successful review initiation
      await fetchVersionHistory();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to start internal review",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = async (version: Version) => {
    try {
      const response = await fetch(`/api/contract-analysis/${contractId}/download/${version.id}`, {
        method: 'GET'
      });

      if (!response.ok) {
        throw new Error('Failed to download document');
      }

      // Create a blob from the response and trigger download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `contract_v${version.versionNumber}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to download document",
        variant: "destructive",
      });
    }
  };

  const getStatusIcon = (status: Version['status']) => {
    switch (status) {
      case 'draft':
        return <Clock className="h-4 w-4 text-blue-500" />;
      case 'review':
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      case 'approved':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'rejected':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4" />;
    }
  };

  // Fetch version history on mount and when contractId changes
  useEffect(() => {
    if (contractId) {
      fetchVersionHistory();
    }
  }, [contractId]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Workflow Status</span>
          <div className="space-x-2">
            <Button 
              variant="outline" 
              onClick={handleInternalReview}
              className="gap-2"
              disabled={isLoading}
            >
              <ClipboardCheck className="h-4 w-4" />
              Internal Review
            </Button>
            <Button 
              onClick={handleSignature}
              className="gap-2"
              disabled={isLoading || !selectedVersion}
            >
              <FileSignature className="h-4 w-4" />
              Send for e-Signature
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          <div>
            <h3 className="text-sm font-medium mb-2">Current Version: {currentVersion}</h3>
            <div className="h-2 bg-gray-100 rounded">
              <div 
                className="h-2 bg-blue-500 rounded" 
                style={{ width: `${(currentVersion / Math.max(...versions.map(v => v.versionNumber), 1)) * 100}%` }}
              />
            </div>
          </div>

          <div>
            <h3 className="text-sm font-medium mb-2">Version History</h3>
            <ScrollArea className="h-[200px] w-full rounded-md border p-4">
              <div className="space-y-4">
                {versions.map((version) => (
                  <div 
                    key={version.id}
                    className="flex items-start space-x-4 border-l-2 border-gray-200 pl-4 relative"
                  >
                    <div className="absolute -left-1.5 mt-1.5">
                      {getStatusIcon(version.status)}
                    </div>
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium">Version {version.versionNumber}</p>
                        <div className="flex items-center space-x-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditVersion(version)}
                          >
                            <FileEdit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDownload(version)}
                          >
                            Download
                          </Button>
                        </div>
                      </div>
                      <p className="text-sm text-gray-600">{version.changes.description}</p>
                      <time className="text-xs text-gray-500">
                        {new Date(version.createdAt).toLocaleDateString()}
                      </time>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}