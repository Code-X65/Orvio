import * as React from 'react';
import { ShieldCheck, ArrowRight, LogOut, Building2, UserX } from 'lucide-react';
import { getTenantWorkspaceUrl, getAccountsBaseUrl } from '../../app/config/authUrls';
import { useAuthStore } from '../../stores/auth-store';
import { Button } from '../../components/ui/button';
import { SeoHead } from '../../components/seo/SeoHead';

export interface WorkspaceAccessDeniedPageProps {
  currentSubdomain: string;
  userOrgSubdomain?: string;
  userEmail?: string;
}

export function WorkspaceAccessDeniedPage({
  currentSubdomain,
  userOrgSubdomain,
  userEmail,
}: WorkspaceAccessDeniedPageProps) {
  const { clearSession } = useAuthStore();
  const authorizedWorkspaceUrl = userOrgSubdomain ? getTenantWorkspaceUrl(userOrgSubdomain) : getAccountsBaseUrl();

  const handleSwitchAccount = () => {
    clearSession();
    window.location.reload();
  };

  return (
    <>
      <SeoHead
        title="Access Restricted | Orvio Workspace"
        description="You do not have access permissions for this organization workspace."
      />

      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between selection:bg-indigo-500 selection:text-white relative overflow-hidden">
        {/* Ambient Glows */}
        <div className="fixed top-1/4 left-1/2 -translate-x-1/2 w-[700px] h-[350px] bg-amber-600/10 rounded-full blur-[160px] pointer-events-none -z-10" />

        {/* Minimal Header */}
        <header className="p-6 max-w-7xl mx-auto w-full flex items-center justify-between z-10">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-sm bg-[#985184] text-white font-bold shadow-md">
              <Building2 className="h-5 w-5" />
            </div>
            <span className="font-extrabold text-white text-lg tracking-tight">Orvio</span>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 flex items-center justify-center px-4 sm:px-6 py-12 z-10">
          <div className="max-w-md w-full text-center space-y-6">
            {/* Lock Icon */}
            <div className="mx-auto w-14 h-14 rounded-sm bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center shadow-lg shadow-amber-500/10">
              <UserX className="h-7 w-7" />
            </div>

            <div className="space-y-2">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-sm text-xs font-mono font-bold bg-amber-500/10 text-amber-300 border border-amber-500/30">
                <span>403 · Cross-Tenant Access Restricted</span>
              </div>
              <h1 className="text-3xl font-extrabold text-white tracking-tight">
                Access Restricted
              </h1>
              <p className="text-sm text-slate-400 leading-relaxed">
                You are currently signed in as <strong className="text-slate-200">{userEmail || 'User'}</strong>, but your account does not belong to{' '}
                <code className="text-amber-300 font-mono text-xs bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800">
                  {currentSubdomain}.orvio.app
                </code>.
              </p>
            </div>

            {/* Action Cards */}
            <div className="p-5 rounded-sm bg-transparent border-t border-white/5 space-y-4">
              <div className="text-xs text-slate-300 font-medium">
                Switch to your authorized organization workspace or sign in with another account.
              </div>

              <div className="space-y-2.5">
                {userOrgSubdomain && (
                  <Button
                    type="button"
                    variant="primary"
                    className="w-full h-10 text-xs font-bold bg-[#985184] hover:bg-[#854372] text-white rounded-sm shadow-sm flex items-center justify-center gap-2 cursor-pointer"
                    onClick={() => {
                      window.location.href = `${authorizedWorkspaceUrl}/dashboard`;
                    }}
                  >
                    <ShieldCheck className="h-4 w-4 text-[#fbb945]" />
                    <span>Go to My Workspace ({userOrgSubdomain})</span>
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                )}

                <Button
                  type="button"
                  variant="outline"
                  className="w-full h-10 text-xs font-bold border border-white/10 text-slate-400 hover:text-white hover:bg-white/5 rounded-sm cursor-pointer"
                  onClick={handleSwitchAccount}
                >
                  <LogOut className="h-3.5 w-3.5 mr-1.5 text-rose-400" />
                  <span>Sign In with Another Account</span>
                </Button>
              </div>
            </div>
          </div>
        </main>

        {/* Footer */}
        <footer className="p-6 text-center text-xs text-slate-600 z-10">
          © {new Date().getFullYear()} Orvio Cloud Technologies. All rights reserved.
        </footer>
      </div>
    </>
  );
}
