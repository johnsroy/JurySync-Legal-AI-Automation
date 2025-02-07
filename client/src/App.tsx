import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider } from "./hooks/use-auth";
import NotFound from "@/pages/not-found";
import LandingPage from "@/pages/landing-page";
import LoginPage from "@/pages/login-page";
import RegisterPage from "@/pages/register-page";
import ProductsPage from "@/pages/products-page";
import PricingPage from "@/pages/pricing-page";
import Dashboard from "@/pages/dashboard";
import ContractAutomation from "@/pages/contract-automation";
import ComplianceAuditing from "@/pages/compliance-auditing";
import LegalResearch from "@/pages/legal-research";
import ReportsDashboard from "@/pages/reports-dashboard";
import { ProtectedRoute } from "./lib/protected-route";

function Router() {
  return (
    <Switch>
      <Route path="/" component={LandingPage} />
      <Route path="/login" component={LoginPage} />
      <Route path="/register" component={RegisterPage} />
      <Route path="/products" component={ProductsPage} />
      <Route path="/pricing" component={PricingPage} />
      <ProtectedRoute path="/dashboard" component={Dashboard} />
      <ProtectedRoute path="/contract-automation" component={ContractAutomation} />
      <ProtectedRoute path="/compliance-auditing" component={ComplianceAuditing} />
      <ProtectedRoute path="/legal-research" component={LegalResearch} />
      <ProtectedRoute path="/reports" component={ReportsDashboard} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
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