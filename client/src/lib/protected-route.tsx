import { useAuth } from "@/hooks/use-auth";
import { Route, useLocation } from "wouter";
import { Layout } from "@/components/layout";

export function ProtectedRoute({ component: Component, ...rest }: any) {
  const { user, isLoading } = useAuth();
  const [, setLocation] = useLocation();

  if (isLoading) {
    return null;
  }

  if (!user) {
    setLocation("/login");
    return null;
  }

  return (
    <Layout>
      <Component {...rest} />
    </Layout>
  );
}
