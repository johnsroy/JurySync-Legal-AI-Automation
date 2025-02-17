import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Book, Download, FileText, Scale } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface LegalAnalysis {
  executiveSummary: string;
  legalPrinciples: {
    principle: string;
    explanation: string;
    relevance: string;
  }[];
  precedents: {
    case: string;
    citation: string;
    relevance: string;
    holding: string;
  }[];
  recommendations: {
    suggestion: string;
    rationale: string;
    priority: 'HIGH' | 'MEDIUM' | 'LOW';
  }[];
  riskAreas: {
    area: string;
    description: string;
    severity: 'HIGH' | 'MEDIUM' | 'LOW';
  }[];
}

interface LegalResearchPanelProps {
  documentContent: string;
  isLoading: boolean;
  onAnalyze: () => void;
}

export function LegalResearchPanel({ documentContent, isLoading, onAnalyze }: LegalResearchPanelProps) {
  const [analysis, setAnalysis] = useState<LegalAnalysis | null>(null);
  const { toast } = useToast();

  const handleAnalyze = async () => {
    if (!documentContent) {
      toast({
        title: "No Document",
        description: "Please upload a document first",
        variant: "destructive"
      });
      return;
    }

    try {
      onAnalyze();
      const response = await fetch("/api/legal-research/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: documentContent })
      });

      if (!response.ok) throw new Error("Analysis failed");
      const data = await response.json();
      setAnalysis(data);
    } catch (error) {
      toast({
        title: "Analysis Error",
        description: "Failed to analyze document",
        variant: "destructive"
      });
    }
  };

  return (
    <div className="space-y-6">
      <Card className="bg-white">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Book className="h-5 w-5 text-primary" />
            Legal Research & Analysis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Button 
            onClick={handleAnalyze}
            disabled={isLoading || !documentContent}
            className="w-full mb-6"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Analyzing Document...
              </>
            ) : (
              <>
                <Scale className="h-4 w-4 mr-2" />
                Analyze Document
              </>
            )}
          </Button>

          {analysis && (
            <div className="space-y-6">
              {/* Executive Summary */}
              <section className="bg-gray-50 p-4 rounded-lg">
                <h3 className="text-lg font-semibold text-gray-800 mb-2">
                  Executive Summary
                </h3>
                <p className="text-gray-700">{analysis.executiveSummary}</p>
              </section>

              {/* Legal Principles */}
              <section>
                <h3 className="text-lg font-semibold text-gray-800 mb-3">
                  Key Legal Principles
                </h3>
                <div className="space-y-4">
                  {analysis.legalPrinciples.map((principle, index) => (
                    <div key={index} className="bg-white p-4 rounded-lg border">
                      <h4 className="font-medium text-gray-800">{principle.principle}</h4>
                      <p className="text-gray-600 mt-1">{principle.explanation}</p>
                      <p className="text-gray-500 mt-2 text-sm">
                        Relevance: {principle.relevance}
                      </p>
                    </div>
                  ))}
                </div>
              </section>

              {/* Precedents */}
              <section>
                <h3 className="text-lg font-semibold text-gray-800 mb-3">
                  Relevant Precedents
                </h3>
                <div className="space-y-4">
                  {analysis.precedents.map((precedent, index) => (
                    <div key={index} className="bg-white p-4 rounded-lg border">
                      <h4 className="font-medium text-gray-800">{precedent.case}</h4>
                      <p className="text-gray-500 text-sm">{precedent.citation}</p>
                      <p className="text-gray-600 mt-2">{precedent.holding}</p>
                      <p className="text-gray-500 mt-2 text-sm">
                        Relevance: {precedent.relevance}
                      </p>
                    </div>
                  ))}
                </div>
              </section>

              {/* Recommendations */}
              <section>
                <h3 className="text-lg font-semibold text-gray-800 mb-3">
                  Recommendations
                </h3>
                <div className="space-y-4">
                  {analysis.recommendations.map((rec, index) => (
                    <div key={index} className="bg-white p-4 rounded-lg border">
                      <div className="flex justify-between items-start">
                        <h4 className="font-medium text-gray-800">{rec.suggestion}</h4>
                        <span className={`px-2 py-1 rounded text-xs ${
                          rec.priority === 'HIGH' 
                            ? 'bg-red-100 text-red-800'
                            : rec.priority === 'MEDIUM'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-green-100 text-green-800'
                        }`}>
                          {rec.priority} Priority
                        </span>
                      </div>
                      <p className="text-gray-600 mt-2">{rec.rationale}</p>
                    </div>
                  ))}
                </div>
              </section>

              {/* Risk Areas */}
              <section>
                <h3 className="text-lg font-semibold text-gray-800 mb-3">
                  Risk Assessment
                </h3>
                <div className="space-y-4">
                  {analysis.riskAreas.map((risk, index) => (
                    <div key={index} className="bg-white p-4 rounded-lg border">
                      <div className="flex justify-between items-start">
                        <h4 className="font-medium text-gray-800">{risk.area}</h4>
                        <span className={`px-2 py-1 rounded text-xs ${
                          risk.severity === 'HIGH' 
                            ? 'bg-red-100 text-red-800'
                            : risk.severity === 'MEDIUM'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-green-100 text-green-800'
                        }`}>
                          {risk.severity} Risk
                        </span>
                      </div>
                      <p className="text-gray-600 mt-2">{risk.description}</p>
                    </div>
                  ))}
                </div>
              </section>

              <Button className="w-full" onClick={() => {/* Implement PDF export */}}>
                <Download className="h-4 w-4 mr-2" />
                Export Analysis Report
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
} 