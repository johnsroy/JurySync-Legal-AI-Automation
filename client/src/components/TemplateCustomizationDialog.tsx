import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Template } from "@shared/schema/template-categories";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileText, Download } from "lucide-react";

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
  const [previewContent, setPreviewContent] = useState(template.content);
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

  const updatePreview = () => {
    let content = template.content;
    Object.entries(variables).forEach(([key, value]) => {
      content = content.replace(new RegExp(`\\[${key}\\]`, 'g'), value || `[${key}]`);
    });
    setPreviewContent(content);
  };

  const handleInputChange = (name: string, value: string) => {
    setVariables(prev => ({
      ...prev,
      [name]: value
    }));
    updatePreview();
  };

  const downloadContract = async (format: 'pdf' | 'docx') => {
    try {
      const response = await fetch('/api/contract-automation/download', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: previewContent,
          format
        }),
      });

      if (!response.ok) throw new Error('Download failed');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `contract.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      toast({
        title: "Download Complete",
        description: `Contract downloaded in ${format.toUpperCase()} format`,
      });
    } catch (error) {
      toast({
        title: "Download Failed",
        description: "Failed to download the contract. Please try again.",
        variant: "destructive"
      });
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-4xl bg-gray-900 text-gray-100">
        <DialogHeader>
          <DialogTitle>Customize Template: {template.name}</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="edit" className="w-full">
          <TabsList className="bg-gray-800">
            <TabsTrigger value="edit">Edit</TabsTrigger>
            <TabsTrigger value="preview">Preview</TabsTrigger>
          </TabsList>

          <TabsContent value="edit" className="space-y-6">
            <div className="space-y-4">
              <h3 className="font-medium text-gray-200">Template Variables</h3>
              {template.metadata.variables.map((variable) => (
                <div key={variable.name} className="space-y-2">
                  <Label className="text-gray-300">
                    {variable.description}
                    {variable.required && <span className="text-red-500 ml-1">*</span>}
                  </Label>
                  <Input
                    className="bg-gray-800 border-gray-700 text-gray-100"
                    value={variables[variable.name] || ""}
                    onChange={(e) => handleInputChange(variable.name, e.target.value)}
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
          </TabsContent>

          <TabsContent value="preview">
            <div className="space-y-4">
              <ScrollArea className="h-[50vh] w-full rounded-md border border-gray-700 bg-gray-800 p-4">
                <div className="prose prose-invert max-w-none">
                  <pre className="whitespace-pre-wrap">{previewContent}</pre>
                </div>
              </ScrollArea>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => downloadContract('pdf')}
                  className="bg-gray-800 text-gray-300 border-gray-700"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download PDF
                </Button>
                <Button
                  variant="outline"
                  onClick={() => downloadContract('docx')}
                  className="bg-gray-800 text-gray-300 border-gray-700"
                >
                  <FileText className="w-4 h-4 mr-2" />
                  Download Word
                </Button>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end gap-4 mt-6">
          <Button variant="outline" onClick={onClose} className="bg-gray-800 text-gray-300 border-gray-700">
            Cancel
          </Button>
          <Button onClick={handleSubmit} className="bg-blue-600 hover:bg-blue-700 text-white">
            Generate Contract
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}