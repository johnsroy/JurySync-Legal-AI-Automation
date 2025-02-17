import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Upload, FileText } from "lucide-react";
import { RedlineView } from "@/components/RedlineView/RedlineView";

export default function Redline() {
  const [originalText, setOriginalText] = useState("");
  const [proposedText, setProposedText] = useState("");
  const [isComparing, setIsComparing] = useState(false);
  const [showComparison, setShowComparison] = useState(false);
  const { toast } = useToast();

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>, target: "original" | "proposed") => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      if (target === "original") {
        setOriginalText(text);
      } else {
        setProposedText(text);
      }
      toast({
        title: "File Loaded",
        description: `Successfully loaded ${file.name}`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to read file",
        variant: "destructive",
      });
    }
  };

  const handleCompare = () => {
    if (!originalText || !proposedText) {
      toast({
        title: "Error",
        description: "Please enter both original and proposed text",
        variant: "destructive",
      });
      return;
    }
    setIsComparing(true);
    setShowComparison(true);
  };

  const handleClear = () => {
    setOriginalText("");
    setProposedText("");
    setShowComparison(false);
    setIsComparing(false);
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Document Redline</h1>
        <Button variant="outline" onClick={handleClear}>
          Clear All
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Original Document</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-end">
              <Button variant="outline" size="sm">
                <Upload className="h-4 w-4 mr-2" />
                Upload File
                <input
                  type="file"
                  className="hidden"
                  accept=".txt,.doc,.docx"
                  onChange={(e) => handleFileUpload(e, "original")}
                  data-testid="original-file-input"
                />
              </Button>
            </div>
            <textarea
              className="w-full h-[300px] p-4 rounded-md border"
              value={originalText}
              onChange={(e) => setOriginalText(e.target.value)}
              placeholder="Paste or type original text here..."
              data-testid="original-text-input"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Proposed Document</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-end">
              <Button variant="outline" size="sm">
                <Upload className="h-4 w-4 mr-2" />
                Upload File
                <input
                  type="file"
                  className="hidden"
                  accept=".txt,.doc,.docx"
                  onChange={(e) => handleFileUpload(e, "proposed")}
                  data-testid="proposed-file-input"
                />
              </Button>
            </div>
            <textarea
              className="w-full h-[300px] p-4 rounded-md border"
              value={proposedText}
              onChange={(e) => setProposedText(e.target.value)}
              placeholder="Paste or type proposed text here..."
              data-testid="proposed-text-input"
            />
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-center">
        <Button 
          onClick={handleCompare}
          disabled={!originalText || !proposedText || isComparing}
          className="w-full md:w-auto"
        >
          Compare Documents
        </Button>
      </div>

      {showComparison && (
        <Card>
          <CardContent className="p-6">
            <RedlineView
              originalText={originalText}
              proposedText={proposedText}
              isLoading={isComparing}
              onClear={handleClear}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
} 