import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Eye, FileText, BookOpen, Shield } from "lucide-react";
import { useState } from "react";

interface DocumentPreviewProps {
  content: string;
  title: string;
  metadata?: {
    documentType: string;
    industry: string;
    complianceStatus: string;
  };
  onDownload: () => void;
  children?: React.ReactNode;
}

export function DocumentPreview({ content, title, metadata, onDownload, children }: DocumentPreviewProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <Card className="w-full bg-white shadow-sm">
      <CardContent className="p-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">{title}</h3>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              <Eye className="h-4 w-4 mr-2" />
              {isExpanded ? "Collapse" : "Preview"}
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={onDownload}
            >
              <Download className="h-4 w-4 mr-2" />
              Download PDF
            </Button>
          </div>
        </div>

        {metadata && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div className="flex items-start space-x-2 p-3 bg-gray-50 rounded-lg">
              <FileText className="h-5 w-5 text-blue-500 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-gray-600">Document Type</p>
                <p className="text-sm">{metadata.documentType || "SOC 3 Report"}</p>
              </div>
            </div>
            <div className="flex items-start space-x-2 p-3 bg-gray-50 rounded-lg">
              <BookOpen className="h-5 w-5 text-green-500 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-gray-600">Industry</p>
                <p className="text-sm">{metadata.industry || "Technology"}</p>
              </div>
            </div>
            <div className="flex items-start space-x-2 p-3 bg-gray-50 rounded-lg">
              <Shield className="h-5 w-5 text-yellow-500 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-gray-600">Compliance Status</p>
                <p className="text-sm">{metadata.complianceStatus || "COMPLIANT"}</p>
              </div>
            </div>
          </div>
        )}

        {isExpanded && (
          <div className="mt-4 p-4 bg-gray-50 rounded-lg max-h-96 overflow-y-auto">
            <div className="prose max-w-none" dangerouslySetInnerHTML={{ __html: content }} />
          </div>
        )}

        {children}
      </CardContent>
    </Card>
  );
}