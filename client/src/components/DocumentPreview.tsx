import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Eye } from "lucide-react";
import { useState } from "react";

interface DocumentPreviewProps {
  content: string;
  title: string;
  onDownload: () => void;
}

export function DocumentPreview({ content, title, onDownload }: DocumentPreviewProps) {
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
        
        {isExpanded && (
          <div className="mt-4 p-4 bg-gray-50 rounded-lg max-h-96 overflow-y-auto">
            <div className="prose max-w-none" dangerouslySetInnerHTML={{ __html: content }} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
