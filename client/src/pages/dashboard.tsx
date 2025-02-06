import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useDocuments, useCreateDocument } from "@/hooks/use-documents";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertDocumentSchema, type DocumentAnalysis, AgentType } from "@shared/schema";
import {
  FileText,
  LogOut,
  Loader2,
  UploadCloud,
  AlertTriangle,
  ChevronRight,
  Bot,
  MoreVertical,
  Trash2,
} from "lucide-react";
import { FilePond } from "react-filepond";
import "filepond/dist/filepond.min.css";
import { LegalLoadingAnimation } from "@/components/ui/loading-animation";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

const agentDescriptions = {
  CONTRACT_AUTOMATION: {
    title: "Contract Automation",
    description: "Automatically draft, review, and manage legal contracts with AI that understands industry-standard templates.",
    icon: Bot
  },
  COMPLIANCE_AUDITING: {
    title: "Compliance Auditing",
    description: "Scan and audit documents for regulatory compliance, flagging inconsistencies automatically.",
    icon: AlertTriangle
  },
  LEGAL_RESEARCH: {
    title: "Legal Research & Summarization",
    description: "Analyze legal databases, extract precedents, and summarize complex case law.",
    icon: FileText
  }
};

export default function Dashboard() {
  const { user, logoutMutation } = useAuth();
  const { data: documents, isLoading, refetch } = useDocuments();
  const createDocument = useCreateDocument();
  const [open, setOpen] = useState(false);
  const [files, setFiles] = useState([]);
  const [selectedAgent, setSelectedAgent] = useState<AgentType>("CONTRACT_AUTOMATION");
  const { toast } = useToast();

  const form = useForm({
    resolver: zodResolver(insertDocumentSchema),
    defaultValues: {
      title: "",
      agentType: selectedAgent,
    },
  });

  async function onSubmit(data: { title: string }) {
    try {
      if (!files.length || !files[0].file) {
        form.setError("root", { message: "Please select a file to upload" });
        return;
      }

      const formData = new FormData();
      formData.append("file", files[0].file);
      formData.append("title", data.title);
      formData.append("agentType", selectedAgent);

      await createDocument.mutateAsync(formData);
      form.reset();
      setFiles([]);
      setOpen(false);
    } catch (error) {
      console.error('Failed to create document:', error);
    }
  }

  async function deleteDocument(id: number) {
    try {
      const response = await fetch(`/api/documents/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to delete document');
      }

      toast({
        title: "Document deleted",
        description: "The document has been successfully removed.",
      });

      refetch();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete the document. Please try again.",
        variant: "destructive",
      });
    }
  }

  const groupedDocuments = documents?.reduce((acc, doc) => {
    const agentType = doc.agentType as AgentType;
    if (!acc[agentType]) {
      acc[agentType] = [];
    }
    acc[agentType].push(doc);
    return acc;
  }, {} as Record<AgentType, typeof documents>);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <FileText className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-semibold">Legal AI Assistant</h1>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">
              Welcome, {user?.username}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => logoutMutation.mutate()}
              disabled={logoutMutation.isPending}
            >
              {logoutMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <LogOut className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Documents</h2>
            <p className="text-gray-600">
              Upload legal documents for AI-powered analysis
            </p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <UploadCloud className="mr-2 h-4 w-4" />
                Upload Document
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              {createDocument.isPending ? (
                <LegalLoadingAnimation />
              ) : (
                <>
                  <DialogHeader>
                    <DialogTitle>Upload Legal Document</DialogTitle>
                    <DialogDescription>
                      Choose an AI agent and upload your document for specialized analysis.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                      {Object.entries(agentDescriptions).map(([key, value]) => (
                        <div
                          key={key}
                          className={cn(
                            "relative flex items-center space-x-2 rounded-md border p-4 cursor-pointer hover:border-primary transition-colors",
                            selectedAgent === key ? "border-primary bg-primary/5" : "border-border"
                          )}
                          onClick={() => setSelectedAgent(key as AgentType)}
                        >
                          <value.icon className="h-5 w-5" />
                          <div className="flex-1">
                            <h4 className="font-medium">{value.title}</h4>
                            <p className="text-sm text-muted-foreground">
                              {value.description}
                            </p>
                          </div>
                          {selectedAgent === key && (
                            <div className="absolute right-2 top-2 h-2 w-2 rounded-full bg-primary" />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                      <FormField
                        control={form.control}
                        name="title"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Document Title</FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <div className="space-y-2">
                        <FormLabel>Document File</FormLabel>
                        <FilePond
                          files={files}
                          onupdatefiles={setFiles}
                          allowMultiple={false}
                          acceptedFileTypes={[
                            'application/pdf',
                            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                            'application/msword',
                            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                            'application/vnd.ms-excel'
                          ]}
                          labelIdle='Drag & Drop your document or <span class="filepond--label-action">Browse</span>'
                        />
                      </div>
                      <Button
                        type="submit"
                        className="w-full"
                        disabled={createDocument.isPending}
                      >
                        Upload and Analyze
                      </Button>
                    </form>
                  </Form>
                </>
              )}
            </DialogContent>
          </Dialog>
        </div>

        {isLoading ? (
          <div className="grid gap-4">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="animate-pulse">
                <CardHeader className="h-32 bg-gray-100" />
              </Card>
            ))}
          </div>
        ) : !documents?.length ? (
          <Card>
            <CardContent className="p-6">
              <div className="text-center">
                <AlertTriangle className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-semibold text-gray-900">
                  No documents
                </h3>
                <p className="mt-1 text-sm text-gray-500">
                  Get started by uploading your first document.
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-8">
            {Object.entries(agentDescriptions).map(([agentType, info]) => {
              const agentDocs = groupedDocuments?.[agentType as AgentType] || [];

              return (
                <div key={agentType} className="space-y-4">
                  <div className="flex items-center gap-2">
                    <info.icon className="h-5 w-5 text-gray-500" />
                    <h3 className="text-lg font-semibold">{info.title}</h3>
                  </div>
                  {agentDocs.length === 0 ? (
                    <Card>
                      <CardContent className="p-6">
                        <div className="text-center">
                          <p className="text-sm text-gray-500">
                            No documents processed by this agent yet.
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                      {agentDocs.map((doc) => {
                        const analysis = doc.analysis as DocumentAnalysis;
                        if (!analysis || !analysis.riskScore) {
                          return null;
                        }

                        return (
                          <Card key={doc.id} className="relative hover:shadow-md transition-shadow">
                            <CardHeader>
                              <CardTitle className="flex items-center justify-between">
                                <div className="flex items-center gap-2 truncate">
                                  <span className="truncate">{doc.title}</span>
                                </div>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="sm">
                                      <MoreVertical className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={() => window.location.href = `/document/${doc.id}`}>
                                      <FileText className="h-4 w-4 mr-2" />
                                      View Details
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      className="text-red-600"
                                      onClick={() => deleteDocument(doc.id)}
                                    >
                                      <Trash2 className="h-4 w-4 mr-2" />
                                      Delete
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </CardTitle>
                            </CardHeader>
                            <Separator />
                            <CardContent className="pt-4">
                              <p className="text-sm text-gray-600 line-clamp-3">
                                {doc.content}
                              </p>
                              <div className="mt-4 flex items-center text-sm">
                                <div
                                  className={`w-2 h-2 rounded-full mr-2 ${
                                    analysis.riskScore > 7
                                      ? "bg-red-500"
                                      : analysis.riskScore > 4
                                      ? "bg-yellow-500"
                                      : "bg-green-500"
                                  }`}
                                />
                                Risk Score: {analysis.riskScore}/10
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}