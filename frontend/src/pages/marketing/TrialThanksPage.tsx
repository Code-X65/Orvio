import * as React from 'react';
import { useSearchParams } from 'react-router-dom';
import { Sparkles, Zap, ArrowRight, CheckCircle2 } from 'lucide-react';
import { SeoHead } from '../../components/seo/SeoHead';
import { Button } from '../../components/ui/button';
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

      <div
        className="min-h-screen bg-[#111215] text-slate-100 flex flex-col justify-center items-center py-12 px-4 relative overflow-x-hidden font-sans selection:bg-[#985184] selection:text-white"
        style={{
          backgroundImage: 'radial-gradient(circle, rgba(255, 255, 255, 0.07) 1px, transparent 1px)',
          backgroundSize: '24px 24px',
        }}
      >
        {/* Subtle Ambient Glow with #985184 */}
        <div className="fixed top-1/3 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-[#985184]/12 rounded-full blur-[140px] pointer-events-none -z-10" />

        <div className="w-full max-w-md z-10 space-y-6 text-center">
          {/* Brand Logo */}
          <div className="inline-flex items-center justify-center p-2 mb-1">
            <div className="flex h-10 w-10 items-center justify-center rounded-sm bg-[#985184] text-white shadow-sm">
              <Zap className="h-5 w-5 fill-white" />
            </div>
          </div>

          <div className="space-y-1">
            <div className="text-xs font-mono uppercase tracking-widest text-[#fbb945]">
              Workspace Provisioning
            </div>
            <div className="font-mono text-xs text-slate-400">
              {subdomain}.localhost:4000
            </div>
          </div>

          {/* Sequential Pop-up Messages */}
          <div className="space-y-4 pt-2">
            {/* Pop-up 1: "Welcome to Orvio" (t = 0.5s) */}
            {step1Active && (
              <div className="bg-transparent p-4 text-center animate-in fade-in zoom-in-95 duration-300">
                <div className="flex items-center gap-2 justify-center mb-1.5">
                  <CheckCircle2 className="h-4 w-4 text-[#fbb945]" />
                  <h3 className="text-xl font-bold text-white tracking-tight">
                    Welcome to Orvio
                  </h3>
                </div>
                <p className="text-xs text-slate-400">
                  Your 14-day organization trial has been initialized.
                </p>
              </div>
            )}

            {/* Pop-up 2: "The One Platform you will ever need..." (t = 3.0s) */}
            {step2Active && (
              <div className="bg-transparent p-4 text-center border-t border-white/5 animate-in fade-in zoom-in-95 duration-300">
                <div className="flex items-center gap-1.5 justify-center mb-1.5">
                  <Sparkles className="h-4 w-4 text-[#fbb945] animate-pulse" />
                  <span className="text-[10px] font-mono uppercase tracking-wider text-[#fbb945]">
                    Orvio Operating System
                  </span>
                </div>
                <h4 className="text-sm sm:text-base font-semibold text-white leading-snug">
                  "The One Platform you will ever need to transform your operations."
                </h4>
              </div>
            )}
          </div>

          {/* Redirection Progress Indicator */}
          <div className="space-y-3 pt-4 border-t border-white/5">
            <div className="w-full bg-white/10 rounded-none h-1 overflow-hidden">
              <div
                className="bg-[#985184] h-full transition-all duration-100 ease-out"
                style={{ width: `${redirectProgress}%` }}
              />
            </div>
            <p className="text-xs text-slate-500 font-mono">
              Redirecting to your organization launchpad...
            </p>

            <a href={targetUrl} className="inline-block pt-1">
              <Button
                size="sm"
                className="font-semibold text-xs h-8 px-4 rounded-sm bg-[#985184] hover:bg-[#854372] text-white shadow-sm flex items-center gap-1.5 cursor-pointer"
              >
                <span>Enter Dashboard Now</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </a>
          </div>
        </div>
      </div>
    </>
  );
}
export default TrialThanksPage;
