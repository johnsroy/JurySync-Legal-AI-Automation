import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface LegalResearchResult {
  documentType: string;
  industry: string;
  status: string;
  findings: {
    relevantCaseLaw: {
      title: string;
      description: string;
    }[];
    regulatoryPrecedents: {
      title: string;
      description: string;
    }[];
  };
}

interface LegalResearchResultsProps {
  result: LegalResearchResult;
  onDownload?: () => void;
}

export function LegalResearchResults({ result, onDownload }: LegalResearchResultsProps) {
  return (
    <Card className="w-full">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <div>
          <CardTitle>Legal Research Report</CardTitle>
        </div>
        {onDownload && (
          <Button onClick={onDownload}>
            <Download className="mr-2 h-4 w-4" />
            Download PDF
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-8">
        {/* Status Section */}
        <div className="grid grid-cols-3 gap-4">
          <Card className="p-4">
            <div className="space-y-2">
              <p className="text-sm font-medium">Document Type</p>
              <p className="text-2xl font-bold">{result.documentType}</p>
            </div>
          </Card>
          <Card className="p-4">
            <div className="space-y-2">
              <p className="text-sm font-medium">Industry</p>
              <p className="text-2xl font-bold">{result.industry}</p>
            </div>
          </Card>
          <Card className="p-4">
            <div className="space-y-2">
              <p className="text-sm font-medium">Compliance Status</p>
              <Badge variant="outline" className="text-lg">
                {result.status}
              </Badge>
            </div>
          </Card>
        </div>

        {/* Legal Research Findings */}
        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-semibold mb-4">Legal Research Findings</h3>
            
            {/* Relevant Case Law */}
            <div className="space-y-4">
              <h4 className="font-medium text-muted-foreground">Relevant Case Law</h4>
              <div className="grid gap-4">
                {result.findings.relevantCaseLaw.map((item, index) => (
                  <Card key={index} className="p-4">
                    <div className="flex items-start space-x-4">
                      <FileText className="h-5 w-5 text-primary mt-0.5" />
                      <div>
                        <p className="font-medium">{item.title}</p>
                        <p className="text-sm text-muted-foreground">{item.description}</p>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>

            {/* Regulatory Precedents */}
            <div className="space-y-4 mt-6">
              <h4 className="font-medium text-muted-foreground">Regulatory Precedents</h4>
              <div className="grid gap-4">
                {result.findings.regulatoryPrecedents.map((item, index) => (
                  <Card key={index} className="p-4">
                    <div className="flex items-start space-x-4">
                      <FileText className="h-5 w-5 text-primary mt-0.5" />
                      <div>
                        <p className="font-medium">{item.title}</p>
                        <p className="text-sm text-muted-foreground">{item.description}</p>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
