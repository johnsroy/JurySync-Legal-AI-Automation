import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { FileText, File, AlertTriangle, CheckCircle, Loader2 } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

interface UploadResponse {
  documentId: string;
  parsedText: string;
  status: "success" | "error";
  message?: string;
}

interface DocumentUploadProps {
  onUploadComplete: (response: UploadResponse) => void;
}

export default function DocumentUpload({ onUploadComplete }: DocumentUploadProps) {
  const [uploadProgress, setUploadProgress] = useState(0);
  const { toast } = useToast();

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/documents/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to upload document");
      }

      return response.json() as Promise<UploadResponse>;
    },
    onSuccess: (data) => {
      onUploadComplete(data);
      toast({
        title: "Upload Successful",
        description: "Document has been uploaded and parsed successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Upload Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file) {
      uploadMutation.mutate(file);
    }
  }, [uploadMutation]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'text/plain': ['.txt']
    },
    maxFiles: 1,
  });

  return (
    <div className="space-y-4">
      <div
        {...getRootProps()}
        className={`
          border-2 border-dashed rounded-lg p-8 text-center cursor-pointer
          transition-colors duration-200 ease-in-out
          ${isDragActive ? 'border-primary bg-primary/5' : 'border-gray-300 hover:border-primary'}
        `}
      >
        <input {...getInputProps()} />
        <div className="flex flex-col items-center space-y-4">
          <FileText className="h-12 w-12 text-gray-400" />
          <div>
            <p className="text-lg font-medium">
              {isDragActive ? "Drop the file here" : "Drag & drop a document here"}
            </p>
            <p className="text-sm text-gray-500">
              Supported formats: PDF, DOCX, TXT
            </p>
          </div>
          <Button variant="outline" type="button" onClick={(e) => e.stopPropagation()}>
            Browse Files
          </Button>
        </div>
      </div>

      {uploadMutation.isPending && (
        <div className="space-y-2">
          <div className="flex items-center space-x-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">Uploading document...</span>
          </div>
          <Progress value={uploadProgress} className="h-2" />
        </div>
      )}

      {uploadMutation.isError && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Upload Failed</AlertTitle>
          <AlertDescription>
            {uploadMutation.error.message}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
