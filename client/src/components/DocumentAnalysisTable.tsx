import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

interface DocumentAnalysis {
  fileName: string;
  documentType: string;
  industry: string;
  complianceStatus: string;
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
  );
}
