import * as React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { useAuthStore } from '../stores/auth-store';
import { OfflineBanner } from '../components/layout/OfflineBanner';
import { ErrorBoundary } from '../components/ui/ErrorBoundary';
import { ApiError } from '../lib/api/client';

import { SessionExpiredListener } from '../components/auth/SessionExpiredToast';
import { SessionMonitor } from '../hooks/useSessionMonitor';

interface ProvidersProps {
  children: React.ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  const [queryClient] = React.useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            retry: (failureCount, error) => {
              if (failureCount >= 2) return false;
              if (error instanceof ApiError) {
                // Do not retry 4xx client errors (401, 403, 404, etc.)
                if (error.status >= 400 && error.status < 500) return false;
              }
              return true;
            },
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  const hydrate = useAuthStore((state) => state.hydrate);
  const recordActivity = useAuthStore((state) => state.recordActivity);

  React.useEffect(() => {
    hydrate();
  }, [hydrate]);

  // Throttled user activity tracker (updates lastActivityAt at most once every 30s)
  React.useEffect(() => {
    let lastRecorded = Date.now();
    const handleActivity = () => {
      const now = Date.now();
      if (now - lastRecorded >= 30_000) {
        lastRecorded = now;
        recordActivity();
      }
    };

    const events = ['mousedown', 'keydown', 'scroll', 'touchstart'] as const;
    events.forEach((evt) => window.addEventListener(evt, handleActivity, { passive: true }));
    return () => {
      events.forEach((evt) => window.removeEventListener(evt, handleActivity));
    };
  }, [recordActivity]);

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <OfflineBanner />
        <SessionExpiredListener />
        <SessionMonitor />
        {children}
        <Toaster position="top-right" richColors closeButton />
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
