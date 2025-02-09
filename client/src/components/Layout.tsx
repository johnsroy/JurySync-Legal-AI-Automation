import { Link, useLocation } from "wouter";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarProvider,
} from "@/components/ui/sidebar";
import { BarChart2, Book, FileText, GitMerge, LayoutDashboard, Scale, Terminal } from "lucide-react";

export default function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  return (
    <SidebarProvider defaultOpen>
      <div className="flex min-h-screen">
        <Sidebar>
          <SidebarHeader>
            <div className="flex items-center gap-2 px-4 py-2">
              <GitMerge className="h-6 w-6" />
              <span className="font-semibold">LegalAI</span>
            </div>
          </SidebarHeader>
          <SidebarContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={location === "/dashboard"}
                  tooltip="Dashboard"
                >
                  <Link href="/dashboard" className="flex items-center">
                    <LayoutDashboard className="mr-2" />
                    Dashboard
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>

              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={location === "/contract-automation"}
                  tooltip="Contract Automation"
                >
                  <Link href="/contract-automation" className="flex items-center">
                    <FileText className="mr-2" />
                    Contract Automation
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>

              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={location === "/compliance-auditing"}
                  tooltip="Compliance"
                >
                  <Link href="/compliance-auditing" className="flex items-center">
                    <Scale className="mr-2" />
                    Compliance
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>

              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={location === "/legal-research"}
                  tooltip="Research"
                >
                  <Link href="/legal-research" className="flex items-center">
                    <Book className="mr-2" />
                    Legal Research
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>

              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={location === "/orchestrator"}
                  tooltip="Orchestrator"
                >
                  <Link href="/orchestrator" className="flex items-center">
                    <Terminal className="mr-2" />
                    Orchestrator
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarContent>
        </Sidebar>
        <main className="flex-1 p-6">{children}</main>
      </div>
    </SidebarProvider>
  );
}