import * as React from 'react';
import { useAuthStore } from '../../stores/auth-store';
import { getInventoryOnboardingStatus, type InventoryOnboardingStatusResponse } from '../../features/inventory/api';
import { InventorySetupWizard } from '../../features/inventory/components/InventorySetupWizard';
import { InventoryWorkspacePage } from './InventoryWorkspacePage';
import { Loader2, AlertCircle, RefreshCw, ArrowLeft } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Link } from 'react-router-dom';
import { SeoHead } from '../../components/seo/SeoHead';

export function InventoryPage() {
  const { user } = useAuthStore();
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [statusData, setStatusData] = React.useState<InventoryOnboardingStatusResponse | null>(null);

  const fetchStatus = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getInventoryOnboardingStatus();
      setStatusData(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to check inventory onboarding status';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  if (loading) {
    return (
      <div
        className="min-h-screen bg-[#111215] text-slate-100 flex flex-col items-center justify-center p-4 relative overflow-hidden font-sans selection:bg-[#985184] selection:text-white"
        style={{
          backgroundImage: 'radial-gradient(circle, rgba(255, 255, 255, 0.07) 1px, transparent 1px)',
          backgroundSize: '24px 24px',
        }}
      >
        <SeoHead
          title="Loading Inventory Workspace — Orvio"
          description="Accessing organization stock, branches, and point of sale workspace."
        />
        {/* Subtle Ambient Glow with #985184 */}
        <div className="fixed top-1/3 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-[#985184]/12 rounded-full blur-[140px] pointer-events-none -z-10" />

        <div className="flex flex-col items-center gap-4 text-center z-10">
          <div className="w-12 h-12 rounded-sm bg-[#fbb945]/10 text-[#985184] flex items-center justify-center shadow-sm">
            <Loader2 className="w-6 h-6 animate-spin text-[#985184]" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white tracking-tight">Accessing Inventory Workspace</h2>
            <p className="text-xs text-slate-400 mt-1">Verifying organization branch status & stock catalog...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !statusData) {
    return (
      <div
        className="min-h-screen bg-[#111215] text-slate-100 flex flex-col items-center justify-center p-4 relative overflow-hidden font-sans selection:bg-[#985184] selection:text-white"
        style={{
          backgroundImage: 'radial-gradient(circle, rgba(255, 255, 255, 0.07) 1px, transparent 1px)',
          backgroundSize: '24px 24px',
        }}
      >
        <SeoHead
          title="Error Loading Inventory — Orvio"
          description="Trouble loading inventory onboarding details."
        />
        {/* Subtle Ambient Glow with #985184 */}
        <div className="fixed top-1/3 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-[#985184]/12 rounded-full blur-[140px] pointer-events-none -z-10" />

        <div className="max-w-md w-full bg-transparent text-center space-y-4 z-10 py-6">
          <div className="w-10 h-10 rounded-sm bg-rose-500/10 text-rose-400 flex items-center justify-center mx-auto">
            <AlertCircle className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white tracking-tight">Unable to Load Inventory</h2>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              {error || 'An unexpected error occurred while loading your organization workspace.'}
            </p>
          </div>
          <div className="flex items-center justify-center gap-3 pt-3">
            <Link to="/dashboard">
              <Button
                variant="outline"
                size="sm"
                className="text-xs h-8 rounded-sm bg-transparent border border-white/10 text-slate-300 hover:text-white hover:bg-white/5 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5 mr-1.5" />
                Return to Launchpad
              </Button>
            </Link>
            <Button
              onClick={fetchStatus}
              size="sm"
              className="bg-[#985184] hover:bg-[#854372] text-white text-xs h-8 rounded-sm font-semibold cursor-pointer shadow-sm"
            >
              <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
              Retry
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // If already completed, show the full workspace dashboard
  if (statusData.completed) {
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
        onCompleted={fetchStatus}
      />
    </>
  );
}
export default InventoryPage;
