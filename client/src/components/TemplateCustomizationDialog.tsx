import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Template } from "@/types";
import { useToast } from "@/hooks/use-toast";

interface TemplateCustomizationDialogProps {
  template: Template;
  onGenerate: (variables: Record<string, string>, customClauses: string[]) => void;
  onClose: () => void;
}

export function TemplateCustomizationDialog({
  template,
  onGenerate,
  onClose
}: TemplateCustomizationDialogProps) {
  const [variables, setVariables] = useState<Record<string, string>>({});
  const [customClauses, setCustomClauses] = useState<string[]>([]);
  const { toast } = useToast();

  const handleSubmit = () => {
    // Validate required variables
    const missingVariables = template.metadata.variables
      .filter(v => v.required && !variables[v.name])
      .map(v => v.name);

    if (missingVariables.length > 0) {
      toast({
        title: "Missing Required Variables",
        description: `Please fill in: ${missingVariables.join(", ")}`,
        variant: "destructive"
      });
      return;
    }

    onGenerate(variables, customClauses);
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Customize Template: {template.name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <div className="space-y-4">
            <h3 className="font-medium">Variables</h3>
            {template.metadata.variables.map((variable) => (
              <div key={variable.name}>
                <Label>
                  {variable.name}
                  {variable.required && <span className="text-red-500">*</span>}
                </Label>
                <Input
                  value={variables[variable.name] || ""}
                  onChange={(e) => 
                    setVariables(prev => ({
                      ...prev,
                      [variable.name]: e.target.value
                    }))
                  }
                  placeholder={variable.description}
                />
              </div>
            ))}
          </div>

          <div className="space-y-4">
            <h3 className="font-medium">Custom Clauses</h3>
            <Textarea
              placeholder="Add custom clauses (one per line)"
              value={customClauses.join("\n")}
              onChange={(e) => setCustomClauses(e.target.value.split("\n"))}
              rows={4}
            />
          </div>

          <div className="flex justify-end gap-4">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleSubmit}>
              Generate Contract
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
} 