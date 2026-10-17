import * as React from 'react';
import { toast } from 'sonner';
import { useInRouterContext, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../stores/auth-store';

const SESSION_EXPIRED_TOAST_ID = 'orvio-session-expired';
const REDIRECT_DELAY_MS = 3000;

function RouterSessionExpiredListener() {
  const navigate = useNavigate();
  const location = useLocation();
  const authStatus = useAuthStore((s) => s.status);

  React.useEffect(() => {
    let hasActiveToast = false;
    let redirectTimer: ReturnType<typeof setTimeout> | null = null;
    let userDismissed = false;
    let isRedirecting = false;

    // Reset dismissal flag if user is authenticated or route changes
    if (authStatus === 'authenticated') {
      userDismissed = false;
    }

    const clearExistingTimer = () => {
      if (redirectTimer) {
        clearTimeout(redirectTimer);
        redirectTimer = null;
      }
    };

    const handleSessionExpired = (event: Event) => {
      if (userDismissed) return;

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
      clearExistingTimer();

      const performRedirect = () => {
        isRedirecting = true;
        clearExistingTimer();
        toast.dismiss(SESSION_EXPIRED_TOAST_ID);
        hasActiveToast = false;
        navigate(`/login?returnUrl=${encodeURIComponent(redirectPath)}`, {
          replace: true,
          state: { from: redirectPath, returnUrl: redirectPath },
        });
      };

      redirectTimer = setTimeout(performRedirect, REDIRECT_DELAY_MS);

      toast.error('Session Expired', {
        id: SESSION_EXPIRED_TOAST_ID,
        description: 'Your session has expired. Redirecting in 3s... (or click Sign In)',
        action: {
          label: 'Sign In',
          onClick: () => {
            performRedirect();
          },
        },
        duration: REDIRECT_DELAY_MS + 1000,
        closeButton: true,
        onDismiss: () => {
          if (!isRedirecting) {
            clearExistingTimer();
            userDismissed = true;
            hasActiveToast = false;
          }
        },
      });
      hasActiveToast = true;
    };

    window.addEventListener('orvio:auth:session-expired', handleSessionExpired);
    return () => {
      window.removeEventListener('orvio:auth:session-expired', handleSessionExpired);
      clearExistingTimer();
      if (hasActiveToast) {
        toast.dismiss(SESSION_EXPIRED_TOAST_ID);
      }
    };
  }, [navigate, location, authStatus]);

  return null;
}

function FallbackSessionExpiredListener() {
  const authStatus = useAuthStore((s) => s.status);

  React.useEffect(() => {
    let hasActiveToast = false;
    let redirectTimer: ReturnType<typeof setTimeout> | null = null;
    let userDismissed = false;
    let isRedirecting = false;

    if (authStatus === 'authenticated') {
      userDismissed = false;
    }

    const clearExistingTimer = () => {
      if (redirectTimer) {
        clearTimeout(redirectTimer);
        redirectTimer = null;
      }
    };

    const handleSessionExpired = (event: Event) => {
      if (userDismissed) return;

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
      clearExistingTimer();

      const performRedirect = () => {
        isRedirecting = true;
        clearExistingTimer();
        toast.dismiss(SESSION_EXPIRED_TOAST_ID);
        hasActiveToast = false;
        if (typeof window !== 'undefined') {
          window.location.href = `/login?returnUrl=${encodeURIComponent(redirectPath)}`;
        }
      };

      redirectTimer = setTimeout(performRedirect, REDIRECT_DELAY_MS);

      toast.error('Session Expired', {
        id: SESSION_EXPIRED_TOAST_ID,
        description: 'Your session has expired. Redirecting in 3s... (or click Sign In)',
        action: {
          label: 'Sign In',
          onClick: () => {
            performRedirect();
          },
        },
        duration: REDIRECT_DELAY_MS + 1000,
        closeButton: true,
        onDismiss: () => {
          if (!isRedirecting) {
            clearExistingTimer();
            userDismissed = true;
            hasActiveToast = false;
          }
        },
      });
      hasActiveToast = true;
    };

    window.addEventListener('orvio:auth:session-expired', handleSessionExpired);
    return () => {
      window.removeEventListener('orvio:auth:session-expired', handleSessionExpired);
      clearExistingTimer();
      if (hasActiveToast) {
        toast.dismiss(SESSION_EXPIRED_TOAST_ID);
      }
    };
  }, [authStatus]);

  return null;
}

export function SessionExpiredListener() {
  const inRouter = useInRouterContext();
  if (inRouter) {
    return <RouterSessionExpiredListener />;
  }
  return <FallbackSessionExpiredListener />;
}

