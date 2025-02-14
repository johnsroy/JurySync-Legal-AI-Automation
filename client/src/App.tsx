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
import { ErrorBoundary } from "react-error-boundary";

// Global error boundary fallback
function ErrorFallback({ error }: { error: Error }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center">
      <div className="bg-white p-8 rounded-lg shadow-lg max-w-md">
        <h2 className="text-xl font-semibold text-red-600 mb-4">Something went wrong</h2>
        <p className="text-gray-600 mb-4">{error.message}</p>
        <button 
          onClick={() => window.location.reload()}
          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
        >
          Reload application
        </button>
      </div>
    </div>
  );
}

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

      {/* Fallback route */}
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
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <Router />
          <Toaster />
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}