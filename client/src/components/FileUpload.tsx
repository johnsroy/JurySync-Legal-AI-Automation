import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { FileText, AlertTriangle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

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
  const [retryCount, setRetryCount] = useState(0);
  const MAX_RETRIES = 3;

  const processFile = async (file: File, attempt: number = 0): Promise<void> => {
    setIsProcessing(true);
    setError(null);
    setUploadProgress(0);

    const formData = new FormData();
    formData.append("file", file);

    try {
      // Simulate upload progress
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => Math.min(prev + 10, 90));
      }, 100);

      const response = await fetch("/api/workflow/upload", {
        method: "POST",
        body: formData,
      });

      clearInterval(progressInterval);
      setUploadProgress(100);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to process file');
      }

      const result = await response.json();

      // Validate the response format
      if (!result.text || typeof result.text !== 'string') {
        throw new Error('Invalid response format: missing or invalid text content');
      }

      if (!result.documentId) {
        throw new Error('Invalid response format: missing document ID');
      }

      // Clean the text before passing it back
      const cleanedText = result.text
        .replace(/\u0000/g, '') // Remove null bytes
        .replace(/\s+/g, ' ')   // Normalize whitespace
        .trim();

      if (!cleanedText) {
        throw new Error('No valid text content could be extracted from the document');
      }

      onFileProcessed({
        text: cleanedText,
        documentId: result.documentId,
        fileName: file.name
      });

      // Reset retry count on success
      setRetryCount(0);
      setError(null);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to process file";

      // Implement retry logic
      if (attempt < MAX_RETRIES) {
        setRetryCount(attempt + 1);
        setError(`Upload attempt ${attempt + 1} failed. Retrying...`);
        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second before retry
        return processFile(file, attempt + 1);
      }

      setError(`${errorMessage} (After ${MAX_RETRIES} attempts)`);
      onError(errorMessage);
    } finally {
      if (attempt === MAX_RETRIES || !error) {
        setIsProcessing(false);
      }
    }
  };

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (!acceptedFiles.length) return;

    // Update the uploaded files list
    if (setUploadedFiles) {
      setUploadedFiles(prev => [...prev, ...acceptedFiles]);
    }

    // Process each file
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
    multiple
  });

  const handleRetry = useCallback(() => {
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    if (fileInput?.files?.length) {
      processFile(fileInput.files[0]);
    }
  }, []);

  return (
    <div className="space-y-4">
      <div
        {...getRootProps()}
        className={cn(
          "border-2 border-dashed rounded-lg p-8 transition-colors duration-200 cursor-pointer",
          isDragActive ? "border-primary bg-primary/5" : "border-gray-200",
          isProcessing && "pointer-events-none opacity-50"
        )}
      >
        <input {...getInputProps()} />
        <div className="flex flex-col items-center justify-center space-y-4 text-center">
          <div className="p-3 rounded-full bg-primary/10">
            <FileText className="h-6 w-6 text-primary" />
          </div>
          <div className="space-y-2">
            <h3 className="font-semibold">Upload Document{multiple ? 's' : ''}</h3>
            <p className="text-sm text-gray-500">
              Drag and drop your document{multiple ? 's' : ''} here, or click to select
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
                <span className="text-sm font-medium">
                  Processing document... {retryCount > 0 ? `(Attempt ${retryCount}/${MAX_RETRIES})` : ''}
                </span>
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
          <AlertDescription className="space-y-2">
            <p>{error}</p>
            {retryCount >= MAX_RETRIES && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleRetry}
                className="mt-2"
              >
                Try Again
              </Button>
            )}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}