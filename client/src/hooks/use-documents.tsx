import { useQuery, useMutation } from "@tanstack/react-query";
import { Document, insertDocumentSchema, type DocumentAnalysis } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export function useDocuments() {
  return useQuery<Document[]>({
    queryKey: ["/api/documents"],
  });
}

export function useDocument(id: string) {
  return useQuery<Document>({
    queryKey: ["/api/documents", id],
    enabled: !!id,
  });
}

export function useCreateDocument() {
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (formData: FormData) => {
      const response = await apiRequest("POST", "/api/documents", formData);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to create document");
      }

      return await response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
      toast({
        title: "Document uploaded",
        description: "Your document has been uploaded successfully",
      });
    },
    onError: (error: Error) => {
      let description = "Failed to upload document. Please try again.";

      try {
        const data = JSON.parse(error.message);
        if (data.code === "FILE_SIZE_ERROR") {
          description = "File size exceeds the maximum limit. Please upload a smaller file.";
        } else if (data.code === "FILE_TYPE_ERROR") {
          description = "Invalid file type. Please upload PDF, DOCX, or TXT files only.";
        } else if (data.code === "SERVER_ERROR") {
          description = "Server error occurred. Please try again later.";
        }
      } catch {
        description = error.message || description;
      }

      toast({
        title: "Upload failed",
        description,
        variant: "destructive",
      });
    },
  });
}