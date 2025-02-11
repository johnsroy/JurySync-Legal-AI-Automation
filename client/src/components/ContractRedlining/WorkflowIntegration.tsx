import { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileSignature, ClipboardCheck, Clock, CheckCircle2, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Version {
  id: number;
  timestamp: string;
  status: "draft" | "review" | "approved" | "rejected";
  author: string;
  changes: string;
}

interface WorkflowIntegrationProps {
  contractId: number;
  currentVersion: number;
}

export function WorkflowIntegration({ contractId, currentVersion }: WorkflowIntegrationProps) {
  const { toast } = useToast();
  const [versions] = useState<Version[]>([
    {
      id: 1,
      timestamp: new Date().toISOString(),
      status: "draft",
      author: "John Doe",
      changes: "Initial draft created"
    },
    {
      id: 2,
      timestamp: new Date().toISOString(),
      status: "review",
      author: "Jane Smith",
      changes: "Updated payment terms"
    }
  ]);

  const handleSignature = async () => {
    try {
      const response = await fetch(`/api/documents/${contractId}/signature`, {
        method: 'POST'
      });
      
      if (!response.ok) {
        throw new Error('Failed to initiate e-signature process');
      }

      toast({
        title: "Success",
        description: "E-signature process initiated",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to start e-signature process",
        variant: "destructive",
      });
    }
  };

  const handleInternalReview = async () => {
    try {
      const response = await fetch(`/api/documents/${contractId}/review`, {
        method: 'POST'
      });
      
      if (!response.ok) {
        throw new Error('Failed to initiate internal review');
      }

      toast({
        title: "Success",
        description: "Internal review process initiated",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to start internal review",
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
            >
              <ClipboardCheck className="h-4 w-4" />
              Internal Review
            </Button>
            <Button 
              onClick={handleSignature}
              className="gap-2"
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
                style={{ width: `${(currentVersion / 10) * 100}%` }}
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
                        <p className="text-sm font-medium">Version {version.id}</p>
                        <time className="text-xs text-gray-500">
                          {new Date(version.timestamp).toLocaleDateString()}
                        </time>
                      </div>
                      <p className="text-sm text-gray-600">{version.changes}</p>
                      <p className="text-xs text-gray-500">By {version.author}</p>
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
