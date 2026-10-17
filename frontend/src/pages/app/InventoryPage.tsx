import * as React from 'react';
import { useAuthStore } from '../../stores/auth-store';
import { useInventoryOnboarding } from '../../features/inventory/hooks';
import { InventorySetupWizard } from '../../features/inventory/components/InventorySetupWizard';
import { InventoryWorkspacePage } from './InventoryWorkspacePage';
import { BranchGatewayScreen } from '../../features/inventory/components/BranchGatewayScreen';
import { AddBranchWizardModal } from '../../features/inventory/components/AddBranchWizardModal';
import { Loader2, ArrowLeft } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { SeoHead } from '../../components/seo/SeoHead';
import { ErrorState } from '../../components/ui/ErrorState';
import { getJwtPayload } from '../../lib/api/token-utils';

export function InventoryPage() {
  const { user, organization } = useAuthStore();
  const accessToken = useAuthStore((s) => s.accessToken);
  const location = useLocation();
  const navigate = useNavigate();
  const [isAddBranchWizardOpen, setIsAddBranchWizardOpen] = React.useState(false);

  // Compute authenticated user role & branch permissions from JWT claims
  const jwtClaims = React.useMemo(() => {
    if (!accessToken) return null;
    return getJwtPayload<{
      role?: string;
      org_role?: string;
      scope_all_branches?: boolean;
      branch_scope?: string[];
    }>(accessToken);
  }, [accessToken]);

  const rawRole = (jwtClaims?.org_role || jwtClaims?.role || 'owner').toLowerCase();
  const isElevated = rawRole === 'owner' || rawRole === 'manager';
  const hasGlobalBranchScope = isElevated || Boolean(jwtClaims?.scope_all_branches);
  const permittedBranchScope = jwtClaims?.branch_scope || [];

  const {
    data: statusData,
    isLoading: loading,
    error,
    refetch: fetchStatus,
  } = useInventoryOnboarding(organization?.id);

  // Scoped branches strictly accessible to this user
  const effectiveBranches = React.useMemo(() => {
    const raw = statusData?.branches || [];
    if (hasGlobalBranchScope || permittedBranchScope.length === 0) return raw;
    return raw.filter((b) => permittedBranchScope.includes(b.id));
  }, [statusData?.branches, hasGlobalBranchScope, permittedBranchScope]);

  // Auto-redirect single-branch staff immediately to their branch URL
  React.useEffect(() => {
    if (statusData?.completed && effectiveBranches.length === 1) {
      const searchParams = new URLSearchParams(location.search);
      const branchParam = searchParams.get('branch');
      const singleBranchId = effectiveBranches[0].id;
      if (!branchParam || branchParam !== singleBranchId) {
        searchParams.set('branch', singleBranchId);
        navigate(
          {
            pathname: location.pathname,
            search: `?${searchParams.toString()}`,
          },
          { replace: true }
        );
      }
    }
  }, [statusData?.completed, effectiveBranches, location.pathname, location.search, navigate]);

  if (loading && !statusData) {
    return (
      <div className="min-h-screen bg-[#111215] text-slate-100 flex flex-col items-center justify-center p-4">
        <SeoHead
          title="Loading Inventory — Orvio"
          description="Preparing inventory workspace."
        />
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-7 h-7 animate-spin text-[#985184]" />
          <p className="text-xs text-slate-400 font-medium">Preparing workspace...</p>
        </div>
      </div>
    );
  }

  if (error || !statusData) {
    return (
      <>
        <SeoHead
          title="Error Loading Inventory — Orvio"
          description="Trouble loading inventory onboarding details."
        />
        <ErrorState
          error={error}
          title="Unable to Load Inventory"
          onRetry={() => { fetchStatus(); }}
          isRetrying={loading}
          secondaryAction={{
            label: 'Return to Launchpad',
            href: '/dashboard',
            icon: <ArrowLeft className="w-3.5 h-3.5 mr-1.5" />,
          }}
          variant="page"
        />
      </>
    );
  }

  // If already completed, show either Gateway screen or Workspace
  if (statusData.completed) {
    const searchParams = new URLSearchParams(location.search);
    const branchParam = searchParams.get('branch');

    // If org has 2 or more accessible branches and no branch query parameter was provided:
    if (effectiveBranches.length >= 2 && !branchParam) {
      return (
        <>
          <BranchGatewayScreen
            organization={statusData.organization}
            branches={effectiveBranches}
            onSelectBranch={(branchId) => {
              const params = new URLSearchParams(location.search);
              params.set('branch', branchId);
              navigate({
                pathname: location.pathname,
                search: `?${params.toString()}`,
              });
            }}
            onOpenAddBranch={isElevated ? () => setIsAddBranchWizardOpen(true) : undefined}
          />
          {isElevated && (
            <AddBranchWizardModal
              isOpen={isAddBranchWizardOpen}
              onClose={() => setIsAddBranchWizardOpen(false)}
              organization={{
                id: statusData.organization.id,
                name: statusData.organization.name,
                subdomain: statusData.organization.subdomain,
                businessEmail: (statusData.organization as any).business_email || user?.email,
                phone: (statusData.organization as any).phone || user?.phone,
              }}
              branches={effectiveBranches}
              onBranchCreated={(newBranch) => {
                fetchStatus();
                const params = new URLSearchParams(location.search);
                params.set('branch', newBranch.id);
                navigate({
                  pathname: location.pathname,
                  search: `?${params.toString()}`,
                });
              }}
            />
          )}
        </>
      );
    }

    const activeBranch =
      effectiveBranches.find((b) => b.id === branchParam) ??
      effectiveBranches[0] ??
      statusData.branch;

    return (
      <InventoryWorkspacePage
        organization={statusData.organization}
        branch={activeBranch}
        branches={effectiveBranches}
      />
    );
  }

  // If not completed, render the Setup Wizard
  return (
    <>
      <SeoHead
        title={`Inventory Setup — ${statusData.organization.name}`}
        description="Set up your primary branch location to begin tracking inventory."
      />
      <InventorySetupWizard
        organization={statusData.organization}
        initialStepData={statusData.stepData}
        onCompleted={() => {
          fetchStatus();
        }}
      />
    </>
  );
}
