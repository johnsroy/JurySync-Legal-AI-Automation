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
import Dashboard from "@/pages/dashboard";
import ComplianceAuditing from "@/pages/compliance-auditing";
import ContractAutomation from "@/pages/contract-automation";
import LegalResearch from "@/pages/legal-research";
import Reports from "@/pages/reports";
import Settings from "@/pages/settings";
import WorkflowAutomation from "@/pages/WorkflowAutomation";
import { ProtectedRoute } from "./lib/protected-route";

function Router() {
  return (
    <Switch>
      {/* Public routes */}
      <Route path="/" component={LandingPage} />
      <Route path="/login" component={LoginPage} />
      <Route path="/register" component={RegisterPage} />

      {/* Protected routes with Layout */}
      <Route path="/dashboard">
        <Layout>
          <ProtectedRoute component={Dashboard} path="/dashboard" />
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

      <Route path="/settings">
        <Layout>
          <ProtectedRoute component={Settings} path="/settings" />
        </Layout>
      </Route>

      <Route path="/workflow-automation">
        <Layout>
          <ProtectedRoute component={WorkflowAutomation} path="/workflow-automation" />
        </Layout>
      </Route>

      <Route component={NotFound} />
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