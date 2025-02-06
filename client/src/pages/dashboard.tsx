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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
} from "lucide-react";
import { FilePond, registerPlugin } from "react-filepond";
import "filepond/dist/filepond.min.css";
import FilePondPluginFileValidateType from "filepond-plugin-file-validate-type";
import type { FilePondFile } from "filepond";

registerPlugin(FilePondPluginFileValidateType);

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
  const { data: documents, isLoading } = useDocuments();
  const createDocument = useCreateDocument();
  const [open, setOpen] = useState(false);
  const [files, setFiles] = useState<FilePondFile[]>([]);

  const form = useForm({
    resolver: zodResolver(insertDocumentSchema),
    defaultValues: {
      title: "",
      agentType: "CONTRACT_AUTOMATION" as AgentType,
    },
  });

  async function onSubmit(data: { title: string; agentType: AgentType }) {
    try {
      if (!files.length || !files[0].file) {
        form.setError("root", { message: "Please select a file to upload" });
        return;
      }

      const formData = new FormData();
      formData.append("file", files[0].file);
      formData.append("title", data.title);
      formData.append("agentType", data.agentType);

      await createDocument.mutateAsync(formData);
      form.reset();
      setFiles([]);
      setOpen(false);
    } catch (error) {
      console.error('Failed to create document:', error);
    }
  }

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
              <DialogHeader>
                <DialogTitle>Upload Legal Document</DialogTitle>
                <DialogDescription>
                  Choose an AI agent and upload your document for specialized analysis.
                </DialogDescription>
              </DialogHeader>
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
                  <FormField
                    control={form.control}
                    name="agentType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>AI Agent</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select an AI agent" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {Object.entries(agentDescriptions).map(([key, value]) => (
                              <SelectItem
                                key={key}
                                value={key}
                                className="flex flex-col space-y-1 p-2"
                              >
                                <div className="flex items-center gap-2">
                                  <value.icon className="h-4 w-4" />
                                  <span className="font-medium">{value.title}</span>
                                </div>
                                <span className="text-xs text-gray-500">
                                  {value.description}
                                </span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="space-y-2">
                    <FormLabel>Document File</FormLabel>
                    <FilePond
                      files={files}
                      onupdatefiles={(fileItems: FilePondFile[]) => {
                        setFiles(fileItems);
                      }}
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
                    {createDocument.isPending && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    Upload and Analyze
                  </Button>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>

        {isLoading ? (
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
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
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {documents.map((doc) => {
              const analysis = doc.analysis as DocumentAnalysis;
              if (!analysis || !analysis.riskScore) {
                return null;
              }

              const agentInfo = agentDescriptions[doc.agentType as AgentType];
              const AgentIcon = agentInfo?.icon || Bot;

              return (
                <Link key={doc.id} href={`/document/${doc.id}`}>
                  <Card className="cursor-pointer hover:border-primary transition-colors">
                    <CardHeader>
                      <CardTitle className="flex items-center justify-between">
                        <div className="flex items-center gap-2 truncate">
                          <AgentIcon className="h-5 w-5 text-gray-500" />
                          <span className="truncate">{doc.title}</span>
                        </div>
                        <ChevronRight className="h-4 w-4 text-gray-400" />
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
                </Link>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}