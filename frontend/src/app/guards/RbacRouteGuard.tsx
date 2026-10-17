import * as React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../../stores/auth-store';
import { getJwtPayload } from '../../lib/api/token-utils';
import { toast } from 'sonner';

export interface RbacRouteGuardProps {
  requireRole?: string[];
  requireApp?: string;
  fallbackPath?: string;
  children?: React.ReactNode;
}

export function RbacRouteGuard({
  requireRole,
  requireApp,
  fallbackPath = '/dashboard',
  children,
}: RbacRouteGuardProps) {
  const accessToken = useAuthStore((s) => s.accessToken);

  const jwtClaims = React.useMemo(() => {
    if (!accessToken) return null;
    return getJwtPayload<{
      role?: string;
      org_role?: string;
      app_access?: string[];
      scope_all_branches?: boolean;
    }>(accessToken);
  }, [accessToken]);

  const rawRole = (jwtClaims?.org_role || jwtClaims?.role || 'owner').toLowerCase();
  const isOwner = rawRole === 'owner';
  const isManager = rawRole === 'manager';

  // 1. Role verification
  if (requireRole && requireRole.length > 0) {
    const isAllowedRole = isOwner || requireRole.map((r) => r.toLowerCase()).includes(rawRole);
    if (!isAllowedRole) {
      toast.error('Access Denied', {
        description: 'You do not have administrative permission to access this area.',
        id: 'rbac-role-denied',
      });
      return <Navigate to={fallbackPath} replace />;
    }
  }

  // 2. Application scoping verification
  if (requireApp && !isOwner && !isManager) {
    const accessibleApps = jwtClaims?.app_access;
    if (Array.isArray(accessibleApps) && !accessibleApps.includes(requireApp.toLowerCase())) {
      toast.error('Application Restricted', {
        description: `You do not have permission to access the ${requireApp} application.`,
        id: 'rbac-app-denied',
      });
      return <Navigate to={fallbackPath} replace />;
    }
  }

  return children ? <>{children}</> : <Outlet />;
}
