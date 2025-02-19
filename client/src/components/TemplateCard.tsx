import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Template } from "@/types";

interface TemplateCardProps {
  template: Template;
  onSelect: () => void;
}

export function TemplateCard({ template, onSelect }: TemplateCardProps) {
  return (
    <Card className="p-4 space-y-4">
      <div className="flex justify-between items-start">
        <div>
          <h3 className="font-semibold">{template.name}</h3>
          <p className="text-sm text-muted-foreground">{template.description}</p>
        </div>
        <Badge variant={
          template.metadata.complexity === "LOW" ? "secondary" :
          template.metadata.complexity === "MEDIUM" ? "default" :
          "destructive"
        }>
          {template.metadata.complexity}
        </Badge>
      </div>

      <div className="flex flex-wrap gap-2">
        {template.metadata.tags.map((tag) => (
          <Badge key={tag} variant="outline">{tag}</Badge>
        ))}
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium">Required Variables:</p>
        <ul className="text-sm space-y-1">
          {template.metadata.variables.map((variable) => (
            <li key={variable.name} className="flex items-center gap-2">
              <span className="font-mono text-xs">{variable.name}</span>
              {variable.required && (
                <Badge variant="destructive" className="text-xs">Required</Badge>
              )}
            </li>
          ))}
        </ul>
      </div>

      <Button onClick={onSelect} className="w-full">
        Use Template
      </Button>
    </Card>
  );
} 