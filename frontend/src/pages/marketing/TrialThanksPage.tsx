import * as React from 'react';
import { useSearchParams } from 'react-router-dom';
import { Sparkles, Zap, ArrowRight, CheckCircle2, Shield } from 'lucide-react';
import { SeoHead } from '../../components/seo/SeoHead';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { getTenantWorkspaceUrl } from '../../app/config/authUrls';

export function TrialThanksPage() {
  const [searchParams] = useSearchParams();
  const subdomain = searchParams.get('subdomain') || 'workspace';
  const token = searchParams.get('token') || '';

  // Timed Pop-up Sequence State
  const [step1Active, setStep1Active] = React.useState(false);
  const [step2Active, setStep2Active] = React.useState(false);
  const [redirectProgress, setRedirectProgress] = React.useState(0);

  const targetUrl = `${getTenantWorkspaceUrl(subdomain)}/orvio${token ? `?token=${encodeURIComponent(token)}` : ''}`;

  React.useEffect(() => {
    // 1. Popup 1 at t = 500ms
    const t1 = setTimeout(() => {
      setStep1Active(true);
    }, 500);

    // 2. Popup 2 at t = 3000ms
    const t2 = setTimeout(() => {
      setStep2Active(true);
    }, 3000);

    // Progress bar animation over 5000ms
    const interval = setInterval(() => {
      setRedirectProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          return 100;
        }
        return prev + 2;
      });
    }, 100);

    // 3. Automatic Redirection at t = 5000ms
    const tRedirect = setTimeout(() => {
      window.location.href = targetUrl;
    }, 5000);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(tRedirect);
      clearInterval(interval);
    };
  }, [targetUrl]);

  return (
    <>
      <SeoHead
        title="Welcome to Orvio | Setting Up Workspace"
        description="Your dedicated organization trial workspace is being initialized."
      />

      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center py-12 px-4 relative overflow-hidden">
        {/* Ambient atmospheric glows */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[700px] h-[400px] bg-indigo-600/20 rounded-full blur-3xl pointer-events-none animate-pulse" />
        <div className="absolute bottom-10 left-1/3 w-[500px] h-[300px] bg-sky-500/15 rounded-full blur-3xl pointer-events-none" />

        <div className="w-full max-w-lg z-10 space-y-6 text-center">
          {/* Brand Logo & Animated Pulse */}
          <div className="inline-flex items-center justify-center p-3 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 mb-2">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-500 via-indigo-600 to-sky-400 text-white shadow-xl shadow-indigo-500/30 animate-bounce">
              <Zap className="h-6 w-6 fill-white" />
            </div>
          </div>

          <div className="space-y-2">
            <h2 className="text-sm font-bold uppercase tracking-widest text-indigo-400">
              Workspace Provisioning
            </h2>
            <div className="font-mono text-xs text-slate-300 bg-slate-900/80 border border-slate-800 rounded-full px-4 py-1.5 inline-block">
              {subdomain}.localhost:4000
            </div>
          </div>

          {/* Sequential Pop-up Cards Container */}
          <div className="space-y-4">
            {/* Pop-up 1: "Welcome to Orvio" (t = 0.5s) */}
            {step1Active && (
              <Card className="bg-slate-900/95 border-indigo-500/40 text-white p-6 shadow-2xl backdrop-blur-xl rounded-3xl animate-in zoom-in-95 slide-in-from-bottom-4 duration-500">
                <div className="flex items-center gap-3 justify-center mb-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    <CheckCircle2 className="h-5 w-5" />
                  </div>
                  <h3 className="text-2xl font-black text-white tracking-tight">
                    Welcome to Orvio
                  </h3>
                </div>
                <p className="text-xs text-slate-300">
                  Your 14-day organization trial has been created and customized.
                </p>
              </Card>
            )}

            {/* Pop-up 2: "The One Platform you will ever need..." (t = 3.0s) */}
            {step2Active && (
              <Card className="bg-gradient-to-br from-indigo-950/90 to-slate-900/90 border-indigo-400/50 text-white p-6 shadow-2xl backdrop-blur-xl rounded-3xl animate-in zoom-in-95 slide-in-from-bottom-4 duration-500">
                <div className="flex items-center gap-2 justify-center mb-2">
                  <Sparkles className="h-5 w-5 text-indigo-400 animate-spin" />
                  <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-300">
                    Orvio Operating System
                  </span>
                </div>
                <h4 className="text-lg sm:text-xl font-extrabold text-white leading-snug">
                  "The One Platform you will ever need to transform your activities."
                </h4>
              </Card>
            )}
          </div>

          {/* Redirection Progress Indicator */}
          <div className="space-y-3 pt-2">
            <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden border border-slate-800">
              <div
                className="bg-gradient-to-r from-indigo-500 via-sky-400 to-emerald-400 h-full transition-all duration-100 ease-out"
                style={{ width: `${redirectProgress}%` }}
              />
            </div>
            <p className="text-xs text-slate-400 flex items-center justify-center gap-2">
              <span>Redirecting to your organization dashboard...</span>
            </p>

            <a href={targetUrl} className="inline-block pt-2">
              <Button variant="emerald" size="sm" className="font-bold text-xs shadow-lg shadow-emerald-500/20">
                <span>Enter Dashboard Now</span>
                <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
              </Button>
            </a>
          </div>
        </div>
      </div>
    </>
  );
}
