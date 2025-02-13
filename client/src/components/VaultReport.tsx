import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { FileText, CheckCircle, AlertTriangle } from "lucide-react";
import { format } from "date-fns";

interface VaultReportProps {
  documents: Array<{
    id: string;
    fileName: string;
    documentType: string;
    industry: string;
    complianceStatus: string;
    uploadDate: string;
  }>;
}

export function VaultReport({ documents }: VaultReportProps) {
  const getComplianceStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case 'compliant':
        return (
          <Badge variant="default" className="bg-green-500 text-white flex items-center gap-1">
            <CheckCircle className="h-3 w-3" />
            Compliant
          </Badge>
        );
      case 'non-compliant':
        return (
          <Badge variant="destructive" className="flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" />
            Non-Compliant
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="flex items-center gap-1">
            {status}
          </Badge>
        );
    }
  };

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>File Name</TableHead>
            <TableHead>Document Type</TableHead>
            <TableHead>Industry</TableHead>
            <TableHead>Compliance Status</TableHead>
            <TableHead>Upload Date</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {documents.map((doc) => (
            <TableRow key={doc.id}>
              <TableCell className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-blue-500" />
                {doc.fileName}
              </TableCell>
              <TableCell>{doc.documentType}</TableCell>
              <TableCell>{doc.industry}</TableCell>
              <TableCell>
                {getComplianceStatusBadge(doc.complianceStatus)}
              </TableCell>
              <TableCell>{format(new Date(doc.uploadDate), 'MMM d, yyyy')}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}