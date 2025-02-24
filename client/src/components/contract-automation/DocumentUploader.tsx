import { useState } from "react";
import { useToast } from "@/components/ui/use-toast";

export function DocumentUploader() {
  const { toast } = useToast();
  const [isUploading, setIsUploading] = useState(false);

  const handleFileUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch("/api/contract-automation/process", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Upload failed");
      }

      toast({
        title: "Success",
        description: "Document uploaded and processed successfully",
      });

      return data.documentId;
    } catch (error) {
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to upload document",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="w-full">
      <input
        type="file"
        onChange={handleFileUpload}
        accept=".pdf,.doc,.docx,.txt"
        disabled={isUploading}
        className="hidden"
        id="file-upload"
      />
      <label
        htmlFor="file-upload"
        className={`block w-full p-4 border-2 border-dashed rounded-lg text-center cursor-pointer
          ${isUploading ? "opacity-50 cursor-not-allowed" : "hover:border-primary"}`}
      >
        {isUploading ? "Uploading..." : "Click or drag file to upload"}
      </label>
    </div>
  );
}
