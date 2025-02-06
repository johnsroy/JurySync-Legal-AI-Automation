import { useDocument } from "@/hooks/use-documents";
import { Link, useParams } from "wouter";
import { DocumentAnalysis } from "@shared/schema";
import {
  Card,
  CardContent,
  CardFooter,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle,
  FileText,
  Loader2,
  Scale,
  Bookmark,
  Info,
  Send,
  MessageSquare,
} from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { apiRequest } from "@/lib/queryClient";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export default function DocumentView() {
  const { id } = useParams();
  const { data: document, isLoading, error } = useDocument(id || "");
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  async function handleSendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!inputMessage.trim() || !document) return;

    const newUserMessage = { role: "user" as const, content: inputMessage };
    setMessages(prev => [...prev, newUserMessage]);
    setInputMessage("");
    setIsAnalyzing(true);

    try {
      const response = await apiRequest("POST", `/api/documents/${id}/chat`, {
        message: inputMessage,
        context: document.content
      });
      const answer = await response.json();

      setMessages(prev => [...prev, { role: "assistant", content: answer.response }]);
    } catch (error) {
      console.error("Failed to get response:", error);
    } finally {
      setIsAnalyzing(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !document || !document.analysis) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <Card className="max-w-2xl mx-auto">
          <CardContent className="p-6">
            <div className="text-center">
              <AlertTriangle className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-semibold text-gray-900">
                {error ? "Error loading document" : "Document not found"}
              </h3>
              <p className="mt-1 text-sm text-gray-500">
                {error
                  ? "An error occurred while loading the document. Please try again."
                  : "This document may have been deleted or you may not have permission to view it."}
              </p>
              <div className="mt-6">
                <Link href="/">
                  <Button>
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to Dashboard
                  </Button>
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const analysis = document.analysis as DocumentAnalysis;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b">
        <div className="container mx-auto px-4 h-16 flex items-center">
          <Link href="/">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Dashboard
            </Button>
          </Link>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-2xl">{document.title}</CardTitle>
                  <CardDescription>
                    Uploaded{" "}
                    {new Date(document.createdAt || "").toLocaleDateString(
                      "en-US",
                      {
                        month: "long",
                        day: "numeric",
                        year: "numeric",
                      }
                    )}
                  </CardDescription>
                </div>
                <div
                  className={`px-3 py-1 rounded-full text-sm flex items-center gap-2 ${
                    analysis.riskScore > 7
                      ? "bg-red-100 text-red-700"
                      : analysis.riskScore > 4
                      ? "bg-yellow-100 text-yellow-700"
                      : "bg-green-100 text-green-700"
                  }`}
                >
                  <Scale className="h-4 w-4" />
                  Risk Score: {analysis.riskScore}/10
                </div>
              </div>
            </CardHeader>
            <Separator />
            <CardContent className="p-6">
              <Tabs defaultValue="content" className="space-y-4">
                <TabsList>
                  <TabsTrigger value="content">Document Content</TabsTrigger>
                  <TabsTrigger value="analysis">Legal Analysis</TabsTrigger>
                  <TabsTrigger value="risk">Risk Assessment</TabsTrigger>
                </TabsList>

                <TabsContent value="content">
                  <div className="prose max-w-none">
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                      <FileText className="h-5 w-5" />
                      Document Content
                    </h3>
                    <div className="mt-2 p-4 bg-gray-50 rounded-lg whitespace-pre-wrap">
                      {document.content}
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="analysis">
                  <div className="prose max-w-none">
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                      <Bookmark className="h-5 w-5" />
                      Legal Analysis
                    </h3>
                    <div className="mt-4 space-y-4">
                      <div>
                        <h4 className="font-medium text-gray-900">
                          Executive Summary
                        </h4>
                        <p className="mt-1 text-gray-600">{analysis.summary}</p>
                      </div>

                      <Accordion type="single" collapsible className="w-full">
                        <AccordionItem value="key-points">
                          <AccordionTrigger>Key Legal Points</AccordionTrigger>
                          <AccordionContent>
                            <ul className="space-y-2">
                              {analysis.keyPoints.map((point, index) => (
                                <li
                                  key={index}
                                  className="flex items-start gap-2 text-gray-600"
                                >
                                  <CheckCircle className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
                                  {point}
                                </li>
                              ))}
                            </ul>
                          </AccordionContent>
                        </AccordionItem>

                        <AccordionItem value="suggestions">
                          <AccordionTrigger>Legal Recommendations</AccordionTrigger>
                          <AccordionContent>
                            <ul className="space-y-2">
                              {analysis.suggestions.map((suggestion, index) => (
                                <li
                                  key={index}
                                  className="flex items-start gap-2 text-gray-600"
                                >
                                  <AlertTriangle className="h-5 w-5 text-yellow-500 shrink-0 mt-0.5" />
                                  {suggestion}
                                </li>
                              ))}
                            </ul>
                          </AccordionContent>
                        </AccordionItem>
                      </Accordion>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="risk">
                  <div className="prose max-w-none">
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                      <Info className="h-5 w-5" />
                      Risk Score Breakdown
                    </h3>
                    <div className="mt-4 space-y-6">
                      <div>
                        <h4 className="font-medium text-gray-900">How is the Risk Score Calculated?</h4>
                        <p className="mt-2 text-gray-600">
                          The risk score is calculated on a scale of 1-10 based on four key factors:
                        </p>
                        <ul className="mt-2 space-y-2">
                          <li className="flex items-start gap-2">
                            <div className="w-2 h-2 rounded-full bg-green-500 mt-2" />
                            <div>
                              <span className="font-medium">Regulatory Compliance (1-3):</span>
                              <p className="text-gray-600">Assesses adherence to relevant laws, regulations, and industry standards.</p>
                            </div>
                          </li>
                          <li className="flex items-start gap-2">
                            <div className="w-2 h-2 rounded-full bg-yellow-500 mt-2" />
                            <div>
                              <span className="font-medium">Contractual Clarity (4-6):</span>
                              <p className="text-gray-600">Evaluates the clarity, completeness, and enforceability of terms and conditions.</p>
                            </div>
                          </li>
                          <li className="flex items-start gap-2">
                            <div className="w-2 h-2 rounded-full bg-orange-500 mt-2" />
                            <div>
                              <span className="font-medium">Potential Litigation Risk (7-8):</span>
                              <p className="text-gray-600">Identifies potential legal disputes and liability exposure.</p>
                            </div>
                          </li>
                          <li className="flex items-start gap-2">
                            <div className="w-2 h-2 rounded-full bg-red-500 mt-2" />
                            <div>
                              <span className="font-medium">Immediate Action Required (9-10):</span>
                              <p className="text-gray-600">Indicates critical issues requiring immediate legal attention.</p>
                            </div>
                          </li>
                        </ul>
                      </div>

                      <div>
                        <h4 className="font-medium text-gray-900">Current Risk Assessment</h4>
                        <div className="mt-2 p-4 bg-gray-50 rounded-lg">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium">Overall Risk Score</span>
                            <span className={`px-2 py-1 rounded-full text-sm ${
                              analysis.riskScore > 7
                                ? "bg-red-100 text-red-700"
                                : analysis.riskScore > 4
                                ? "bg-yellow-100 text-yellow-700"
                                : "bg-green-100 text-green-700"
                            }`}>
                              {analysis.riskScore}/10
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Interactive Analysis
              </CardTitle>
              <CardDescription>
                Ask questions, request specific analytics, or get custom insights about this document
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px] pr-4">
                <div className="space-y-4">
                  {messages.map((message, index) => (
                    <div
                      key={index}
                      className={`flex ${
                        message.role === "user" ? "justify-end" : "justify-start"
                      }`}
                    >
                      <div
                        className={`max-w-[80%] rounded-lg p-3 ${
                          message.role === "user"
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted"
                        }`}
                      >
                        {message.content}
                      </div>
                    </div>
                  ))}
                  {isAnalyzing && (
                    <div className="flex justify-start">
                      <div className="bg-muted rounded-lg p-3">
                        <Loader2 className="h-5 w-5 animate-spin" />
                      </div>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
            <CardFooter>
              <form onSubmit={handleSendMessage} className="w-full">
                <div className="flex gap-2">
                  <Input
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    placeholder="Ask about specific points, request analytics, or get clarification..."
                    className="flex-1"
                  />
                  <Button type="submit" disabled={isAnalyzing}>
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </form>
            </CardFooter>
          </Card>
        </div>
      </main>
    </div>
  );
}