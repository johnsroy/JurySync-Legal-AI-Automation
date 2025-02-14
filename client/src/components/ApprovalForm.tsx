import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, UserCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Approver {
  id: number;
  name: string;
  role: string;
}

interface ApprovalFormProps {
  onApprove: (approvers: Approver[]) => Promise<void>;
  isLoading?: boolean;
}

// Mock data for approvers - in a real app, this would come from your backend
const availableApprovers: Approver[] = [
  { id: 1, name: "John Smith", role: "Legal Director" },
  { id: 2, name: "Sarah Johnson", role: "Compliance Officer" },
  { id: 3, name: "Michael Chen", role: "Senior Legal Counsel" },
  { id: 4, name: "Emma Davis", role: "Risk Manager" },
];

export function ApprovalForm({ onApprove, isLoading }: ApprovalFormProps) {
  const [selectedApprovers, setSelectedApprovers] = useState<Approver[]>([]);
  const { toast } = useToast();

  const handleApproverSelect = (approverId: string) => {
    const approver = availableApprovers.find(a => a.id === parseInt(approverId));
    if (approver && !selectedApprovers.some(a => a.id === approver.id)) {
      setSelectedApprovers(prev => [...prev, approver]);
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
      await onApprove(selectedApprovers);
      toast({
        title: "Approval request sent",
        description: `Request sent to ${selectedApprovers.length} approver(s)`,
      });
    } catch (error) {
      toast({
        title: "Failed to submit approval",
        description: error instanceof Error ? error.message : "An error occurred",
        variant: "destructive"
      });
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <h3 className="text-sm font-medium">Select Approvers</h3>
        <Select onValueChange={handleApproverSelect}>
          <SelectTrigger>
            <SelectValue placeholder="Add approver" />
          </SelectTrigger>
          <SelectContent>
            {availableApprovers.map(approver => (
              <SelectItem
                key={approver.id}
                value={approver.id.toString()}
                disabled={selectedApprovers.some(a => a.id === approver.id)}
              >
                {approver.name} - {approver.role}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {selectedApprovers.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium">Selected Approvers:</h4>
          <div className="space-y-1">
            {selectedApprovers.map(approver => (
              <div
                key={approver.id}
                className="flex items-center justify-between p-2 text-sm bg-secondary rounded"
              >
                <span>{approver.name} ({approver.role})</span>
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

      <Button
        className="w-full"
        onClick={handleSubmit}
        disabled={isLoading || selectedApprovers.length === 0}
      >
        {isLoading ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <UserCheck className="mr-2 h-4 w-4" />
        )}
        {isLoading ? "Submitting..." : "Request Approval"}
      </Button>
    </div>
  );
}
