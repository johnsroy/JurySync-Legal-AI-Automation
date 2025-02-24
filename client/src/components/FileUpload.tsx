import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { FileText, AlertTriangle, Loader2, UploadCloud } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

interface FileUploadProps {
  onFileProcessed: (result: { text: string; documentId: string; fileName: string }) => void;
  onError: (error: string) => void;
  multiple?: boolean;
  setUploadedFiles?: (files: File[]) => void;
}

export function FileUpload({ onFileProcessed, onError, multiple = false, setUploadedFiles }: FileUploadProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const processFile = async (file: File): Promise<void> => {
    if (isProcessing) return;

    setIsProcessing(true);
    setError(null);
    setUploadProgress(0);

    console.log('Starting file upload:', {
      name: file.name,
      type: file.mimetype,
      size: file.size
    });

    const formData = new FormData();
    formData.append("file", file);

    try {
      // Simulate upload progress
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => Math.min(prev + 10, 90));
      }, 500);

      console.log('Sending request to /api/workflow/upload');
      const response = await fetch("/api/workflow/upload", {
        method: "POST",
        body: formData,
      });

      clearInterval(progressInterval);
      setUploadProgress(100);

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Upload failed:', errorData);
        throw new Error(errorData.error || errorData.message || response.statusText || 'Failed to process file');
      }

      const result = await response.json();
      console.log('Upload response:', result);

      if (!result.success) {
        throw new Error(result.error || 'Failed to process file');
      }

      if (!result.text) {
        throw new Error('No text content received from server');
      }

      onFileProcessed({
        text: result.text,
        documentId: result.documentId,
        fileName: file.name
      });

      // Show success toast
      toast({
        title: "Upload Successful",
        description: `${file.name} has been uploaded and is being processed.`,
        duration: 5000,
      });

      setError(null);
      setIsProcessing(false);

    } catch (err) {
      console.error('File processing error:', err);
      const errorMessage = err instanceof Error ? err.message : "Failed to process file";

      setError(errorMessage);
      onError(errorMessage);
      setIsProcessing(false);

      // Show error toast
      toast({
        variant: "destructive",
        title: "Upload Failed",
        description: errorMessage,
        duration: 5000,
      });
    }
  };

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (!acceptedFiles.length) return;

    if (setUploadedFiles) {
      setUploadedFiles(prev => [...(prev || []), ...acceptedFiles]);
    }

    // Process each file sequentially
    for (const file of acceptedFiles) {
      await processFile(file);
    }
  }, [setUploadedFiles]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'text/plain': ['.txt']
    },
    multiple,
    disabled: isProcessing
  });

  return (
    <div className="space-y-4">
      <div
        {...getRootProps()}
        className={cn(
          "border-2 border-dashed rounded-lg p-8 transition-colors duration-200",
          isDragActive ? "border-primary bg-primary/5" : "border-gray-200",
          isProcessing ? "pointer-events-none opacity-50" : "cursor-pointer hover:border-primary hover:bg-gray-50"
        )}
      >
        <input {...getInputProps()} />
        <div className="flex flex-col items-center justify-center space-y-4 text-center">
          <div className="p-3 rounded-full bg-primary/10">
            <UploadCloud className="h-6 w-6 text-primary" />
          </div>
          <div className="space-y-2">
            <h3 className="font-semibold">Upload Document{multiple ? 's' : ''}</h3>
            <p className="text-sm text-gray-500">
              {isDragActive
                ? "Drop your documents here..."
                : "Drag and drop your documents here, or click to select"}
            </p>
            <p className="text-xs text-gray-400">
              Supports PDF, DOCX, and TXT files
            </p>
          </div>
        </div>
      </div>

      {isProcessing && (
        <Card className="p-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm font-medium">Processing document...</span>
              </div>
              <span className="text-sm text-gray-500">{uploadProgress}%</span>
            </div>
            <Progress value={uploadProgress} className="h-2" />
          </div>
        </Card>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Upload Failed</AlertTitle>
          <AlertDescription>
            {error}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}