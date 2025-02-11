import { useState, useEffect as ReactuseEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Check, AlertCircle, ChevronRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Suggestion {
  id: string;
  text: string;
  riskScore: number;
  category: string;
  alternatives: string[];
}

interface PredictiveSuggestionsProps {
  selectedText: string;
  onSuggestionSelect: (suggestion: string) => void;
}

export function PredictiveSuggestions({ selectedText, onSuggestionSelect }: PredictiveSuggestionsProps) {
  const { toast } = useToast();
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);

  const getRiskColor = (score: number) => {
    if (score <= 0.3) return "text-green-500";
    if (score <= 0.7) return "text-yellow-500";
    return "text-red-500";
  };

  const getRiskIcon = (score: number) => {
    if (score <= 0.3) return <Check className="h-4 w-4 text-green-500" />;
    if (score <= 0.7) return <AlertCircle className="h-4 w-4 text-yellow-500" />;
    return <AlertTriangle className="h-4 w-4 text-red-500" />;
  };

  // Mock suggestions for development
  const getMockSuggestions = (text: string): Suggestion[] => {
    return [
      {
        id: "1",
        text: "Standard confidentiality clause with strict NDA terms",
        riskScore: 0.2,
        category: "Confidentiality",
        alternatives: [
          "Both parties agree to maintain strict confidentiality of all shared information",
          "Confidential information shall be protected using industry standard measures"
        ]
      },
      {
        id: "2",
        text: "Liability limitation with reasonable caps",
        riskScore: 0.5,
        category: "Liability",
        alternatives: [
          "Liability shall be limited to the total contract value",
          "Each party's liability shall not exceed direct damages"
        ]
      }
    ];
  };

  // Fetch suggestions whenever selectedText changes
  ReactuseEffect(() => {
    async function fetchSuggestions() {
      if (!selectedText.trim()) {
        setSuggestions([]);
        return;
      }

      setLoading(true);
      try {
        // Use mock suggestions for development
        const mockSuggestions = getMockSuggestions(selectedText);
        setSuggestions(mockSuggestions);
      } catch (error) {
        console.error('Error fetching suggestions:', error);
        toast({
          title: "Error",
          description: "Failed to load suggestions. Please try again.",
          variant: "destructive",
        });
        setSuggestions([]); // Reset suggestions on error
      } finally {
        setLoading(false);
      }
    }

    // Add a small delay to prevent rapid API calls during text selection
    const timeoutId = setTimeout(fetchSuggestions, 500);
    return () => clearTimeout(timeoutId);
  }, [selectedText, toast]);

  return (
    <Card className="w-full bg-card">
      <CardHeader>
        <CardTitle className="text-lg">Predictive Suggestions</CardTitle>
        <CardDescription>
          AI-powered clause suggestions based on historical data
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : suggestions.length > 0 ? (
          suggestions.map((suggestion) => (
            <div
              key={suggestion.id}
              className="border rounded-lg p-4 space-y-2 hover:border-primary transition-colors"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {getRiskIcon(suggestion.riskScore)}
                  <span className="font-medium">{suggestion.category}</span>
                </div>
                <span className={`font-medium ${getRiskColor(suggestion.riskScore)}`}>
                  Risk Score: {(suggestion.riskScore * 100).toFixed(0)}%
                </span>
              </div>
              <p className="text-sm text-muted-foreground">{suggestion.text}</p>
              <div className="space-y-2">
                <p className="text-sm font-medium">Alternative Clauses:</p>
                {suggestion.alternatives.map((alt, index) => (
                  <Button
                    key={index}
                    variant="outline"
                    className="w-full justify-between text-left"
                    onClick={() => onSuggestionSelect(alt)}
                  >
                    <span className="truncate">{alt}</span>
                    <ChevronRight className="h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                ))}
              </div>
            </div>
          ))
        ) : (
          <div className="text-center py-4 text-muted-foreground">
            <p>Select text in the document to view suggestions</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}