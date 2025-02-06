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
    queryFn: async () => {
      const res = await fetch(`/api/documents/${id}`, {
        credentials: "include",
      });
      if (!res.ok) {
        throw new Error(`Failed to fetch document: ${res.statusText}`);
      }
      return res.json();
    },
    enabled: !!id,
  });
}

export function useCreateDocument() {
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (formData: FormData) => {
      const res = await fetch("/api/documents", {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message);
      }

      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
      toast({
        title: "Document uploaded",
        description: "Your document has been uploaded and analyzed",
      });
    },
    onError: (error: Error) => {
      let description = "Failed to upload document. Please try again later.";
      try {
        const data = JSON.parse(error.message.split(": ")[1]);
        if (data.code === "ANALYSIS_ERROR") {
          description = "Our AI is currently busy. Please try again in a few minutes.";
        } else if (data.code === "VALIDATION_ERROR") {
          description = data.message;
        } else if (data.code === "FILE_TYPE_ERROR") {
          description = "Invalid file type. Please upload PDF, DOCX, DOC, or XLSX files only.";
        }
      } catch {
        // Use default error message
      }

      toast({
        title: "Upload failed",
        description,
        variant: "destructive",
      });
    },
  });
}