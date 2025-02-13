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
    const statusMap = {
      'Compliant': { icon: CheckCircle, variant: 'success', color: 'bg-green-500' },
      'Non-Compliant': { icon: AlertTriangle, variant: 'destructive', color: 'bg-red-500' },
      'Review Required': { icon: HelpCircle, variant: 'warning', color: 'bg-yellow-500' }
    };

    const defaultStatus = { icon: HelpCircle, variant: 'secondary', color: 'bg-gray-500' };
    const { icon: Icon, color } = statusMap[status] || defaultStatus;

    return (
      <Badge variant="default" className={`${color} text-white flex items-center gap-1`}>
        <Icon className="h-3 w-3" />
        {status}
      </Badge>
    );
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
          </TableRow>
        </TableHeader>
        <TableBody>
          {documents.map((doc) => (
            <TableRow key={doc.id}>
              <TableCell className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-blue-500" />
                <div>
                  <span className="font-medium">{doc.fileName}</span>
                  <span className="text-sm text-gray-500 ml-2">{doc.fileDate}</span>
                </div>
              </TableCell>
              <TableCell>{doc.documentType}</TableCell>
              <TableCell>{doc.industry}</TableCell>
              <TableCell>
                {getComplianceBadge(doc.complianceStatus)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}