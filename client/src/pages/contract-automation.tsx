import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Gavel, LogOut, Loader2, GitCompare, FileText, AlertCircle } from "lucide-react";
import { FilePond, registerPlugin } from "react-filepond";
import FilePondPluginFileValidateType from "filepond-plugin-file-validate-type";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

import "filepond/dist/filepond.min.css";

registerPlugin(FilePondPluginFileValidateType);

export default function ContractAutomation() {
  const { user, logoutMutation } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [isUploading, setIsUploading] = useState(false);

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
    try {
      // Get base64 string from file
      const base64String = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64 = reader.result as string;
          resolve(base64.split(',')[1]);
        };
        reader.readAsDataURL(file.file);
      });

      const response = await apiRequest("POST", "/api/documents", {
        title: file.filename,
        content: base64String,
        agentType: "CONTRACT_AUTOMATION",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to process document");
      }

      const document = await response.json();
      setLocation(`/documents/${document.id}`);

      toast({
        title: "Document Uploaded",
        description: "Your document is being processed. You'll be redirected shortly.",
      });
    } catch (error: any) {
      console.error('Upload error:', error);
      toast({
        title: "Processing Error",
        description: error.message || "Failed to process document. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
      // Remove the file from FilePond
      file.serverId = 'remove';
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
                    onaddfilestart={() => setIsUploading(true)}
                    onaddfileerror={(error, file) => {
                      setIsUploading(false);
                      console.error('File add error:', error);
                      toast({
                        title: "Upload Error",
                        description: "Failed to add file. Please try again.",
                        variant: "destructive",
                      });
                    }}
                  />

                  {isUploading && (
                    <div className="mt-4 p-4 bg-blue-50 text-blue-700 rounded-lg flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Processing your document...</span>
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