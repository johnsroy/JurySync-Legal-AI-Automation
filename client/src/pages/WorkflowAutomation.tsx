import { Link } from "wouter";
import { Card } from "@/components/ui/card";
import {
  BookCheck,
  Scale,
  FileText,
  History,
  BarChart2,
  Workflow,
  ChevronsRight
} from "lucide-react";

export default function WorkflowAutomation() {
  const modules = [
    { name: 'Compliance Audit', icon: Scale, href: '/compliance-audit' },
    { name: 'Contract Automation', icon: FileText, href: '/contract-automation' },
    { name: 'Legal Research', icon: BookCheck, href: '/legal-research' },
    { name: 'History & Reports', icon: History, href: '/reports' }
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header Section */}
      <header className="border-b">
        <div className="container mx-auto py-8">
          <div className="flex items-center space-x-2 mb-2">
            <Workflow className="h-8 w-8 text-primary" />
            <h1 className="text-4xl font-bold tracking-tight">
              Full Lifecycle Automation Workflow
            </h1>
          </div>
          <p className="text-muted-foreground text-lg mb-8">
            From Draft to Execution – Automating 80% of Legal Compliance Tasks
          </p>

          {/* Navigation Bar */}
          <nav className="flex space-x-4">
            {modules.map((module) => {
              const Icon = module.icon;
              return (
                <Link key={module.name} href={module.href}>
                  <a className="group flex items-center space-x-2 px-4 py-2 rounded-lg hover:bg-accent transition-colors">
                    <Icon className="h-5 w-5 text-muted-foreground group-hover:text-primary" />
                    <span className="text-sm font-medium">{module.name}</span>
                  </a>
                </Link>
              );
            })}
          </nav>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="container mx-auto py-8">
        {/* Content will be added in subsequent iterations */}
      </main>
    </div>
  );
}
