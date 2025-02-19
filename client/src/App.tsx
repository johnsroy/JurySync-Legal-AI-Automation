import { Route, Switch } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider } from "./hooks/use-auth";
import Layout from "@/components/Layout";
import NotFound from "./pages/not-found";
import LandingPage from "./pages/landing-page";
import LoginPage from "./pages/login-page";
import RegisterPage from "./pages/register-page";
import PricingPage from "./pages/pricing-page";
import SubscriptionPage from "./pages/subscription-page";
import Dashboard from "./pages/dashboard";
import ComplianceAuditing from "./pages/compliance-auditing";
import ContractAutomation from "./pages/contract-automation";
import LegalResearch from "./pages/legal-research";
import Reports from "./pages/reports";
import ReportsDashboard from "./pages/reports-dashboard";
import Settings from "./pages/settings";
import WorkflowPage from "./pages/workflow-page";
import WorkflowAutomation from "./pages/workflow-automation";
import VaultPage from "./pages/vault-page";
import { ProtectedRoute } from "@/components/protected-route";
import { FC } from "react";
import Redline from "./pages/redline";
import SubscriptionSuccess from "./pages/subscription-success";
import SubscriptionCancel from "./pages/subscription-cancel";

const Router: FC = () => {
  return (
    <Switch>
      {/* Public routes */}
      <Route path="/" component={LandingPage} />
      <Route path="/login" component={LoginPage} />
      <Route path="/register" component={RegisterPage} />
      <Route path="/pricing" component={PricingPage} />
      <Route path="/subscription" component={SubscriptionPage} />
      <Route path="/subscription/success" component={SubscriptionSuccess} />
      <Route path="/subscription/cancel" component={SubscriptionCancel} />

      {/* Protected routes */}
      <Route path="/dashboard">
        <Layout>
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        </Layout>
      </Route>

      <Route path="/vault">
        <Layout>
          <ProtectedRoute>
            <VaultPage />
          </ProtectedRoute>
        </Layout>
      </Route>

      <Route path="/workflow">
        <Layout>
          <ProtectedRoute>
            <WorkflowPage />
          </ProtectedRoute>
        </Layout>
      </Route>

      <Route path="/workflow-automation">
        <Layout>
          <ProtectedRoute>
            <WorkflowAutomation />
          </ProtectedRoute>
        </Layout>
      </Route>

      <Route path="/compliance-auditing">
        <Layout>
          <ProtectedRoute>
            <ComplianceAuditing />
          </ProtectedRoute>
        </Layout>
      </Route>

      <Route path="/contract-automation">
        <Layout>
          <ProtectedRoute>
            <ContractAutomation />
          </ProtectedRoute>
        </Layout>
      </Route>

      <Route path="/legal-research">
        <Layout>
          <ProtectedRoute>
            <LegalResearch />
          </ProtectedRoute>
        </Layout>
      </Route>

      <Route path="/reports">
        <Layout>
          <ProtectedRoute>
            <Reports />
          </ProtectedRoute>
        </Layout>
      </Route>

      <Route path="/analytics">
        <Layout>
          <ProtectedRoute>
            <ReportsDashboard />
          </ProtectedRoute>
        </Layout>
      </Route>

      <Route path="/settings">
        <Layout>
          <ProtectedRoute>
            <Settings />
          </ProtectedRoute>
        </Layout>
      </Route>

      <Route path="/redline">
        <Layout>
          <ProtectedRoute>
            <Redline />
          </ProtectedRoute>
        </Layout>
      </Route>

      {/* Catch-all route */}
      <Route>
        <Layout>
          <NotFound />
        </Layout>
      </Route>
    </Switch>
  );
};

const App: FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Router />
        <Toaster />
      </AuthProvider>
    </QueryClientProvider>
  );
};

export default App;