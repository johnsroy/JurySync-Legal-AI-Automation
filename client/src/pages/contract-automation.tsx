import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Gavel, LogOut, Loader2, GitCompare, FileText, AlertCircle } from "lucide-react";
import { FilePond } from "react-filepond";
import { useToast } from "@/hooks/use-toast";
import "filepond/dist/filepond.min.css";

export default function ContractAutomation() {
  const { user, logoutMutation } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [processingState, setProcessingState] = useState<'idle' | 'uploading' | 'analyzing' | 'complete'>('idle');

  const handleProcessFile = async (error: any, file: any) => {
    if (error) {
      toast({
        title: "Upload Error",
        description: "Failed to upload document. Please try again.",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);
    setProcessingState('uploading');
    setProgress(10);

    try {
      const formData = new FormData();
      formData.append('file', file.file);
      formData.append('title', file.filename);
      formData.append('agentType', 'CONTRACT_AUTOMATION');

      setProgress(30);
      setProcessingState('analyzing');

      const response = await fetch('/api/documents', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to process document");
      }

      setProgress(80);
      const document = await response.json();

      setProgress(100);
      setProcessingState('complete');

      toast({
        title: "Document Processed Successfully",
        description: "Redirecting to the document editor...",
      });

      setTimeout(() => {
        setLocation(`/documents/${document.id}`);
      }, 1000);

    } catch (error: any) {
      console.error('Upload error:', error);
      toast({
        title: "Processing Error",
        description: error.message || "Failed to process document. Please try again.",
        variant: "destructive",
      });
      setProcessingState('idle');
      setProgress(0);
    } finally {
      setIsUploading(false);
      file.serverId = 'remove';
    }
  };

  const getProcessingMessage = () => {
    switch (processingState) {
      case 'uploading':
        return "Uploading your document...";
      case 'analyzing':
        return "Analyzing document with AI...";
      case 'complete':
        return "Processing complete!";
      default:
        return "";
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-yellow-50 to-green-50 animate-gradient-x">
      <header className="bg-white/80 backdrop-blur-lg border-b border-green-100">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link href="/dashboard" className="flex items-center space-x-4 hover:text-green-600">
              <Gavel className="h-6 w-6 text-green-600" />
              <h1 className="text-xl font-semibold">JurySync.io</h1>
            </Link>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">
              Welcome, {user?.firstName} {user?.lastName}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => logoutMutation.mutate()}
              disabled={logoutMutation.isPending}
            >
              {logoutMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <LogOut className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-4 mb-8">
            <GitCompare className="h-8 w-8 text-green-600" />
            <h2 className="text-3xl font-bold">Contract Automation</h2>
          </div>

          <div className="grid gap-6">
            <Card className="bg-white/80 backdrop-blur-lg">
              <CardContent className="p-8">
                <div className="text-center mb-8">
                  <h3 className="text-xl font-semibold mb-2">Upload Contract Document</h3>
                  <p className="text-gray-600">
                    Upload your contract for AI-powered analysis and automation
                  </p>
                </div>

                <div className="max-w-xl mx-auto">
                  <FilePond
                    allowMultiple={false}
                    acceptedFileTypes={['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain']}
                    labelIdle='Drag & Drop your contract or <span class="filepond--label-action">Browse</span>'
                    disabled={isUploading}
                    onprocessfile={handleProcessFile}
                    onaddfilestart={() => {
                      setIsUploading(true);
                      setProcessingState('uploading');
                      setProgress(0);
                    }}
                    onremovefile={() => {
                      setIsUploading(false);
                      setProcessingState('idle');
                      setProgress(0);
                    }}
                  />

                  {processingState !== 'idle' && (
                    <div className="mt-6 space-y-4">
                      <Progress value={progress} className="w-full h-2" />
                      <div className="flex items-center justify-center gap-2 text-blue-600">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>{getProcessingMessage()}</span>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="bg-yellow-50 border-yellow-100">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-yellow-600" />
                  Supported File Types
                </CardTitle>
                <CardDescription>
                  We currently support PDF, Word documents (.doc, .docx), and plain text files.
                  For best results, ensure your document is clearly formatted.
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}