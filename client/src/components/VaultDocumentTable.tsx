import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileText, CheckCircle, AlertTriangle, HelpCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface VaultDocument {
  id: number;
  fileName: string;
  documentType: string;
  industry: string;
  complianceStatus: string;
  fileDate: string;
}

interface VaultDocumentTableProps {
  documents: VaultDocument[];
}

export function VaultDocumentTable({ documents }: VaultDocumentTableProps) {
  const getComplianceBadge = (status: string) => {
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
            <HelpCircle className="h-3 w-3" />
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
              <TableCell>Audit</TableCell>
              <TableCell>Technology</TableCell>
              <TableCell>
                {getComplianceBadge(doc.complianceStatus)}
              </TableCell>
              <TableCell>{doc.fileDate}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}