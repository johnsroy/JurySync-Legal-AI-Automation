import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { AlertCircle, Loader2, UserCheck, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface Approver {
  id: number;
  name: string;
  role: string;
  department: string;
  availability: 'AVAILABLE' | 'BUSY' | 'AWAY';
}

interface ApprovalFormProps {
  onApprove: (approvers: Approver[], comments: string) => Promise<void>;
  isLoading?: boolean;
  documentType?: string;
}

export function ApprovalForm({ onApprove, isLoading, documentType }: ApprovalFormProps) {
  const [selectedApprovers, setSelectedApprovers] = useState<Approver[]>([]);
  const [comments, setComments] = useState("");
  const { toast } = useToast();

  const { data: approvers = [], isLoading: isLoadingApprovers } = useQuery<Approver[]>({
    queryKey: ['/api/approvers'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/approvers');
      return response.json();
    }
  });

  const handleApproverSelect = (approverId: string) => {
    const approver = approvers.find(a => a.id === parseInt(approverId));
    if (approver && !selectedApprovers.some(a => a.id === approver.id)) {
      setSelectedApprovers(prev => [...prev, approver]);
    }
  };

  const getApproverStatusColor = (status: Approver['availability']) => {
    switch (status) {
      case 'AVAILABLE':
        return 'bg-green-500';
      case 'BUSY':
        return 'bg-yellow-500';
      case 'AWAY':
        return 'bg-gray-500';
      default:
        return 'bg-gray-500';
    }
  };

  const handleSubmit = async () => {
    if (selectedApprovers.length === 0) {
      toast({
        title: "No approvers selected",
        description: "Please select at least one approver",
        variant: "destructive"
      });
      return;
    }

    try {
      await onApprove(selectedApprovers, comments);
      toast({
        title: "Approval request sent",
        description: `Request sent to ${selectedApprovers.length} approver(s)`,
      });
      setComments("");
    } catch (error) {
      toast({
        title: "Failed to submit approval",
        description: error instanceof Error ? error.message : "An error occurred",
        variant: "destructive"
      });
    }
  };

  const groupedApprovers = approvers.reduce((acc, approver) => {
    if (!acc[approver.department]) {
      acc[approver.department] = [];
    }
    acc[approver.department].push(approver);
    return acc;
  }, {} as Record<string, Approver[]>);

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium flex items-center gap-2">
            <Users className="h-4 w-4" />
            Select Approvers
          </h3>
          {documentType && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-1">
                    <AlertCircle className="h-4 w-4 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">Required approvers for {documentType}</span>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>This document type requires approval from:</p>
                  <ul className="list-disc list-inside text-sm">
                    <li>Legal Department</li>
                    <li>Compliance Officer</li>
                  </ul>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>

        <Select onValueChange={handleApproverSelect}>
          <SelectTrigger>
            <SelectValue placeholder="Add approver" />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(groupedApprovers).map(([department, departmentApprovers]) => (
              <SelectGroup key={department}>
                <SelectLabel>{department}</SelectLabel>
                {departmentApprovers.map(approver => (
                  <SelectItem
                    key={approver.id}
                    value={approver.id.toString()}
                    disabled={selectedApprovers.some(a => a.id === approver.id)}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span>{approver.name} - {approver.role}</span>
                      <Badge variant="outline" className={getApproverStatusColor(approver.availability)}>
                        {approver.availability.toLowerCase()}
                      </Badge>
                    </div>
                  </SelectItem>
                ))}
              </SelectGroup>
            ))}
          </SelectContent>
        </Select>

        {selectedApprovers.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Selected Approvers:</h4>
            <div className="space-y-2">
              {selectedApprovers.map(approver => (
                <div
                  key={approver.id}
                  className="flex items-center justify-between p-2 text-sm bg-secondary rounded"
                >
                  <div className="flex flex-col">
                    <span>{approver.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {approver.role} • {approver.department}
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedApprovers(prev => prev.filter(a => a.id !== approver.id))}
                  >
                    Remove
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-2">
          <label htmlFor="comments" className="text-sm font-medium">
            Comments
          </label>
          <Textarea
            id="comments"
            placeholder="Add any comments or instructions for the approvers..."
            value={comments}
            onChange={(e) => setComments(e.target.value)}
            className="min-h-[100px]"
          />
        </div>
      </div>

      <Button
        className="w-full"
        onClick={handleSubmit}
        disabled={isLoading || selectedApprovers.length === 0}
      >
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Submitting...
          </>
        ) : (
          <>
            <UserCheck className="mr-2 h-4 w-4" />
            Request Approval {selectedApprovers.length > 0 && `(${selectedApprovers.length})`}
          </>
        )}
      </Button>
    </div>
  );
}