import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { 
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Minus,
  Clock,
  DollarSign
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface RiskFactors {
  regulatory: number;
  contractual: number;
  litigation: number;
  operational: number;
}

interface RiskAssessment {
  score: number;
  severity: string;
  category: string;
  description: string;
  impact: string;
  confidence: number;
  riskFactors?: RiskFactors;
  trendIndicator?: "INCREASING" | "STABLE" | "DECREASING";
  timeToMitigate?: string;
  potentialCost?: string;
}

interface RiskScoringWidgetProps {
  documentId: string;
  assessment: RiskAssessment;
  className?: string;
}

export function RiskScoringWidget({
  documentId,
  assessment,
  className = ""
}: RiskScoringWidgetProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const getTrendIcon = (trend?: string) => {
    switch (trend) {
      case "INCREASING":
        return <TrendingUp className="h-4 w-4 text-red-500" />;
      case "DECREASING":
        return <TrendingDown className="h-4 w-4 text-green-500" />;
      default:
        return <Minus className="h-4 w-4 text-gray-500" />;
    }
  };

  const getSeverityColor = (score: number) => {
    if (score >= 80) return "text-red-500 bg-red-50";
    if (score >= 60) return "text-orange-500 bg-orange-50";
    if (score >= 40) return "text-yellow-500 bg-yellow-50";
    return "text-green-500 bg-green-50";
  };

  return (
    <Card className={`${className} overflow-hidden transition-all duration-200`}>
      <CardHeader className="bg-white/60 backdrop-blur-sm border-b">
        <CardTitle className="text-lg flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className={`h-5 w-5 ${
              assessment.severity === "CRITICAL" ? "text-red-500" :
              assessment.severity === "HIGH" ? "text-orange-500" :
              assessment.severity === "MEDIUM" ? "text-yellow-500" :
              "text-green-500"
            }`} />
            Risk Assessment
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-sm font-normal px-2 py-1 rounded-full ${getSeverityColor(assessment.score)}`}>
              Score: {assessment.score}/100
            </span>
            {getTrendIcon(assessment.trendIndicator)}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 space-y-4">
        {/* Risk Factors */}
        {assessment.riskFactors && (
          <div className="space-y-3">
            <h4 className="font-medium text-sm text-gray-700">Risk Breakdown</h4>
            <div className="space-y-2">
              {Object.entries(assessment.riskFactors).map(([factor, score]) => (
                <div key={factor} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="capitalize">{factor}</span>
                    <span>{score}%</span>
                  </div>
                  <Progress value={score} className="h-2" />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Additional Metrics */}
        <div className="grid grid-cols-2 gap-4 pt-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="h-4 w-4 text-blue-500" />
                  <span className="text-gray-600">{assessment.timeToMitigate || "N/A"}</span>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>Estimated time to mitigate risk</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-2 text-sm">
                  <DollarSign className="h-4 w-4 text-green-500" />
                  <span className="text-gray-600">{assessment.potentialCost || "N/A"}</span>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>Potential financial impact</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        {/* Description and Impact */}
        <div className="pt-2 space-y-2">
          <p className="text-sm text-gray-700">
            <span className="font-medium">Description:</span> {assessment.description}
          </p>
          <p className="text-sm text-gray-700">
            <span className="font-medium">Impact:</span> {assessment.impact}
          </p>
        </div>

        {/* Confidence Score */}
        <div className="pt-2 flex items-center justify-between text-sm">
          <span className="text-gray-600">AI Confidence Score</span>
          <span className={`px-2 py-1 rounded-full ${
            assessment.confidence >= 80 ? "bg-green-50 text-green-700" :
            assessment.confidence >= 60 ? "bg-yellow-50 text-yellow-700" :
            "bg-red-50 text-red-700"
          }`}>
            {assessment.confidence}%
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
