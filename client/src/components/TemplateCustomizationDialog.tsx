import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileText, Download } from "lucide-react";
import ContentEditable from "react-contenteditable";
import { Template } from "@shared/schema/template-categories";
import { useToast } from "@/hooks/use-toast";

interface Props {
  template: Template;
  isOpen: boolean;
  onClose: () => void;
}

export function TemplateCustomizationDialog({
  template,
  isOpen,
  onClose
}: Props) {
  const [editableContent, setEditableContent] = useState(template.content);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const contentEditableRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen) {
      setEditableContent(template.content);
    }
  }, [isOpen, template]);

  const handleTextSelection = async () => {
    const selection = window.getSelection();
    if (selection && selection.toString().length > 0) {
      const selectedText = selection.toString();
      try {
        const response = await fetch(`/api/contract-automation/suggestions?q=${encodeURIComponent(selectedText)}`);
        if (!response.ok) throw new Error('Failed to fetch suggestions');
        const data = await response.json();
        setSuggestions(data.suggestions || []);
      } catch (error) {
        console.error('Error fetching suggestions:', error);
        toast({
          title: "Error",
          description: "Failed to get suggestions. Please try again.",
          variant: "destructive"
        });
      }
    }
  };

  const handleContentChange = (evt: any) => {
    setEditableContent(evt.target.value);
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
        title: "Success",
        description: `Contract downloaded in ${format.toUpperCase()} format`,
      });
    } catch (error) {
      console.error('Download error:', error);
      toast({
        title: "Download Failed",
        description: "Failed to download the contract. Please try again.",
        variant: "destructive"
      });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] bg-gray-900 text-gray-100 overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>{template.name}</DialogTitle>
          <p className="text-sm text-gray-400">{template.description}</p>
        </DialogHeader>

        <div className="flex-1 min-h-0 flex flex-col">
          <ScrollArea className="flex-1 rounded-md border border-gray-700 bg-gray-800 p-4 my-4">
            <div className="prose prose-invert max-w-none">
              <ContentEditable
                innerRef={contentEditableRef}
                html={editableContent}
                onChange={handleContentChange}
                onMouseUp={handleTextSelection}
                onKeyUp={handleTextSelection}
                className="focus:outline-none whitespace-pre-wrap font-mono text-sm text-gray-200"
              />
            </div>

            {suggestions.length > 0 && (
              <div className="fixed inset-x-8 bottom-24 max-h-48 overflow-y-auto bg-gray-800 border border-gray-700 rounded-md shadow-lg p-4 z-50">
                <h4 className="text-sm font-medium text-gray-300 mb-2">Suggestions</h4>
                <div className="space-y-1">
                  {suggestions.map((suggestion, index) => (
                    <div
                      key={index}
                      className="px-3 py-2 hover:bg-gray-700 cursor-pointer text-sm rounded text-gray-200"
                      onClick={() => {
                        const selection = window.getSelection();
                        if (selection && !selection.isCollapsed) {
                          const range = selection.getRangeAt(0);
                          range.deleteContents();
                          range.insertNode(document.createTextNode(suggestion));
                          setEditableContent(contentEditableRef.current?.innerHTML || '');
                        }
                        setSuggestions([]);
                      }}
                    >
                      {suggestion}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </ScrollArea>

          <div className="mt-auto border-t border-gray-700 pt-4">
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4 px-4">
              <div className="text-sm text-gray-400">
                Highlight text to get suggestions for improvements
              </div>
              <div className="flex gap-2 shrink-0">
                <Button
                  variant="outline"
                  onClick={() => downloadContract('pdf')}
                  className="bg-gray-800 text-gray-300 border-gray-700 hover:bg-gray-700"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download PDF
                </Button>
                <Button
                  variant="outline"
                  onClick={() => downloadContract('docx')}
                  className="bg-gray-800 text-gray-300 border-gray-700 hover:bg-gray-700"
                >
                  <FileText className="w-4 h-4 mr-2" />
                  Download Word
                </Button>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}