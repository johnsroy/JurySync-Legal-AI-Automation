import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "./components/ui/toaster";
import { AuthProvider } from "./hooks/use-auth";
import Layout from "./components/Layout";
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
import WorkflowAutomation from "@/pages/workflow-automation";
import VaultPage from "@/pages/vault-page";
import { ProtectedRoute } from "./lib/protected-route";

function Router() {
  return (
    <Switch>
      {/* Public routes */}
      <Route path="/" component={LandingPage} />
      <Route path="/login" component={LoginPage} />
      <Route path="/register" component={RegisterPage} />
      <Route path="/pricing" component={PricingPage} />
      <Route path="/subscription" component={SubscriptionPage} />

      {/* Protected routes with Layout */}
      <Route path="/dashboard">
        <Layout>
          <Dashboard />
        </Layout>
      </Route>

      <Route path="/vault">
        <Layout>
          <VaultPage />
        </Layout>
      </Route>

      <Route path="/workflow">
        <Layout>
          <WorkflowPage />
        </Layout>
      </Route>

      <Route path="/workflow-automation">
        <Layout>
          <WorkflowAutomation />
        </Layout>
      </Route>

      <Route path="/compliance-auditing">
        <Layout>
          <ComplianceAuditing />
        </Layout>
      </Route>

      <Route path="/contract-automation">
        <Layout>
          <ContractAutomation />
        </Layout>
      </Route>

      <Route path="/legal-research">
        <Layout>
          <LegalResearch />
        </Layout>
      </Route>

      <Route path="/reports">
        <Layout>
          <Reports />
        </Layout>
      </Route>

      <Route path="/analytics">
        <Layout>
          <ReportsDashboard />
        </Layout>
      </Route>

      <Route path="/settings">
        <Layout>
          <Settings />
        </Layout>
      </Route>

      <Route>
        <Layout>
          <NotFound />
        </Layout>
      </Route>
    </Switch>
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