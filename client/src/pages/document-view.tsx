import { useDocument } from "@/hooks/use-documents";
import { Link, useParams } from "wouter";
import { DocumentAnalysis } from "@shared/schema";
import {
  Card,
  CardContent,
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
} from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export default function DocumentView() {
  const { id } = useParams();
  const { data: document, isLoading } = useDocument(id || "");

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!document || !document.analysis) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <Card className="max-w-2xl mx-auto">
          <CardContent className="p-6">
            <div className="text-center">
              <AlertTriangle className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-semibold text-gray-900">
                Document not found
              </h3>
              <p className="mt-1 text-sm text-gray-500">
                This document may have been deleted or you may not have permission
                to view it.
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

  // Validate analysis data
  if (!analysis || !analysis.summary || !analysis.keyPoints || !analysis.suggestions || typeof analysis.riskScore !== 'number') {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <Card className="max-w-2xl mx-auto">
          <CardContent className="p-6">
            <div className="text-center">
              <AlertTriangle className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-semibold text-gray-900">
                Error Loading Document
              </h3>
              <p className="mt-1 text-sm text-gray-500">
                There was an error loading the document analysis. Please try again later.
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
                    {new Date(document.createdAt || "").toLocaleDateString("en-US", {
                      month: "long",
                      day: "numeric",
                      year: "numeric",
                    })}
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
              <div className="prose max-w-none">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Document Content
                </h3>
                <div className="mt-2 p-4 bg-gray-50 rounded-lg whitespace-pre-wrap">
                  {document.content}
                </div>

                <Separator className="my-6" />

                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Bookmark className="h-5 w-5" />
                  Legal Analysis
                </h3>
                <div className="mt-4 space-y-4">
                  <div>
                    <h4 className="font-medium text-gray-900">Executive Summary</h4>
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
                              className="flex items-center gap-2 text-gray-600"
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
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}