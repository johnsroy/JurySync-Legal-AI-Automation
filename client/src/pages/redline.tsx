import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Download, History, Check, X, Upload, Loader2 } from "lucide-react";

interface TextChange {
  type: 'insertion' | 'deletion';
  content: string;
  timestamp: Date;
  position: number;
}

interface BufferedDeletion {
  content: string;
  position: number;
  startTime: Date;
}

const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>, setContent: (content: string) => void, setIsLoading: (loading: boolean) => void, toast: any) => {
  const file = event.target.files?.[0];
  if (!file) return;

  try {
    setIsLoading(true);
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch('/api/redline/upload', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error('Failed to upload file');
    }

    const data = await response.json();
    setContent(data.text);
    toast({
      title: "Success",
      description: "File uploaded and processed successfully",
    });
  } catch (error) {
    console.error("Error reading file:", error);
    toast({
      title: "Error",
      description: "Failed to process file",
      variant: "destructive",
    });
  } finally {
    setIsLoading(false);
  }
};

export default function Redline() {
  const [content, setContent] = useState<string>("");
  const [changes, setChanges] = useState<TextChange[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  // Buffer for tracking deletions
  const [bufferedDeletion, setBufferedDeletion] = useState<BufferedDeletion | null>(null);
  const bufferTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Clear the timeout when component unmounts
    return () => {
      if (bufferTimeoutRef.current) {
        clearTimeout(bufferTimeoutRef.current);
      }
    };
  }, []);

  const trackChange = (type: 'insertion' | 'deletion', newContent: string, position: number) => {
    const change: TextChange = {
      type,
      content: newContent,
      timestamp: new Date(),
      position
    };
    setChanges(prev => [...prev, change]);
  };

  const commitBufferedDeletion = () => {
    if (bufferedDeletion) {
      trackChange('deletion', bufferedDeletion.content, bufferedDeletion.position);
      setBufferedDeletion(null);
    }
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = e.target.value;
    const oldContent = content;

    if (newContent.length > oldContent.length) {
      // Handle insertions immediately
      const pos = e.target.selectionStart - 1;
      const inserted = newContent.slice(pos, pos + (newContent.length - oldContent.length));
      trackChange('insertion', inserted, pos);
    } else if (newContent.length < oldContent.length) {
      // Handle deletions with buffering
      const pos = e.target.selectionStart;
      const deleted = oldContent.slice(pos, pos + (oldContent.length - newContent.length));

      if (bufferTimeoutRef.current) {
        clearTimeout(bufferTimeoutRef.current);
      }

      if (bufferedDeletion && 
          pos === bufferedDeletion.position - deleted.length) {
        // Combine with existing buffered deletion
        setBufferedDeletion({
          content: deleted + bufferedDeletion.content,
          position: pos,
          startTime: bufferedDeletion.startTime
        });
      } else {
        // Start new buffered deletion
        setBufferedDeletion({
          content: deleted,
          position: pos,
          startTime: new Date()
        });
      }

      // Set timeout to commit the buffered deletion
      bufferTimeoutRef.current = setTimeout(commitBufferedDeletion, 10000);
    }

    setContent(newContent);
  };

  const acceptChange = (index: number) => {
    const change = changes[index];
    setChanges(changes.filter((_, i) => i !== index));
    toast({
      title: "Change accepted",
      description: `${change.type === 'insertion' ? 'Added' : 'Removed'}: "${change.content}"`,
    });
  };

  const rejectChange = (index: number) => {
    const change = changes[index];
    let newContent = content;

    if (change.type === 'insertion') {
      newContent = content.slice(0, change.position) + 
                  content.slice(change.position + change.content.length);
    } else {
      newContent = content.slice(0, change.position) + 
                  change.content + 
                  content.slice(change.position);
    }

    setContent(newContent);
    setChanges(changes.filter((_, i) => i !== index));

    toast({
      title: "Change rejected",
      description: `Reverted: "${change.content}"`,
    });
  };

  const downloadAsPDF = async () => {
    try {
      // Commit any pending buffered deletion before export
      if (bufferedDeletion) {
        commitBufferedDeletion();
      }

      const response = await fetch('/api/redline/export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content,
          changes
        })
      });

      if (!response.ok) throw new Error('Export failed');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'document-with-changes.pdf';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "Success",
        description: "Document exported as PDF",
      });
    } catch (error) {
      toast({
        title: "Export failed",
        description: "Could not export document to PDF",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6 bg-gray-900 min-h-screen">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-white">Document Redlining</h1>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={() => setShowHistory(!showHistory)}
            className="text-gray-300 hover:text-white"
          >
            <History className="h-4 w-4 mr-2" />
            {showHistory ? "Hide History" : "Show History"}
          </Button>
          <Button 
            onClick={downloadAsPDF}
            className="bg-gray-800 hover:bg-gray-700 text-white"
          >
            <Download className="h-4 w-4 mr-2" />
            Export as PDF
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white">Document Editor</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex justify-end mb-4">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={isLoading}
                  className="relative"
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Upload className="h-4 w-4 mr-2" />
                      Upload File
                    </>
                  )}
                  <input
                    type="file"
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    accept=".txt,.doc,.docx,.pdf"
                    onChange={(e) => handleFileUpload(e, setContent, setIsLoading, toast)}
                    disabled={isLoading}
                  />
                </Button>
              </div>
              <textarea
                className="w-full h-[500px] p-4 bg-gray-900 text-gray-100 font-mono text-sm rounded-md border border-gray-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                value={content}
                onChange={handleTextChange}
                placeholder="Start typing or paste your text here..."
              />
            </CardContent>
          </Card>
        </div>

        {showHistory && (
          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white">Change History</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {changes.length === 0 && !bufferedDeletion ? (
                  <p className="text-gray-400 text-center">No changes yet</p>
                ) : (
                  <>
                    {/* Show buffered deletion if exists */}
                    {bufferedDeletion && (
                      <div className="p-3 rounded-lg border border-gray-700 bg-gray-900 opacity-50">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <span className="inline-block px-2 py-1 rounded text-xs bg-red-900/50 text-red-300">
                              Deleting...
                            </span>
                            <span className="ml-2 text-sm text-gray-400">
                              {bufferedDeletion.startTime.toLocaleTimeString()}
                            </span>
                          </div>
                        </div>
                        <p className="font-mono text-sm break-all">
                          <span className="text-red-300 bg-red-900/30 px-1 rounded line-through">
                            {bufferedDeletion.content}
                          </span>
                        </p>
                      </div>
                    )}

                    {/* Show committed changes */}
                    {changes.map((change, index) => (
                      <div 
                        key={index}
                        className="p-3 rounded-lg border border-gray-700 bg-gray-900"
                      >
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <span className={`inline-block px-2 py-1 rounded text-xs ${
                              change.type === 'insertion' 
                                ? 'bg-emerald-900/50 text-emerald-300' 
                                : 'bg-red-900/50 text-red-300'
                            }`}>
                              {change.type === 'insertion' ? 'Added' : 'Removed'}
                            </span>
                            <span className="ml-2 text-sm text-gray-400">
                              {change.timestamp.toLocaleTimeString()}
                            </span>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => acceptChange(index)}
                              className="text-emerald-400 hover:text-emerald-300"
                            >
                              <Check className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => rejectChange(index)}
                              className="text-red-400 hover:text-red-300"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                        <p className="font-mono text-sm break-all">
                          <span className={`${
                            change.type === 'insertion'
                              ? 'text-emerald-300 bg-emerald-900/30 px-1 rounded'
                              : 'text-red-300 bg-red-900/30 px-1 rounded line-through'
                          }`}>
                            {change.content}
                          </span>
                        </p>
                      </div>
                    ))}
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}