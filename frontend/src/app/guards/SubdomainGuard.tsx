import * as React from 'react';
import { getSubdomainFromHostname } from '../config/authUrls';
import { useAuthStore } from '../../stores/auth-store';
import { api } from '../../lib/api';
import { WorkspaceNotFoundPage } from '../../pages/app/WorkspaceNotFoundPage';
import { WorkspaceAccessDeniedPage } from '../../pages/app/WorkspaceAccessDeniedPage';
import { Loader2, Zap } from 'lucide-react';

interface PublicOrgInfo {
  exists: boolean;
  name?: string;
  subdomain: string;
  status?: string;
}

const subdomainValidationCache = new Map<string, PublicOrgInfo>();
const subdomainInFlight = new Map<string, Promise<PublicOrgInfo>>();

export function validateSubdomainPublic(rawSub: string): Promise<PublicOrgInfo> {
  const cleanSub = rawSub.toLowerCase().trim();
  if (subdomainValidationCache.has(cleanSub)) {
    return Promise.resolve(subdomainValidationCache.get(cleanSub)!);
  }
  if (subdomainInFlight.has(cleanSub)) {
    return subdomainInFlight.get(cleanSub)!;
  }
  const promise = api
    .get<PublicOrgInfo>(`/orgs/public/${encodeURIComponent(cleanSub)}`)
    .then((res) => {
      subdomainValidationCache.set(cleanSub, res);
      return res;
    })
    .catch(() => {
      const fallback: PublicOrgInfo = { exists: true, subdomain: cleanSub };
      subdomainValidationCache.set(cleanSub, fallback);
      return fallback;
    })
    .finally(() => {
      subdomainInFlight.delete(cleanSub);
    });

  subdomainInFlight.set(cleanSub, promise);
  return promise;
}

export interface SubdomainGuardProps {
  children: React.ReactNode;
}

export function SubdomainGuard({ children }: SubdomainGuardProps) {
  const currentSubdomain = getSubdomainFromHostname();
  const { user, organization, isHydrated, hydrate } = useAuthStore();

  const [loading, setLoading] = React.useState(() => {
    if (!currentSubdomain) return false;
    return !subdomainValidationCache.has(currentSubdomain.toLowerCase().trim());
  });

  const [orgInfo, setOrgInfo] = React.useState<PublicOrgInfo | null>(() => {
    if (!currentSubdomain) return { exists: true, subdomain: '' };
    return subdomainValidationCache.get(currentSubdomain.toLowerCase().trim()) || null;
  });

  React.useEffect(() => {
    if (!isHydrated) {
      hydrate();
    }
  }, [isHydrated, hydrate]);

  React.useEffect(() => {
    if (!currentSubdomain) {
      setLoading(false);
      return;
    }

    const cleanSub = currentSubdomain.toLowerCase().trim();
    if (subdomainValidationCache.has(cleanSub)) {
      setOrgInfo(subdomainValidationCache.get(cleanSub)!);
      setLoading(false);
      return;
    }

    let isMounted = true;
    validateSubdomainPublic(cleanSub)
      .then((info) => {
        if (isMounted) {
          setOrgInfo(info);
          setLoading(false);
        }
      })
      .catch(() => {
        if (isMounted) {
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [currentSubdomain]);

  // Loading state with rich dark skeleton
  if (loading || !isHydrated) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-400 selection:bg-indigo-500 selection:text-white">
        <div className="flex flex-col items-center gap-4 animate-in fade-in duration-300">
          <div className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-indigo-500 to-sky-400 text-white shadow-xl shadow-indigo-500/20">
            <Zap className="h-6 w-6 fill-white" />
            <div className="absolute inset-0 rounded-2xl border border-indigo-400/40 animate-ping opacity-25" />
          </div>
          <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-indigo-400" />
            <span>Resolving workspace {currentSubdomain ? `${currentSubdomain}.orvio.app` : 'environment'}...</span>
          </div>
        </div>
      </div>
    );
  }

  // If on a tenant subdomain and it does NOT exist in the database
  if (currentSubdomain && orgInfo && !orgInfo.exists) {
    return <WorkspaceNotFoundPage subdomain={currentSubdomain} />;
  }

  // Cross-tenant access validation:
  // If user is logged in, but their session organization subdomain does NOT match the URL subdomain
  if (
    currentSubdomain &&
    user &&
    organization?.subdomain &&
    organization.subdomain.toLowerCase() !== currentSubdomain.toLowerCase()
  ) {
    return (
      <WorkspaceAccessDeniedPage
        currentSubdomain={currentSubdomain}
        userOrgSubdomain={organization.subdomain}
        userEmail={user.email}
      />
    );
  }

  return <>{children}</>;
}
