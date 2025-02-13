import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { FileText, CheckCircle } from "lucide-react";

interface VaultDocument {
  id: number;
  fileName: string;
  fileDate: string;
}

interface VaultDocumentTableProps {
  documents: VaultDocument[];
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
              <TableCell>Audit</TableCell>
              <TableCell>Technology</TableCell>
              <TableCell>
                <Badge variant="default" className="bg-green-500 text-white flex items-center gap-1">
                  <CheckCircle className="h-3 w-3" />
                  Compliant
                </Badge>
              </TableCell>
              <TableCell>{doc.fileDate}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}