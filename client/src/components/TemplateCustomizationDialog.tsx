import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Template } from "@shared/schema/template-categories";
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
    const missingVariables = template.variables
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
      <DialogContent className="max-w-2xl bg-gray-900 text-gray-100">
        <DialogHeader>
          <DialogTitle>Customize Template: {template.name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <div className="space-y-4">
            <h3 className="font-medium text-gray-200">Template Variables</h3>
            {template.variables.map((variable) => (
              <div key={variable.name} className="space-y-2">
                <Label className="text-gray-300">
                  {variable.description}
                  {variable.required && <span className="text-red-500 ml-1">*</span>}
                </Label>
                <Input
                  className="bg-gray-800 border-gray-700 text-gray-100"
                  value={variables[variable.name] || ""}
                  onChange={(e) => 
                    setVariables(prev => ({
                      ...prev,
                      [variable.name]: e.target.value
                    }))
                  }
                  placeholder={`Enter ${variable.name.toLowerCase()}`}
                />
              </div>
            ))}
          </div>

          <div className="space-y-4">
            <h3 className="font-medium text-gray-200">Custom Requirements</h3>
            <Textarea
              className="bg-gray-800 border-gray-700 text-gray-100"
              placeholder="Add custom requirements (one per line)"
              value={customClauses.join("\n")}
              onChange={(e) => setCustomClauses(e.target.value.split("\n"))}
              rows={4}
            />
          </div>

          <div className="flex justify-end gap-4">
            <Button variant="outline" onClick={onClose} className="bg-gray-800 text-gray-300 border-gray-700">
              Cancel
            </Button>
            <Button onClick={handleSubmit} className="bg-blue-600 hover:bg-blue-700 text-white">
              Generate Contract
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}