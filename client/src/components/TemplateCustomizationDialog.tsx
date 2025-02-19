import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileText, Download } from "lucide-react";
import ContentEditable from "react-contenteditable";
import { Template } from "@shared/schema/template-categories";
import { useToast } from "@/hooks/use-toast";

interface TemplateCustomizationDialogProps {
  template: Template;
  onClose: () => void;
}

export function TemplateCustomizationDialog({
  template,
  onClose
}: TemplateCustomizationDialogProps) {
  const [editableContent, setEditableContent] = useState(template.content);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const contentEditableRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // Load initial preview content
  useEffect(() => {
    setEditableContent(template.content);
  }, [template]);

  const fetchSuggestions = async (text: string) => {
    try {
      const response = await fetch(`/api/contract-automation/suggestions?q=${encodeURIComponent(text)}`);
      if (!response.ok) throw new Error('Failed to fetch suggestions');
      const data = await response.json();
      setSuggestions(data.suggestions || []);
    } catch (error) {
      console.error('Error fetching suggestions:', error);
    }
  };

  const handleContentChange = (evt: any) => {
    const newContent = evt.target.value;
    setEditableContent(newContent);

    // Get the last few words for suggestions
    const words = newContent.split(/\s+/);
    const lastWords = words.slice(-3).join(' ');
    if (lastWords.length > 2) {
      fetchSuggestions(lastWords);
    }
  };

  const downloadContract = async (format: 'pdf' | 'docx') => {
    try {
      const response = await fetch('/api/contract-automation/download', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: editableContent,
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
      <DialogContent className="max-w-4xl h-[80vh] bg-gray-900 text-gray-100">
        <DialogHeader>
          <DialogTitle>{template.name}</DialogTitle>
          <p className="text-sm text-gray-400">{template.description}</p>
        </DialogHeader>

        <div className="flex flex-col h-full space-y-4">
          <ScrollArea className="flex-grow rounded-md border border-gray-700 bg-gray-800 p-4">
            <div className="prose prose-invert max-w-none">
              <ContentEditable
                innerRef={contentEditableRef}
                html={editableContent}
                onChange={handleContentChange}
                className="focus:outline-none whitespace-pre-wrap font-mono text-sm"
              />
            </div>

            {suggestions.length > 0 && (
              <div className="fixed bottom-16 left-4 right-4 bg-gray-800 border border-gray-700 rounded-md shadow-lg">
                {suggestions.map((suggestion, index) => (
                  <div
                    key={index}
                    className="px-4 py-2 hover:bg-gray-700 cursor-pointer text-sm"
                    onClick={() => {
                      const content = editableContent + ' ' + suggestion;
                      setEditableContent(content);
                      setSuggestions([]);
                    }}
                  >
                    {suggestion}
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>

          <div className="flex justify-between items-center">
            <div className="text-sm text-gray-400">
              Edit the contract content directly in the editor above
            </div>
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
        </div>
      </DialogContent>
    </Dialog>
  );
}