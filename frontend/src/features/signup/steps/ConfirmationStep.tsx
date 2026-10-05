import * as React from 'react';
import { Mail, RefreshCw, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '../../../components/ui/button';
import { CopyUrlButton } from '../components/CopyUrlButton';
import { getTenantWorkspaceUrl } from '../../../app/config/authUrls';

export interface ConfirmationStepProps {
  email: string;
  organizationName: string;
  subdomain: string;
  onResend: () => Promise<void>;
  isResending: boolean;
}

export function ConfirmationStep({
  email,
  organizationName,
  subdomain,
  onResend,
  isResending,
}: ConfirmationStepProps) {
  const [cooldown, setCooldown] = React.useState(60);

  React.useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const handleResendClick = async () => {
    if (cooldown > 0 || isResending) return;
    await onResend();
    setCooldown(60);
  };

  const workspaceUrl = getTenantWorkspaceUrl(subdomain);

  return (
    <div className="text-center py-6 space-y-6 animate-in fade-in duration-300">
      {/* Visual pulse icon */}
      <div className="relative mx-auto w-20 h-20 flex items-center justify-center">
        <div className="absolute inset-0 rounded-full bg-indigo-500/20 animate-ping" />
        <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-tr from-indigo-500 to-sky-400 text-white shadow-xl shadow-indigo-500/30">
          <Mail className="h-8 w-8" />
        </div>
      </div>

      <div className="space-y-2">
        <h3 className="text-2xl font-bold text-white">Verify your email address</h3>
        <p className="text-xs text-slate-300 max-w-md mx-auto leading-relaxed">
          We sent a verification link to <strong className="text-white">{email}</strong>. Please
          click the link to activate <strong>{organizationName}</strong>.
        </p>
      </div>

      {/* Workspace URL preview */}
      <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 text-left space-y-2">
        <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
          Your Workspace Subdomain (Pending Verification):
        </div>
        <div className="font-mono text-xs text-indigo-300 font-bold bg-slate-900 p-2.5 rounded-xl border border-indigo-500/30 flex items-center justify-between gap-2">
          <span className="truncate">{workspaceUrl}</span>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
              Pending
            </span>
            <CopyUrlButton url={workspaceUrl} />
          </div>
        </div>
      </div>

      {/* Resend Action */}
      <div className="space-y-3 pt-2">
        <Button
          type="button"
          variant="outline"
          disabled={cooldown > 0 || isResending}
          onClick={handleResendClick}
          className="w-full font-bold h-11 border-slate-800 text-slate-200 hover:bg-slate-800 cursor-pointer"
        >
          {isResending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              <RefreshCw className="h-4 w-4" />
              <span>
                {cooldown > 0
                  ? `Resend Verification Email (${cooldown}s)`
                  : 'Resend Verification Email'}
              </span>
            </>
          )}
        </Button>

        <div className="text-xs text-slate-500">
          Did not receive an email? Check your spam folder or click resend.
        </div>

        <div className="pt-2 text-center text-xs text-slate-400">
          Ready to log in?{' '}
          <Link to="/login" className="text-indigo-400 hover:underline font-bold">
            Go to Sign In
          </Link>
        </div>
      </div>
    </div>
  );
}
