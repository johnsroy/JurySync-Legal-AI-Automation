import { BarChart2, Download, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useQuery } from "@tanstack/react-query";

// Add interfaces for your document types
interface Document {
  title: string;
  status: string;
  riskScore: number;
  lastScanned: string;
  templateUsed?: string;
  templateCategory?: string;
}

interface RecentDocument {
  title: string;
  status: string;
  riskScore: number;
  lastScanned: string;
  templateInfo: string;
}

export default function Reports() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  // Fetch documents with enhanced query
  const { data: documents, isLoading } = useQuery({
    queryKey: ['/api/compliance/documents'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/compliance/documents');
      if (!response.ok) {
        throw new Error('Failed to fetch documents');
      }
      const data = await response.json();
      return data.map((doc: any) => ({
        title: doc.title,
        status: doc.status,
        riskScore: doc.riskScore,
        lastScanned: doc.lastScanned,
        templateUsed: doc.templateUsed,
        templateCategory: doc.templateCategory
      }));
    }
  });

  const handleExportAll = async () => {
    try {
      const response = await apiRequest('GET', '/api/reports/export-all');
      if (!response.ok) throw new Error('Export failed');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `legal-reports-${new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "Export Successful",
        description: "All reports have been exported successfully.",
      });
    } catch (error) {
      console.error('Export failed:', error);
      toast({
        title: "Export Failed",
        description: "Failed to export reports. Please try again.",
        variant: "destructive"
      });
    }
  };

  const recentDocuments = documents?.slice(0, 5).map((doc: Document): RecentDocument => ({
    title: doc.title,
    status: doc.status,
    riskScore: doc.riskScore,
    lastScanned: doc.lastScanned ? new Date(doc.lastScanned).toLocaleDateString() : 'Not scanned',
    templateInfo: doc.templateUsed ? `${doc.templateCategory} - ${doc.templateUsed}` : 'Custom Document'
  })) || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">History & Reports</h1>
        <Button 
          className="flex items-center gap-2"
          onClick={handleExportAll}
        >
          <Download className="h-4 w-4" />
          Export All
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card 
          className="cursor-pointer transition-all hover:shadow-lg hover:border-primary"
          onClick={() => setLocation("/analytics")}
        >
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart2 className="h-5 w-5 text-primary" />
              Analytics Overview
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              View detailed analytics and trends from your compliance audits and document processing.
            </p>
          </CardContent>
        </Card>

        <Card 
          className="col-span-2"
        >
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              Recent Documents
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-muted-foreground text-center py-8">
                Loading documents...
              </p>
            ) : recentDocuments.length > 0 ? (
              <div className="space-y-4">
                {recentDocuments.map((doc: RecentDocument, idx: number) => (
                  <div key={idx} className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                    <div>
                      <h4 className="font-medium">{doc.title}</h4>
                      <p className="text-sm text-muted-foreground">Last scanned: {doc.lastScanned}</p>
                      <p className="text-sm text-muted-foreground">Template: {doc.templateInfo}</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className={`px-2 py-1 rounded-full text-xs ${
                        doc.status === 'COMPLIANT' ? 'bg-green-100 text-green-700' :
                        doc.status === 'NON_COMPLIANT' ? 'bg-red-100 text-red-700' :
                        'bg-yellow-100 text-yellow-700'
                      }`}>
                        {doc.status}
                      </span>
                      <span className="text-sm font-medium">
                        Risk Score: {doc.riskScore}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-8">
                No documents processed yet. Start by uploading a document for analysis.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}