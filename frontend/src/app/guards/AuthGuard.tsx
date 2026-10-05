import * as React from 'react';
import { Navigate, useLocation, Outlet } from 'react-router-dom';
import { useAuthStore } from '../../stores/auth-store';
import { Loader2 } from 'lucide-react';

export interface AuthGuardProps {
  children?: React.ReactNode;
}

export function AuthGuard({ children }: AuthGuardProps) {
  const location = useLocation();
  const { status, isHydrated, hydrate } = useAuthStore();

  React.useEffect(() => {
    if (!isHydrated) {
      hydrate();
    }
  }, [isHydrated, hydrate]);

  if (!isHydrated || status === 'authenticating') {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-100">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-500 mb-2" />
        <p className="text-xs text-slate-400">Verifying session credentials...</p>
      </div>
    );
  }

  if (status !== 'authenticated' && status !== 'pending-verification') {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children ? <>{children}</> : <Outlet />;
}
