import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileText, AlertTriangle, CheckCircle, Clock } from "lucide-react";
import { format } from "date-fns";

interface VaultDocument {
  id: number;
  title: string;
  documentType: string;
  industry: string;
  complianceStatus: string;
  createdAt: string;
}

interface VaultDocumentTableProps {
  documents: VaultDocument[];
}

export function VaultDocumentTable({ documents }: VaultDocumentTableProps) {
  const getComplianceIcon = (status: string) => {
    switch (status?.toUpperCase()) {
      case 'PASSED':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'FAILED':
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
      case 'PENDING':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      default:
        return <AlertTriangle className="h-4 w-4 text-gray-500" />;
    }
  };

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>File</TableHead>
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
                <span>{doc.title}</span>
              </TableCell>
              <TableCell>{doc.documentType || "Unknown"}</TableCell>
              <TableCell>{doc.industry || "Unknown"}</TableCell>
              <TableCell className="flex items-center gap-2">
                {getComplianceIcon(doc.complianceStatus)}
                <span>{doc.complianceStatus || "Unknown"}</span>
              </TableCell>
              <TableCell>{format(new Date(doc.createdAt), 'MMM d, yyyy')}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
