import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider } from "./hooks/use-auth";
import Layout from "@/components/Layout";
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

      {/* Protected routes */}
      <Route path="/dashboard">
        <ProtectedRoute path="/dashboard">
          <Layout>
            <Dashboard />
          </Layout>
        </ProtectedRoute>
      </Route>

      <Route path="/vault">
        <ProtectedRoute path="/vault">
          <Layout>
            <VaultPage />
          </Layout>
        </ProtectedRoute>
      </Route>

      <Route path="/workflow">
        <ProtectedRoute path="/workflow">
          <Layout>
            <WorkflowPage />
          </Layout>
        </ProtectedRoute>
      </Route>

      <Route path="/workflow-automation">
        <ProtectedRoute path="/workflow-automation">
          <Layout>
            <WorkflowAutomation />
          </Layout>
        </ProtectedRoute>
      </Route>

      <Route path="/compliance-auditing">
        <ProtectedRoute path="/compliance-auditing">
          <Layout>
            <ComplianceAuditing />
          </Layout>
        </ProtectedRoute>
      </Route>

      <Route path="/contract-automation">
        <ProtectedRoute path="/contract-automation">
          <Layout>
            <ContractAutomation />
          </Layout>
        </ProtectedRoute>
      </Route>

      <Route path="/legal-research">
        <ProtectedRoute path="/legal-research">
          <Layout>
            <LegalResearch />
          </Layout>
        </ProtectedRoute>
      </Route>

      <Route path="/reports">
        <ProtectedRoute path="/reports">
          <Layout>
            <Reports />
          </Layout>
        </ProtectedRoute>
      </Route>

      <Route path="/analytics">
        <ProtectedRoute path="/analytics">
          <Layout>
            <ReportsDashboard />
          </Layout>
        </ProtectedRoute>
      </Route>

      <Route path="/settings">
        <ProtectedRoute path="/settings">
          <Layout>
            <Settings />
          </Layout>
        </ProtectedRoute>
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