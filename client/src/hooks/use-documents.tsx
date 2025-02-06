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
    select: (data) => {
      if (!data) return undefined;

      // Don't try to parse analysis if it doesn't exist
      if (!data.analysis) {
        console.error("Document has no analysis data");
        return data;
      }

      try {
        // Validate analysis structure
        const analysis = data.analysis as DocumentAnalysis;

        // Validate required fields
        if (
          !analysis.summary ||
          !Array.isArray(analysis.keyPoints) || analysis.keyPoints.length === 0 ||
          !Array.isArray(analysis.suggestions) || analysis.suggestions.length === 0 ||
          typeof analysis.riskScore !== 'number'
        ) {
          console.error("Document analysis is missing required fields:", analysis);
          return data;
        }

        return {
          ...data,
          analysis,
        };
      } catch (error) {
        console.error("Error processing document analysis:", error);
        return data;
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