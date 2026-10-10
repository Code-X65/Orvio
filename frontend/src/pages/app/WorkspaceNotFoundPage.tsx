import * as React from 'react';
import { ShieldAlert, ArrowRight, Home, Sparkles, Building2 } from 'lucide-react';
import { getAccountsBaseUrl } from '../../app/config/authUrls';
import { Button } from '../../components/ui/button';
import { SeoHead } from '../../components/seo/SeoHead';

export interface WorkspaceNotFoundPageProps {
  subdomain: string;
}

export function WorkspaceNotFoundPage({ subdomain }: WorkspaceNotFoundPageProps) {
  const accountsUrl = getAccountsBaseUrl();
  const claimUrl = `${accountsUrl}/trial?subdomain=${encodeURIComponent(subdomain)}`;

  return (
    <>
      <SeoHead
        title="Workspace Not Found | Orvio"
        description="The requested organization workspace is not registered or active."
      />

      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between selection:bg-indigo-500 selection:text-white relative overflow-hidden">
        {/* Ambient Glows */}
        <div className="fixed top-1/4 left-1/2 -translate-x-1/2 w-[700px] h-[350px] bg-rose-600/10 rounded-full blur-[160px] pointer-events-none -z-10" />
        <div className="fixed bottom-10 right-10 w-[400px] h-[400px] bg-indigo-600/10 rounded-full blur-[160px] pointer-events-none -z-10" />

        {/* Minimal Header */}
        <header className="p-6 max-w-7xl mx-auto w-full flex items-center justify-between z-10">
          <a href={accountsUrl} className="flex items-center gap-2.5 group">
            <div className="flex h-9 w-9 items-center justify-center rounded-sm bg-[#985184] text-white font-bold shadow-md group-hover:scale-105 transition-transform">
              <Building2 className="h-5 w-5" />
            </div>
            <span className="font-extrabold text-white text-lg tracking-tight">Orvio</span>
          </a>
        </header>

        {/* Main Content */}
        <main className="flex-1 flex items-center justify-center px-4 sm:px-6 py-12 z-10">
          <div className="max-w-md w-full text-center space-y-6">
            {/* Warning Badge Icon */}
            <div className="mx-auto w-14 h-14 rounded-sm bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-center justify-center shadow-lg shadow-rose-500/10">
              <ShieldAlert className="h-7 w-7" />
            </div>

            <div className="space-y-2">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-sm text-xs font-mono font-bold bg-rose-500/10 text-rose-300 border border-rose-500/30">
                <span>404 · Unclaimed Subdomain</span>
              </div>
              <h1 className="text-3xl font-extrabold text-white tracking-tight">
                Workspace Not Found
              </h1>
              <p className="text-sm text-slate-400 leading-relaxed">
                The organization workspace{' '}
                <code className="text-rose-300 font-mono text-xs bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800">
                  {subdomain}.orvio.app
                </code>{' '}
                does not exist or has not been registered yet.
              </p>
            </div>

            {/* Action Cards */}
            <div className="p-5 rounded-sm bg-transparent border-t border-white/5 space-y-4">
              <div className="text-xs text-slate-300 font-medium">
                Want to claim this business address for your organization?
              </div>

              <div className="space-y-2.5">
                <Button
                  type="button"
                  variant="primary"
                  className="w-full h-10 text-xs font-bold bg-[#985184] hover:bg-[#854372] text-white rounded-sm shadow-sm flex items-center justify-center gap-2 cursor-pointer"
                  onClick={() => {
                    window.location.href = claimUrl;
                  }}
                >
                  <Sparkles className="h-4 w-4 text-[#fbb945]" />
                  <span>Claim "{subdomain}" with 14-Day Free Trial</span>
                  <ArrowRight className="h-4 w-4" />
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  className="w-full h-10 text-xs font-bold border border-white/10 text-slate-400 hover:text-white hover:bg-white/5 rounded-sm cursor-pointer"
                  onClick={() => {
                    window.location.href = accountsUrl;
                  }}
                >
                  <Home className="h-3.5 w-3.5 mr-1.5" />
                  <span>Return to Orvio Homepage</span>
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
