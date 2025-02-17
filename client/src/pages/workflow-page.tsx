import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
  Eye,
  ClipboardCheck,
  FileSignature
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

export function WorkflowPage() {
  const [currentStage, setCurrentStage] = useState(0);
  const [uploadedContent, setUploadedContent] = useState("");
  const [currentVersionId, setCurrentVersionId] = useState(1);

  const handleContentUpdate = (newContent: string) => {
    setUploadedContent(newContent);
  };

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-900/80 backdrop-blur-lg">
        <div className="container mx-auto px-4 py-4">
          <nav className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <img src="/logo.svg" alt="JurySync" className="h-8 w-8" />
              <span className="text-xl font-bold text-white">JurySync</span>
            </div>
            <div className="hidden md:flex space-x-6">
              <Button variant="ghost" className="text-gray-300 hover:text-white hover:bg-gray-800">Dashboard</Button>
              <Button variant="ghost" className="text-gray-300 hover:text-white hover:bg-gray-800">Contract Automation</Button>
              <Button variant="ghost" className="text-gray-300 hover:text-white hover:bg-gray-800">Compliance Audit</Button>
              <Button variant="ghost" className="text-gray-300 hover:text-white hover:bg-gray-800">Legal Research</Button>
            </div>
          </nav>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Workflow Progress Tracker */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold mb-4 text-white">Workflow Progress</h2>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {workflowStages.map((stage, index) => {
              const Icon = stage.icon;
              const isComplete = index < currentStage;
              const isCurrent = index === currentStage;

              return (
                <div
                  key={stage.id}
                  className={`flex flex-col items-center p-4 rounded-lg border ${
                    isCurrent ? "border-emerald-500 bg-emerald-500/10" : 
                    isComplete ? "border-emerald-500/50 bg-emerald-900/20" : "border-gray-800 bg-gray-800/50"
                  }`}
                >
                  <Icon className={`h-6 w-6 ${
                    isCurrent ? "text-emerald-400" :
                    isComplete ? "text-emerald-500" : "text-gray-400"
                  }`} />
                  <span className="text-sm mt-2 text-center text-gray-300">{stage.label}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Central Display Area */}
        <div className="grid gap-8 grid-cols-1 lg:grid-cols-3">
          {/* Document Editor and Analysis */}
          <div className="lg:col-span-2 space-y-6">
            <Card className="bg-gray-800/50 border-gray-700">
              <CardHeader>
                <CardTitle className="text-white">Contract Analysis</CardTitle>
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
            <Card className="bg-gray-800/50 border-gray-700">
              <CardHeader>
                <CardTitle className="text-white">Workflow Analytics</CardTitle>
                <CardDescription className="text-gray-400">Real-time performance metrics</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {metrics.map((metric) => (
                  <div key={metric.label} className="flex justify-between items-center p-2 bg-gray-900/50 rounded">
                    <div>
                      <p className="font-medium text-gray-200">{metric.label}</p>
                      <p className="text-sm text-gray-400">{metric.description}</p>
                    </div>
                    <span className="text-xl font-bold text-emerald-400">{metric.value}</span>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Actions */}
            <Card className="bg-gray-800/50 border-gray-700">
              <CardHeader>
                <CardTitle className="text-white">Actions</CardTitle>
                <CardDescription className="text-gray-400">Available workflow actions</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button className="w-full gap-2 bg-gray-700 hover:bg-gray-600 text-gray-200">
                  <RefreshCw className="h-4 w-4" />
                  Retry Process
                </Button>
                <Button className="w-full gap-2 bg-gray-700 hover:bg-gray-600 text-gray-200">
                  <Eye className="h-4 w-4" />
                  View Details
                </Button>
                <Button className="w-full gap-2 bg-emerald-600 hover:bg-emerald-700 text-white">
                  <Download className="h-4 w-4" />
                  Download Report
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-800 mt-16 bg-gray-900/80">
        <div className="container mx-auto px-4 py-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div>
              <div className="flex items-center space-x-2">
                <img src="/logo.svg" alt="JurySync" className="h-6 w-6" />
                <span className="font-bold text-white">JurySync</span>
              </div>
              <p className="mt-2 text-sm text-gray-400">
                Transforming legal workflows with intelligent automation
              </p>
            </div>
            <div>
              <h3 className="font-medium mb-2 text-gray-200">Contact</h3>
              <p className="text-sm text-gray-400">support@jurysync.com</p>
              <p className="text-sm text-gray-400">1-800-JURYSYNC</p>
            </div>
            <div>
              <h3 className="font-medium mb-2 text-gray-200">Support</h3>
              <div className="space-y-1">
                <Button variant="link" className="p-0 h-auto text-sm text-gray-400 hover:text-white">Help Center</Button>
                <br />
                <Button variant="link" className="p-0 h-auto text-sm text-gray-400 hover:text-white">Documentation</Button>
                <br />
                <Button variant="link" className="p-0 h-auto text-sm text-gray-400 hover:text-white">API Reference</Button>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default WorkflowPage;