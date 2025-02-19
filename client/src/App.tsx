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
import { FC } from "react";
import Redline from "@/pages/redline";
import SubscriptionSuccess from "@/pages/subscription-success";
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

      {/* Protected routes with Layout */}
      <Route path="/dashboard">
        <Layout>
          <ProtectedRoute component={Dashboard} path="/dashboard" />
        </Layout>
      </Route>

      <Route path="/vault">
        <Layout>
          <ProtectedRoute component={VaultPage} path="/vault" />
        </Layout>
      </Route>

      <Route path="/workflow">
        <Layout>
          <ProtectedRoute component={WorkflowPage} path="/workflow" />
        </Layout>
      </Route>

      <Route path="/workflow-automation">
        <Layout>
          <ProtectedRoute component={WorkflowAutomation} path="/workflow-automation" />
        </Layout>
      </Route>

      <Route path="/compliance-auditing">
        <Layout>
          <ProtectedRoute component={ComplianceAuditing} path="/compliance-auditing" />
        </Layout>
      </Route>

      <Route path="/contract-automation">
        <Layout>
          <ProtectedRoute component={ContractAutomation} path="/contract-automation" />
        </Layout>
      </Route>

      <Route path="/legal-research">
        <Layout>
          <ProtectedRoute component={LegalResearch} path="/legal-research" />
        </Layout>
      </Route>

      <Route path="/reports">
        <Layout>
          <ProtectedRoute component={Reports} path="/reports" />
        </Layout>
      </Route>

      <Route path="/analytics">
        <Layout>
          <ProtectedRoute component={ReportsDashboard} path="/analytics" />
        </Layout>
      </Route>

      <Route path="/settings">
        <Layout>
          <ProtectedRoute component={Settings} path="/settings" />
        </Layout>
      </Route>

      <Route path="/redline">
        <Layout>
          <ProtectedRoute component={Redline} path="/redline" />
        </Layout>
      </Route>

      <Route path="/subscription/success" component={SubscriptionSuccess} />
      <Route path="/subscription/cancel" component={SubscriptionCancel} />

      <Route>
        <Layout>
          <NotFound />
        </Layout>
      </Route>
    </Switch>
  );
}

const App: FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Router />
        <Toaster />
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;