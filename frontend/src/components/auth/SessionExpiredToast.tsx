import * as React from 'react';
import { toast } from 'sonner';
import { useInRouterContext, useNavigate, useLocation } from 'react-router-dom';

const SESSION_EXPIRED_TOAST_ID = 'orvio-session-expired';

function RouterSessionExpiredListener() {
  const navigate = useNavigate();
  const location = useLocation();

  React.useEffect(() => {
    let hasActiveToast = false;

    const handleSessionExpired = (event: Event) => {
      const customEvent = event as CustomEvent<{ redirectPath?: string }>;
      const redirectPath =
        customEvent.detail?.redirectPath ||
        (location ? `${location.pathname}${location.search}` : window.location.pathname + window.location.search);

      // Store redirect path for post-login return
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('orvio_redirect_after_login', redirectPath);
      }

      if (hasActiveToast) {
        toast.dismiss(SESSION_EXPIRED_TOAST_ID);
      }

      toast.error('Session Expired', {
        id: SESSION_EXPIRED_TOAST_ID,
        description: 'Your session has expired. Please sign in again to continue.',
        action: {
          label: 'Sign In',
          onClick: () => {
            toast.dismiss(SESSION_EXPIRED_TOAST_ID);
            hasActiveToast = false;
            navigate(`/login?returnUrl=${encodeURIComponent(redirectPath)}`, {
              replace: true,
              state: { from: redirectPath, returnUrl: redirectPath },
            });
          },
        },
        duration: Infinity, // Persistent until dismissed
        closeButton: true,
      });
      hasActiveToast = true;
    };

    window.addEventListener('orvio:auth:session-expired', handleSessionExpired);
    return () => {
      window.removeEventListener('orvio:auth:session-expired', handleSessionExpired);
      if (hasActiveToast) {
        toast.dismiss(SESSION_EXPIRED_TOAST_ID);
      }
    };
  }, [navigate, location]);

  return null;
}

function FallbackSessionExpiredListener() {
  React.useEffect(() => {
    let hasActiveToast = false;

    const handleSessionExpired = (event: Event) => {
      const customEvent = event as CustomEvent<{ redirectPath?: string }>;
      const redirectPath =
        customEvent.detail?.redirectPath ||
        (typeof window !== 'undefined' ? window.location.pathname + window.location.search : '/');

      if (typeof window !== 'undefined') {
        sessionStorage.setItem('orvio_redirect_after_login', redirectPath);
      }

      if (hasActiveToast) {
        toast.dismiss(SESSION_EXPIRED_TOAST_ID);
      }

      toast.error('Session Expired', {
        id: SESSION_EXPIRED_TOAST_ID,
        description: 'Your session has expired. Please sign in again to continue.',
        action: {
          label: 'Sign In',
          onClick: () => {
            toast.dismiss(SESSION_EXPIRED_TOAST_ID);
            hasActiveToast = false;
            if (typeof window !== 'undefined') {
              window.location.href = `/login?returnUrl=${encodeURIComponent(redirectPath)}`;
            }
          },
        },
        duration: Infinity,
        closeButton: true,
      });
      hasActiveToast = true;
    };

    window.addEventListener('orvio:auth:session-expired', handleSessionExpired);
    return () => {
      window.removeEventListener('orvio:auth:session-expired', handleSessionExpired);
      if (hasActiveToast) {
        toast.dismiss(SESSION_EXPIRED_TOAST_ID);
      }
    };
  }, []);

  return null;
}

export function SessionExpiredListener() {
  const inRouter = useInRouterContext();
  if (inRouter) {
    return <RouterSessionExpiredListener />;
  }
  return <FallbackSessionExpiredListener />;
}
