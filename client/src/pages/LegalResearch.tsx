import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { FilePond, registerPlugin } from "react-filepond";
import FilePondPluginFileValidateType from "filepond-plugin-file-validate-type";
import "filepond/dist/filepond.min.css";
import { queryClient } from "@/lib/queryClient";
import { Loader2 } from "lucide-react";

registerPlugin(FilePondPluginFileValidateType);

const searchSchema = z.object({
  query: z.string().min(1, "Please enter a search query"),
});

type SearchForm = z.infer<typeof searchSchema>;

export default function LegalResearch() {
  const [searchResults, setSearchResults] = useState<any>(null);
  const [files, setFiles] = useState<any[]>([]);

  const { register, handleSubmit, formState: { errors } } = useForm<SearchForm>({
    resolver: zodResolver(searchSchema),
  });

  const searchMutation = useMutation({
    mutationFn: async (data: SearchForm) => {
      const response = await fetch("/api/legal/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to search");
      return response.json();
    },
    onSuccess: (data) => {
      setSearchResults(data);
      queryClient.invalidateQueries({ queryKey: ["/api/legal/documents"] });
    },
  });

  const handleSearch = (data: SearchForm) => {
    searchMutation.mutate(data);
  };

  const renderSearchResults = () => {
    if (!searchResults) return null;

    return (
      <div className="space-y-4">
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-2">Summary</h3>
          <p>{searchResults.summary}</p>
        </Card>

        {searchResults.relevantCases?.length > 0 && (
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Relevant Cases</h3>
            <div className="space-y-4">
              {searchResults.relevantCases.map((result: any, index: number) => (
                <div key={index} className="border-b last:border-0 pb-4">
                  <h4 className="font-medium">{result.document.title}</h4>
                  <p className="text-sm text-gray-600">
                    Jurisdiction: {result.document.jurisdiction}
                  </p>
                  <p className="mt-2">{result.document.content.substring(0, 200)}...</p>
                </div>
              ))}
            </div>
          </Card>
        )}

        {searchResults.timeline && (
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Timeline</h3>
            <div className="space-y-2">
              {searchResults.timeline.map((event: any, index: number) => (
                <div key={index} className="flex gap-4">
                  <span className="font-medium">{event.date}</span>
                  <span>{event.event}</span>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    );
  };

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-8">Legal Research Assistant</h1>

      <div className="grid gap-8">
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Search Legal Documents</h2>
          <form onSubmit={handleSubmit(handleSearch)} className="space-y-4">
            <div>
              <Textarea
                placeholder="Enter your legal research query..."
                {...register("query")}
                className="min-h-[100px]"
              />
              {errors.query && (
                <p className="text-red-500 text-sm mt-1">{errors.query.message}</p>
              )}
            </div>
            <Button
              type="submit"
              disabled={searchMutation.isPending}
              className="w-full"
            >
              {searchMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Searching...
                </>
              ) : (
                "Begin Research"
              )}
            </Button>
          </form>
        </Card>

        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Upload Legal Documents</h2>
          <FilePond
            files={files}
            onupdatefiles={setFiles}
            allowMultiple={true}
            maxFiles={5}
            server="/api/legal/documents"
            acceptedFileTypes={['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']}
            labelIdle='Drag & Drop your legal documents or <span class="filepond--label-action">Browse</span>'
          />
        </Card>

        {searchMutation.isPending ? (
          <div className="flex justify-center items-center p-8">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : (
          renderSearchResults()
        )}
      </div>
    </div>
  );
}
