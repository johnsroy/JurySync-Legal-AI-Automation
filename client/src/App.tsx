import { Routes, Route } from "wouter";
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider } from "./hooks/use-auth";
import { Layout } from "@/components/layout";
import NotFound from "@/pages/not-found";
import LandingPage from "@/pages/landing-page";
import LoginPage from "@/pages/login-page";
import RegisterPage from "@/pages/register-page";
import PricingPage from "@/pages/pricing-page";
import SubscriptionPage from "@/pages/subscription-page";
import Dashboard from "@/pages/dashboard";
import ComplianceAuditing from "@/pages/compliance-auditing";
import ContractAutomation from "@/pages/contract-automation";
import LegalResearch from "@/pages/legal-research";
import Reports from "@/pages/reports";
import ReportsDashboard from "@/pages/reports-dashboard";
import Settings from "@/pages/settings";
import WorkflowPage from "@/pages/workflow-page";
import WorkflowAutomation from "@/pages/WorkflowAutomation";
import Vault from "@/pages/vault";
import HistoryReports from "@/pages/history-reports";
import { ProtectedRoute } from "./lib/protected-route";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";

function Router() {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/" component={LandingPage} />
      <Route path="/login" component={LoginPage} />
      <Route path="/register" component={RegisterPage} />
      <Route path="/pricing" component={PricingPage} />
      <Route path="/subscription" component={SubscriptionPage} />

      {/* Protected routes */}
      <Route path="/dashboard">
        <ProtectedRoute component={Dashboard} />
      </Route>
      <Route path="/vault">
        <ProtectedRoute component={Vault} />
      </Route>
      <Route path="/workflow-automation">
        <ProtectedRoute component={WorkflowAutomation} />
      </Route>
      <Route path="/contract-automation">
        <ProtectedRoute component={ContractAutomation} />
      </Route>
      <Route path="/history-reports">
        <ProtectedRoute component={HistoryReports} />
      </Route>
      <Route path="/settings">
        <ProtectedRoute component={Settings} />
      </Route>

      {/* 404 route */}
      <Route>
        <ProtectedRoute component={NotFound} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Router />
        <Toaster />
      </AuthProvider>
    </QueryClientProvider>
  );
}