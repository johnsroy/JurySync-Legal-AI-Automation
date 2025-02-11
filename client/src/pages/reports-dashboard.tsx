import { useState } from "react";
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
import { FileText, BarChart3, Download } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

function ReportsDashboard() {
  const { toast } = useToast();
  const [, navigate] = useLocation();

  // Fetch data for export functionality
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

  const handleExport = async () => {
    try {
      toast({
        title: "Starting export...",
        description: "Preparing your documents and analytics data",
      });

      const response = await apiRequest("POST", "/api/reports/export");
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `legal-analytics-report-${new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "Export complete",
        description: "Your report has been downloaded successfully",
      });
    } catch (error) {
      toast({
        title: "Export failed",
        description: "There was an error exporting your data. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">History & Reports</h1>
        <Button onClick={handleExport} variant="outline">
          <Download className="w-4 h-4 mr-2" />
          Export All
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Analytics Overview Card */}
        <Card 
          className="cursor-pointer hover:bg-muted/50 transition-colors group"
          onClick={() => navigate("/reports/analytics")}
        >
          <CardHeader>
            <div className="flex items-center space-x-2">
              <BarChart3 className="h-5 w-5 group-hover:text-primary transition-colors" />
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
          className="cursor-pointer hover:bg-muted/50 transition-colors group"
          onClick={() => navigate("/reports/documents")}
        >
          <CardHeader>
            <div className="flex items-center space-x-2">
              <FileText className="h-5 w-5 group-hover:text-primary transition-colors" />
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