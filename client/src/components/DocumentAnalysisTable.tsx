import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";

interface DocumentAnalysis {
  fileName: string;
  documentType: string;
  industry: string;
  complianceStatus: string;
  draftSuggestions?: string[];
  complianceFindings?: string[];
  relatedDocuments?: Array<{
    title: string;
    url: string;
    relevanceScore: number;
    summary: string;
  }>;
  recommendations?: string[];
}

interface DocumentAnalysisTableProps {
  analysis: DocumentAnalysis | null;
  isLoading?: boolean;
}

export function DocumentAnalysisTable({ analysis, isLoading }: DocumentAnalysisTableProps) {
  if (isLoading) {
    return <div className="text-center py-4">Analyzing document...</div>;
  }

  if (!analysis) {
    return <div className="text-center py-4">No analysis available</div>;
  }

  return (
    <div className="space-y-6">
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>File</TableHead>
              <TableHead>Document Type</TableHead>
              <TableHead>Industry</TableHead>
              <TableHead>Compliance Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell>{analysis.fileName}</TableCell>
              <TableCell>
                <Badge variant="outline">{analysis.documentType}</Badge>
              </TableCell>
              <TableCell>
                <Badge 
                  variant="default" 
                  className={
                    analysis.industry === 'TECHNOLOGY' ? 'bg-blue-500' :
                    analysis.industry === 'HEALTHCARE' ? 'bg-green-500' :
                    analysis.industry === 'FINANCIAL' ? 'bg-purple-500' :
                    analysis.industry === 'MANUFACTURING' ? 'bg-orange-500' :
                    analysis.industry === 'RETAIL' ? 'bg-yellow-500' :
                    'bg-gray-500'
                  }
                >
                  {analysis.industry}
                </Badge>
              </TableCell>
              <TableCell>
                <Badge 
                  variant={analysis.complianceStatus === 'Compliant' ? 'default' : 'destructive'}
                  className={analysis.complianceStatus === 'Compliant' ? 'bg-green-500' : ''}
                >
                  {analysis.complianceStatus}
                </Badge>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>

      {/* AI Analysis Results */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Draft Suggestions */}
        {analysis.draftSuggestions && analysis.draftSuggestions.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Draft Suggestions</CardTitle>
              <CardDescription>AI-generated improvements for your document</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="list-disc list-inside space-y-2">
                {analysis.draftSuggestions.map((suggestion, index) => (
                  <li key={index} className="text-sm text-gray-600">{suggestion}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {/* Compliance Findings */}
        {analysis.complianceFindings && analysis.complianceFindings.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Compliance Analysis</CardTitle>
              <CardDescription>Key compliance findings and requirements</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="list-disc list-inside space-y-2">
                {analysis.complianceFindings.map((finding, index) => (
                  <li key={index} className="text-sm text-gray-600">{finding}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Related Legal Documents */}
      {analysis.relatedDocuments && analysis.relatedDocuments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Related Legal Documents</CardTitle>
            <CardDescription>Similar documents and legal precedents</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {analysis.relatedDocuments.map((doc, index) => (
                <div key={index} className="flex items-start justify-between border-b pb-4">
                  <div className="space-y-1">
                    <h4 className="font-medium">{doc.title}</h4>
                    <p className="text-sm text-gray-600">{doc.summary}</p>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">
                        Relevance: {Math.round(doc.relevanceScore * 100)}%
                      </Badge>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="flex items-center gap-2"
                    onClick={() => window.open(doc.url, '_blank')}
                  >
                    View <ExternalLink className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recommendations */}
      {analysis.recommendations && analysis.recommendations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>AI Recommendations</CardTitle>
            <CardDescription>Suggested actions and improvements</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="list-disc list-inside space-y-2">
              {analysis.recommendations.map((recommendation, index) => (
                <li key={index} className="text-sm text-gray-600">{recommendation}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}