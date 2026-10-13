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

export function InventoryPage() {
  const { user, organization } = useAuthStore();
  const location = useLocation();
  const navigate = useNavigate();
  const [isAddBranchWizardOpen, setIsAddBranchWizardOpen] = React.useState(false);

  const {
    data: statusData,
    isLoading: loading,
    error,
    refetch: fetchStatus,
  } = useInventoryOnboarding(organization?.id);

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
    const branches = statusData.branches || [];

    // If org has 2 or more branches and no branch query parameter was provided:
    if (branches.length >= 2 && !branchParam) {
      return (
        <>
          <BranchGatewayScreen
            organization={statusData.organization}
            branches={branches}
            onSelectBranch={(branchId) => {
              const params = new URLSearchParams(location.search);
              params.set('branch', branchId);
              navigate({
                pathname: location.pathname,
                search: `?${params.toString()}`,
              });
            }}
            onOpenAddBranch={() => setIsAddBranchWizardOpen(true)}
          />
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
            branches={branches}
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
        </>
      );
    }

    return (
      <InventoryWorkspacePage
        organization={statusData.organization}
        branch={statusData.branch}
        branches={statusData.branches}
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
        userEmail={user?.email}
        userPhone={user?.phone || undefined}
        onCompleted={() => { fetchStatus(); }}
      />
    </>
  );
}
export default InventoryPage;
