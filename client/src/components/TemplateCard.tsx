import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Template } from "@shared/schema/template-categories";

interface TemplateCardProps {
  template: Template;
  onSelect: () => void;
}

export function TemplateCard({ template, onSelect }: TemplateCardProps) {
  return (
    <Card className="flex flex-col h-full bg-gray-800/50 border-gray-700 hover:border-blue-500/50 transition-colors">
      <CardHeader>
        <CardTitle className="text-xl text-white">{template.name}</CardTitle>
        <CardDescription className="text-gray-400">{template.description}</CardDescription>
      </CardHeader>
      <CardContent className="flex-grow space-y-4">
        <div className="flex items-center justify-between">
          <Badge variant={
            template.metadata.complexity === "LOW" ? "secondary" :
            template.metadata.complexity === "MEDIUM" ? "default" :
            "destructive"
          }>
            {template.metadata.complexity}
          </Badge>
          <span className="text-sm text-gray-400">~{template.metadata.estimatedTime}</span>
        </div>

        <div className="bg-gray-900/50 p-4 rounded-lg border border-gray-700">
          <pre className="whitespace-pre-wrap text-sm text-gray-300 max-h-48 overflow-y-auto">
            {template.baseContent.slice(0, 200)}...
          </pre>
        </div>

        <div className="space-y-2">
          <h4 className="font-semibold text-gray-200">Required Fields:</h4>
          <ul className="space-y-2">
            {template.variables
              .filter(v => v.required)
              .map(v => (
                <li key={v.name} className="flex items-start space-x-2 text-gray-300">
                  <span className="text-emerald-400 mt-1">•</span>
                  <span>{v.description}</span>
                </li>
              ))}
          </ul>
        </div>

        <div className="flex flex-wrap gap-2 mt-4">
          {template.metadata.tags.map((tag) => (
            <Badge key={tag} variant="outline" className="text-gray-300 border-gray-600">
              {tag}
            </Badge>
          ))}
        </div>
      </CardContent>
      <CardFooter>
        <Button
          className="w-full bg-gray-700 hover:bg-gray-600 text-white"
          onClick={onSelect}
        >
          Use This Template
        </Button>
      </CardFooter>
    </Card>
  );
}