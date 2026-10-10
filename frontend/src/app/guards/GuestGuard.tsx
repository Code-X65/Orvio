import * as React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../../stores/auth-store';
import { Loader2 } from 'lucide-react';
import { getTenantWorkspaceUrl } from '../config/authUrls';

export interface GuestGuardProps {
  children?: React.ReactNode;
}

export function GuestGuard({ children }: GuestGuardProps) {
  const { status, organization, isHydrated, hydrate } = useAuthStore();

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

    if (organization?.subdomain && typeof window !== 'undefined') {
      const currentHost = window.location.hostname;
      if (!currentHost.startsWith(organization.subdomain)) {
        window.location.href = `${getTenantWorkspaceUrl(organization.subdomain)}/orvio`;
        return null;
      }
    }
    return <Navigate to="/orvio" replace />;
  }

  return children ? <>{children}</> : <Outlet />;
}
