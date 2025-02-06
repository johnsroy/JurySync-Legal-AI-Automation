import { useQuery, useMutation } from "@tanstack/react-query";
import { Document, insertDocumentSchema, DocumentAnalysis } from "@shared/schema";
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
    select: (data) => {
      if (!data) return undefined;
      try {
        // Ensure the analysis is properly typed
        const analysis = data.analysis as DocumentAnalysis | null;
        if (!analysis || typeof analysis !== 'object') {
          console.error("Invalid document analysis format:", analysis);
          return undefined;
        }

        // Validate required fields
        if (!analysis.summary || !Array.isArray(analysis.keyPoints) || 
            !Array.isArray(analysis.suggestions) || typeof analysis.riskScore !== 'number') {
          console.error("Missing required fields in analysis:", analysis);
          return undefined;
        }

        return {
          ...data,
          analysis,
        };
      } catch (error) {
        console.error("Error processing document analysis:", error);
        return undefined;
      }
    },
  });
}

export function useCreateDocument() {
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (document: { title: string; content: string }) => {
      const parsed = insertDocumentSchema.parse(document);
      const res = await apiRequest("POST", "/api/documents", parsed);
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