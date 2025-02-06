import { useQuery, useMutation } from "@tanstack/react-query";
import { Document, insertDocumentSchema } from "@shared/schema";
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
      toast({
        title: "Upload failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}
