import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { FileText, CheckCircle, AlertTriangle } from "lucide-react";
import type { VaultDocumentAnalysis } from "@shared/schema";
import { format } from "date-fns";

interface VaultDocumentTableProps {
  documents: VaultDocumentAnalysis[];
}

export function VaultDocumentTable({ documents }: VaultDocumentTableProps) {
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
                {doc.complianceStatus === 'Compliant' ? (
                  <Badge variant="default" className="bg-green-500 text-white flex items-center gap-1">
                    <CheckCircle className="h-3 w-3" />
                    Compliant
                  </Badge>
                ) : (
                  <Badge variant="destructive" className="flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    {doc.complianceStatus}
                  </Badge>
                )}
              </TableCell>
              <TableCell>{format(new Date(doc.fileDate), 'MMM d, yyyy')}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}