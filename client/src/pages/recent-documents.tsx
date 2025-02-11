import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest } from "@/lib/queryClient";
import { ArrowLeft, FileText, FileSearch } from "lucide-react";
import { format } from "date-fns";

function RecentDocumentsSkeleton() {
  return (
    <div className="space-y-4">
      {Array(5).fill(0).map((_, i) => (
        <div key={i} className="flex items-center space-x-4 p-4 border rounded-lg">
          <Skeleton className="h-12 w-12 rounded-full" />
          <div className="space-y-2 flex-1">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

function DocumentCard({ document }: { document: any }) {
  const statusColors = {
    COMPLIANT: "text-green-600 bg-green-100",
    NON_COMPLIANT: "text-red-600 bg-red-100",
    FLAGGED: "text-yellow-600 bg-yellow-100"
  };

  return (
    <div className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
      <div className="flex items-center space-x-4">
        <div className="p-2 bg-primary/10 rounded-full">
          <FileText className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h4 className="font-medium">{document.title}</h4>
          <p className="text-sm text-muted-foreground">
            Last modified {format(new Date(document.lastModified), 'MMM d, yyyy')}
          </p>
        </div>
      </div>
      <div className="flex items-center space-x-4">
        <span className={`px-2 py-1 rounded-full text-sm ${statusColors[document.status]}`}>
          {document.status}
        </span>
        <Button variant="ghost" size="sm">
          <FileSearch className="h-4 w-4" />
          View
        </Button>
      </div>
    </div>
  );
}

export function RecentDocuments() {
  const [, navigate] = useLocation();

  const { data: documents, isLoading } = useQuery({
    queryKey: ['/api/documents/recent'],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/documents/recent");
      return response.json();
    },
  });

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center gap-4 mb-8">
        <Button variant="ghost" onClick={() => navigate("/reports")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Recent Documents</h1>
          <p className="text-muted-foreground">
            Access and review your recently analyzed documents
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Document History</CardTitle>
          <CardDescription>Your recently processed legal documents</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {isLoading ? (
              <RecentDocumentsSkeleton />
            ) : documents?.length > 0 ? (
              documents.map((doc: any) => (
                <DocumentCard key={doc.id} document={doc} />
              ))
            ) : (
              <p className="text-center text-muted-foreground py-8">
                No recent documents found
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default RecentDocuments;
