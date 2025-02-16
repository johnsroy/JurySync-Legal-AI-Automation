import { useAuth } from '../hooks/use-auth';
import { Redirect } from 'wouter';
import { ComponentType } from 'react';

interface ProtectedRouteProps {
  component: ComponentType;
  path: string;
}

export function ProtectedRoute({ component: Component, path }: ProtectedRouteProps) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (!user) {
    return <Redirect to="/login" />;
  }

  return <Component />;
}
