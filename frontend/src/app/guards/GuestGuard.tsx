import * as React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../stores/auth-store';
import { Loader2 } from 'lucide-react';
import {
  sanitizeReturnUrl,
  getLastVisitedPath,
  buildSafeWorkspaceUrl,
  isTenantSubdomain,
} from '../config/authUrls';

export interface GuestGuardProps {
  children?: React.ReactNode;
}

export function GuestGuard({ children }: GuestGuardProps) {
  const location = useLocation();
  const { status, organization, isHydrated, hydrate, accessToken } = useAuthStore();

  React.useEffect(() => {
    if (!isHydrated) {
      hydrate();
    }
  }, [isHydrated, hydrate]);

  if (!isHydrated || status === 'authenticating') {
    return (
      <div className="min-h-screen bg-[#111215] flex flex-col items-center justify-center text-slate-100">
        <Loader2 className="h-8 w-8 animate-spin text-[#985184] mb-2" />
        <p className="text-xs text-slate-400">Loading...</p>
      </div>
    );
  }

  if (status === 'authenticated' || status === 'pending-verification') {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('switch') === 'true') {
        return children ? <>{children}</> : <Outlet />;
      }
    }

    // Hierarchical destination resolution:
    // 1. Explicit returnUrl query parameter
    // 2. React Router location state (returnUrl or from)
    // 3. Organization's remembered last-visited workspace path with query params
    // 4. Default fallback: /inventory (if tenant subdomain) or /orvio (launchpad)
    const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();
    const queryReturnUrl = urlParams.get('returnUrl');
    const locationState = location.state as
      | { returnUrl?: string; from?: { pathname?: string; search?: string } }
      | undefined;
    const stateReturnUrl =
      locationState?.returnUrl ||
      (locationState?.from
        ? `${locationState.from.pathname || ''}${locationState.from.search || ''}`
        : undefined);
    const savedRedirect = typeof window !== 'undefined' ? sessionStorage.getItem('orvio_redirect_after_login') : null;
    const lastVisited = organization?.subdomain ? getLastVisitedPath(organization.subdomain) : null;
    const defaultFallback = isTenantSubdomain() ? '/inventory' : '/orvio';

    const candidate = queryReturnUrl || stateReturnUrl || savedRedirect || lastVisited || defaultFallback;
    const targetDestination = sanitizeReturnUrl(candidate, defaultFallback);

    if (savedRedirect && typeof window !== 'undefined') {
      sessionStorage.removeItem('orvio_redirect_after_login');
    }

    // Cross-subdomain workspace redirection
    if (organization?.subdomain && typeof window !== 'undefined') {
      const currentHost = window.location.hostname.toLowerCase();
      const orgSub = organization.subdomain.toLowerCase();

      if (!currentHost.startsWith(orgSub)) {
        const targetUrl = buildSafeWorkspaceUrl(orgSub, targetDestination);
        window.location.href = targetUrl;
        return null;
      }
    }

    return <Navigate to={targetDestination} replace />;
  }

  return children ? <>{children}</> : <Outlet />;
}
