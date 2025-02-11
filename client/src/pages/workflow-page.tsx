import { useState } from "react";
import { useRouter } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ContractRedlining } from "@/components/ContractRedlining/ContractRedlining";
import { WorkflowIntegration } from "@/components/ContractRedlining/WorkflowIntegration";
import {
  FileText,
  CheckCircle2,
  AlertTriangle,
  Clock,
  BarChart3,
  Download,
  RefreshCw,
  Eye
} from "lucide-react";

// Workflow stages with their respective icons and status
const workflowStages = [
  { id: "draft", label: "Draft Generation", icon: FileText },
  { id: "compliance", label: "Compliance Review", icon: CheckCircle2 },
  { id: "legal", label: "Legal Research", icon: AlertTriangle },
  { id: "approval", label: "Approval", icon: Clock },
  { id: "audit", label: "Periodic Audit", icon: BarChart3 }
];

// Analytics metrics
const metrics = [
  { label: "Tasks Automated", value: "80%", description: "Increased efficiency" },
  { label: "Processing Time", value: "70%", description: "Time reduction" },
  { label: "Labor Cost", value: "30-50%", description: "Cost savings" },
  { label: "Error Reduction", value: "60%", description: "Improved accuracy" }
];

export default function WorkflowPage() {
  const [currentStage, setCurrentStage] = useState(0);
  const [uploadedContent, setUploadedContent] = useState("");
  const [currentVersionId, setCurrentVersionId] = useState(1);

  const handleContentUpdate = (newContent: string) => {
    setUploadedContent(newContent);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <nav className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <img src="/logo.svg" alt="JurySync" className="h-8 w-8" />
              <span className="text-xl font-bold">JurySync</span>
            </div>
            <div className="hidden md:flex space-x-6">
              <Button variant="ghost">Dashboard</Button>
              <Button variant="ghost">Contract Automation</Button>
              <Button variant="ghost">Compliance Audit</Button>
              <Button variant="ghost">Legal Research</Button>
            </div>
          </nav>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Workflow Progress Tracker */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold mb-4">Workflow Progress</h2>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {workflowStages.map((stage, index) => {
              const Icon = stage.icon;
              const isComplete = index < currentStage;
              const isCurrent = index === currentStage;

              return (
                <div
                  key={stage.id}
                  className={`flex flex-col items-center p-4 rounded-lg border ${
                    isCurrent ? "border-primary bg-primary/5" : 
                    isComplete ? "border-green-500 bg-green-50" : "border-gray-200"
                  }`}
                >
                  <Icon className={`h-6 w-6 ${
                    isCurrent ? "text-primary" :
                    isComplete ? "text-green-500" : "text-gray-400"
                  }`} />
                  <span className="text-sm mt-2 text-center">{stage.label}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Central Display Area */}
        <div className="grid gap-8 grid-cols-1 lg:grid-cols-3">
          {/* Document Editor and Analysis */}
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Contract Analysis</CardTitle>
              </CardHeader>
              <CardContent>
                <ContractRedlining 
                  initialContent={uploadedContent} 
                  onUpdate={handleContentUpdate} 
                />
              </CardContent>
            </Card>

            <WorkflowIntegration 
              contractId={1} 
              currentVersion={currentVersionId} 
            />
          </div>

          {/* Analytics and Actions */}
          <div className="space-y-6">
            {/* Analytics */}
            <Card>
              <CardHeader>
                <CardTitle>Workflow Analytics</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {metrics.map((metric) => (
                  <div key={metric.label} className="flex justify-between items-center p-2 bg-muted/50 rounded">
                    <div>
                      <p className="font-medium">{metric.label}</p>
                      <p className="text-sm text-muted-foreground">{metric.description}</p>
                    </div>
                    <span className="text-xl font-bold text-primary">{metric.value}</span>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Actions */}
            <Card>
              <CardHeader>
                <CardTitle>Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button className="w-full gap-2" variant="outline">
                  <RefreshCw className="h-4 w-4" />
                  Retry Process
                </Button>
                <Button className="w-full gap-2" variant="outline">
                  <Eye className="h-4 w-4" />
                  View Details
                </Button>
                <Button className="w-full gap-2">
                  <Download className="h-4 w-4" />
                  Download Report
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t mt-16 bg-card">
        <div className="container mx-auto px-4 py-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div>
              <div className="flex items-center space-x-2">
                <img src="/logo.svg" alt="JurySync" className="h-6 w-6" />
                <span className="font-bold">JurySync</span>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                Transforming legal workflows with intelligent automation
              </p>
            </div>
            <div>
              <h3 className="font-medium mb-2">Contact</h3>
              <p className="text-sm text-muted-foreground">support@jurysync.com</p>
              <p className="text-sm text-muted-foreground">1-800-JURYSYNC</p>
            </div>
            <div>
              <h3 className="font-medium mb-2">Support</h3>
              <div className="space-y-1">
                <Button variant="link" className="p-0 h-auto text-sm">Help Center</Button>
                <br />
                <Button variant="link" className="p-0 h-auto text-sm">Documentation</Button>
                <br />
                <Button variant="link" className="p-0 h-auto text-sm">API Reference</Button>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
