import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, BarChart3 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

function ReportsDashboard() {
  const { toast } = useToast();
  const [selectedSection, setSelectedSection] = useState<"analytics" | "documents" | null>(null);

  const { data: recentDocuments, isLoading: isLoadingDocuments } = useQuery({
    queryKey: ['/api/documents/recent'],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/documents/recent");
      return response.json();
    },
  });

  const { data: analytics, isLoading: isLoadingAnalytics } = useQuery({
    queryKey: ['/api/analytics'],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/analytics");
      return response.json();
    },
  });

  const handleSectionClick = (section: "analytics" | "documents") => {
    setSelectedSection(section);
    toast({
      title: `Opening ${section === "analytics" ? "Analytics Overview" : "Recent Documents"}`,
      description: "Loading your data...",
    });
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">History & Reports</h1>
        <Button variant="outline">
          <FileText className="w-4 h-4 mr-2" />
          Export All
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Analytics Overview Card */}
        <Card 
          className="cursor-pointer hover:bg-muted/50 transition-colors"
          onClick={() => handleSectionClick("analytics")}
        >
          <CardHeader>
            <div className="flex items-center space-x-2">
              <BarChart3 className="h-5 w-5" />
              <CardTitle>Analytics Overview</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <CardDescription>
              View detailed analytics and trends from your compliance audits and legal research.
            </CardDescription>
          </CardContent>
        </Card>

        {/* Recent Documents Card */}
        <Card 
          className="cursor-pointer hover:bg-muted/50 transition-colors"
          onClick={() => handleSectionClick("documents")}
        >
          <CardHeader>
            <div className="flex items-center space-x-2">
              <FileText className="h-5 w-5" />
              <CardTitle>Recent Documents</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <CardDescription>
              Access your recently analyzed documents and generated reports.
            </CardDescription>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default ReportsDashboard;