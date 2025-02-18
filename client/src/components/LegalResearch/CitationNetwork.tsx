import { Card } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { ForceGraph2D } from "react-force-graph";

interface CitationNetworkProps {
  document: any;
  citations: any;
  isLoading: boolean;
}

export function CitationNetwork({ document, citations, isLoading }: CitationNetworkProps) {
  if (isLoading) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span className="ml-2">Loading citation network...</span>
        </div>
      </Card>
    );
  }

  if (!citations) return null;

  const graphData = {
    nodes: [
      { id: document.id, label: document.title, group: 'main' },
      ...citations.citing.map((c: any) => ({ ...c, group: 'citing' })),
      ...citations.cited.map((c: any) => ({ ...c, group: 'cited' }))
    ],
    links: [
      ...citations.citing.map((c: any) => ({
        source: c.id,
        target: document.id,
        value: c.strength
      })),
      ...citations.cited.map((c: any) => ({
        source: document.id,
        target: c.id,
        value: c.strength
      }))
    ]
  };

  return (
    <Card className="p-6">
      <div className="h-[600px]">
        <ForceGraph2D
          graphData={graphData}
          nodeLabel="label"
          nodeColor={node => 
            node.group === 'main' ? '#10B981' :
            node.group === 'citing' ? '#3B82F6' : '#F59E0B'
          }
          linkDirectionalParticles={2}
        />
      </div>
    </Card>
  );
} 