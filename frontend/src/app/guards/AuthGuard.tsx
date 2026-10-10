import * as React from 'react';
import { Navigate, useLocation, Outlet } from 'react-router-dom';
import { useAuthStore } from '../../stores/auth-store';
import { Loader2 } from 'lucide-react';
import {
  sanitizeReturnUrl,
  saveLastVisitedPath,
  getSubdomainFromHostname,
} from '../config/authUrls';

export interface AuthGuardProps {
  children?: React.ReactNode;
}

export function AuthGuard({ children }: AuthGuardProps) {
  const location = useLocation();
  const { status, isHydrated, hydrate, organization } = useAuthStore();

  React.useEffect(() => {
    if (!isHydrated) {
      hydrate();
    }
  }, [isHydrated, hydrate]);

  // Track and remember last visited workspace path for authenticated user
  React.useEffect(() => {
    if (status === 'authenticated') {
      const activeSub = organization?.subdomain || getSubdomainFromHostname();
      if (activeSub) {
        saveLastVisitedPath(activeSub, location.pathname);
      }
    }
  }, [status, organization?.subdomain, location.pathname]);

  if (!isHydrated || status === 'authenticating') {
    return (
      <div className="min-h-screen bg-[#111215] flex flex-col items-center justify-center text-slate-100">
        <Loader2 className="h-8 w-8 animate-spin text-[#985184] mb-2" />
        <p className="text-xs text-slate-400">Verifying session credentials...</p>
      </div>
    );
  }

  if (status !== 'authenticated' && status !== 'pending-verification') {
    const rawPath = location.pathname + location.search;
    const returnUrl = sanitizeReturnUrl(rawPath, '/orvio');
    const loginTarget = `/login?returnUrl=${encodeURIComponent(returnUrl)}`;

    return <Navigate to={loginTarget} state={{ from: location, returnUrl }} replace />;
  }

  return children ? <>{children}</> : <Outlet />;
}
