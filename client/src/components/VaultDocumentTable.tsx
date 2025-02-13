import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { FileText, CheckCircle, AlertTriangle, BookOpen, FileCode, FileText as FileTextIcon, ScrollText } from "lucide-react";
import type { VaultDocumentAnalysis } from "@shared/schema";
import { format } from "date-fns";

interface VaultDocumentTableProps {
  documents: VaultDocumentAnalysis[];
}

// Define type-safe mappings
const INDUSTRY_COLORS: Record<string, string> = {
  'TECHNOLOGY': "bg-blue-500",
  'HEALTHCARE': "bg-green-500",
  'FINANCIAL': "bg-purple-500",
  'MANUFACTURING': "bg-orange-500",
  'RETAIL': "bg-yellow-500"
};

const DOCUMENT_TYPE_ICONS = {
  'SOC Report': <ScrollText className="h-4 w-4 text-purple-500" />,
  'Contract Agreement': <FileText className="h-4 w-4 text-blue-500" />,
  'Policy Document': <BookOpen className="h-4 w-4 text-green-500" />,
  'Compliance Report': <FileCode className="h-4 w-4 text-orange-500" />
};

export function VaultDocumentTable({ documents }: VaultDocumentTableProps) {
  const getDocumentTypeIcon = (type: string) => {
    return DOCUMENT_TYPE_ICONS[type] || <FileTextIcon className="h-4 w-4 text-gray-500" />;
  };

  const getIndustryBadge = (industry: string) => {
    const colorClass = INDUSTRY_COLORS[industry] || "bg-gray-500";

    return (
      <Badge 
        variant="default" 
        className={`${colorClass} text-white`}
      >
        {industry}
      </Badge>
    );
  };

  const getComplianceBadge = (status: string) => {
    if (status === 'Compliant') {
      return (
        <Badge variant="default" className="bg-green-500 text-white flex items-center gap-1">
          <CheckCircle className="h-3 w-3" />
          Compliant
        </Badge>
      );
    }
    return (
      <Badge variant="destructive" className="flex items-center gap-1">
        <AlertTriangle className="h-3 w-3" />
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
            <TableHead>Upload Date</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {documents.map((doc) => (
            <TableRow key={doc.id}>
              <TableCell className="flex items-center gap-2">
                {getDocumentTypeIcon(doc.documentType)}
                {doc.fileName}
              </TableCell>
              <TableCell className="font-medium">
                {doc.documentType}
              </TableCell>
              <TableCell>
                {getIndustryBadge(doc.industry)}
              </TableCell>
              <TableCell>
                {getComplianceBadge(doc.complianceStatus)}
              </TableCell>
              <TableCell>
                {format(new Date(doc.fileDate), 'MMM d, yyyy')}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}