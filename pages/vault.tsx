import { ErrorBoundary } from '@/components/ErrorBoundary';

export default function VaultPageWrapper() {
  return (
    <ErrorBoundary>
      <VaultPage />
    </ErrorBoundary>
  );
} 