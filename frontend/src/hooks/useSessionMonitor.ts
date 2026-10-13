import { useEffect, useRef } from 'react';
import { useAuthStore } from '../stores/auth-store';
import { getTimeUntilExpiryMs } from '../lib/api/token-utils';
import { executeTokenRefresh } from '../lib/api/client';
import { toast } from 'sonner';

export function useSessionMonitor() {
  const { accessToken, status, checkIdleTimeout } = useAuthStore();
  const isRefreshingRef = useRef(false);

  useEffect(() => {
    if (status !== 'authenticated' || !accessToken) return;

    const checkSession = async () => {
      // 1. Check idle timeout
      if (checkIdleTimeout()) {
        return;
      }

      const timeUntilExpiry = getTimeUntilExpiryMs(accessToken);
      if (timeUntilExpiry === null) return;

      // 2. Proactive refresh when < 90s remaining
      if (timeUntilExpiry > 0 && timeUntilExpiry < 90_000) {
        if (!isRefreshingRef.current) {
          isRefreshingRef.current = true;
          try {
            await executeTokenRefresh();
          } catch {
            // Handled inside executeTokenRefresh
          } finally {
            isRefreshingRef.current = false;
          }
        }
        return;
      }

      // 3. Token already expired: attempt immediate refresh or dispatch expiry
      if (timeUntilExpiry <= 0) {
        if (!isRefreshingRef.current) {
          isRefreshingRef.current = true;
          try {
            const newToken = await executeTokenRefresh();
            if (!newToken) {
              const currentPath =
                typeof window !== 'undefined'
                  ? window.location.pathname + window.location.search
                  : '/';
              if (typeof window !== 'undefined') {
                sessionStorage.setItem('orvio_redirect_after_login', currentPath);
                window.dispatchEvent(
                  new CustomEvent('orvio:auth:session-expired', {
                    detail: { redirectPath: currentPath },
                  })
                );
              }
            }
          } catch {
            // Handled
          } finally {
            isRefreshingRef.current = false;
          }
        }
        return;
      }

      // 4. Warning toast if within 2 minutes but >= 90s
      if (timeUntilExpiry < 2 * 60 * 1000 && timeUntilExpiry >= 90_000) {
        toast.warning('Session Expiring Soon', {
          id: 'session-expiring-soon',
          description: 'Your session will expire soon. User activity will extend it automatically.',
          duration: 4000,
        });
      }
    };

    checkSession();
    const interval = setInterval(checkSession, 15_000);

    // Event listeners for tab visibility and window focus to avoid background timer throttle issues
    const handleVisibilityOrFocus = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        checkSession();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityOrFocus);
    window.addEventListener('focus', handleVisibilityOrFocus);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
      window.removeEventListener('focus', handleVisibilityOrFocus);
    };
  }, [accessToken, status, checkIdleTimeout]);
}

export function SessionMonitor() {
  useSessionMonitor();
  return null;
}

