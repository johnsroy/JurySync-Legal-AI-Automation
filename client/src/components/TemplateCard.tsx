import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Template } from "@shared/schema/template-categories";
import { ScrollArea } from "@/components/ui/scroll-area";
import ContentEditable from "react-contenteditable";
import { useState, useRef } from "react";
import { Download, FileText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface TemplateCardProps {
  template: Template;
}

interface FieldSuggestion {
  field: string;
  suggestions: string[];
  description: string;
  fieldType: 'date' | 'name' | 'address' | 'company' | 'amount' | 'other';
}

export function TemplateCard({ template }: TemplateCardProps) {
  const [content, setContent] = useState(template.content);
  const [suggestions, setSuggestions] = useState<FieldSuggestion[]>([]);
  const contentEditableRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const handleTextSelection = async () => {
    const selection = window.getSelection();
    if (selection && selection.toString().length > 0) {
      const selectedText = selection.toString();
      try {
        const response = await fetch(
          `/api/contract-automation/suggestions?${new URLSearchParams({
            q: selectedText,
            content: content
          })}`
        );

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
    setContent(evt.target.value);
  };

  const downloadContract = async (format: 'pdf' | 'docx') => {
    try {
      const response = await fetch('/api/contract-automation/download', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content,
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
    <Card className="flex flex-col h-full bg-gray-800/50 border-gray-700 hover:border-blue-500/50 transition-colors">
      <CardHeader className="space-y-2">
        <CardTitle className="text-xl text-white">{template.name}</CardTitle>
        <CardDescription className="text-gray-400">{template.description}</CardDescription>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={
            template.metadata.complexity === "LOW" ? "secondary" :
            template.metadata.complexity === "MEDIUM" ? "default" :
            "destructive"
          }>
            {template.metadata.complexity}
          </Badge>
          {template.metadata.tags?.map((tag) => (
            <Badge key={tag} variant="outline" className="text-gray-300 border-gray-600">
              {tag}
            </Badge>
          ))}
        </div>
      </CardHeader>

      <CardContent className="flex-grow min-h-0">
        <ScrollArea className="h-[400px] rounded-md border border-gray-700 bg-gray-800 p-4">
          <ContentEditable
            innerRef={contentEditableRef}
            html={content}
            onChange={handleContentChange}
            onMouseUp={handleTextSelection}
            onKeyUp={handleTextSelection}
            className="focus:outline-none whitespace-pre-wrap font-mono text-sm text-gray-200"
          />

          {suggestions.length > 0 && (
            <div className="fixed inset-x-4 bottom-24 max-h-64 overflow-y-auto bg-gray-800 border border-gray-700 rounded-md shadow-lg p-4 z-50">
              <div className="space-y-4">
                {suggestions.map((suggestion, index) => (
                  <div key={index} className="border-b border-gray-700 last:border-0 pb-3 last:pb-0">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-sm font-medium text-gray-300">
                        {suggestion.field}
                      </h4>
                      <Badge variant="outline" className="text-xs">
                        {suggestion.fieldType}
                      </Badge>
                    </div>
                    <p className="text-xs text-gray-400 mb-2">{suggestion.description}</p>
                    <div className="space-y-2">
                      {suggestion.suggestions.map((value, sIndex) => (
                        <div
                          key={sIndex}
                          className="px-3 py-1.5 hover:bg-gray-700 cursor-pointer text-sm rounded flex items-center justify-between"
                          onClick={() => {
                            const selection = window.getSelection();
                            if (selection && !selection.isCollapsed) {
                              const range = selection.getRangeAt(0);
                              range.deleteContents();
                              range.insertNode(document.createTextNode(value));
                              setContent(contentEditableRef.current?.innerHTML || '');
                            }
                            setSuggestions([]);
                          }}
                        >
                          <span className="text-gray-200">{value}</span>
                          <Badge variant="secondary" className="text-xs">
                            {suggestion.fieldType === 'date' ? 'Today' : 'Suggested'}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </ScrollArea>
      </CardContent>

      <CardFooter className="mt-auto border-t border-gray-700 p-4">
        <div className="w-full flex flex-col sm:flex-row justify-between items-center gap-4">
          <p className="text-sm text-gray-400">
            Highlight text to get suggestions
          </p>
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
      </CardFooter>
    </Card>
  );
}