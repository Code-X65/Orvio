import * as React from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { CheckCircle2, XCircle, Loader2, ArrowRight, Zap, RefreshCw, Lock, Eye, EyeOff } from 'lucide-react';
import { SeoHead } from '../../components/seo/SeoHead';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { resendVerificationEmail } from '../../domains/auth/api';
import { setupPasswordAndVerify, type StartTrialResponse } from '../../features/trial/api';
import { ApiError } from '../../lib/api';
import { toast } from 'sonner';
import { useAuthStore } from '../../stores/auth-store';
import { getTenantWorkspaceUrl } from '../../app/config/authUrls';

export function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const hashToken = typeof window !== 'undefined'
    ? new URLSearchParams(window.location.hash.replace(/^#/, '')).get('token')
    : null;
  const token = searchParams.get('token') || hashToken;
  const navigate = useNavigate();

  const [tokenStatus, setTokenStatus] = React.useState<'idle' | 'already_used' | 'expired' | 'invalid'>('idle');
  const [password, setPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [showPassword, setShowPassword] = React.useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [successData, setSuccessData] = React.useState<StartTrialResponse | null>(null);

  const emailParam = searchParams.get('email') || '';
  const [resendEmail, setResendEmail] = React.useState(emailParam);
  const [resendSuccess, setResendSuccess] = React.useState(false);
  const [isResending, setIsResending] = React.useState(false);

  const passwordChecks = {
    length: password.length >= 12,
    upper: /[A-Z]/.test(password),
    lower: /[a-z]/.test(password),
    number: /[0-9]/.test(password),
    special: /[^A-Za-z0-9]/.test(password),
  };

  const handlePasswordSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) {
      setError('Verification token is missing. Please check the link from your email.');
      return;
    }

    if (password.length < 12) {
      setError('Password must be at least 12 characters long.');
      return;
    }

    if (!/[A-Z]/.test(password)) {
      setError('Password must contain at least one uppercase letter.');
      return;
    }

    if (!/[a-z]/.test(password)) {
      setError('Password must contain at least one lowercase letter.');
      return;
    }

    if (!/[0-9]/.test(password)) {
      setError('Password must contain at least one number.');
      return;
    }

    if (!/[^A-Za-z0-9]/.test(password)) {
      setError('Password must contain at least one special character (e.g. !@#$%^&*).');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const response = await setupPasswordAndVerify({
        token,
        password,
        confirmPassword,
      });

      useAuthStore.getState().setSession(
        response.accessToken,
        {
          id: response.user.id,
          email: response.user.email,
          fullName: response.user.fullName,
          phone: response.user.phone || null,
          status: response.user.status,
          emailVerifiedAt: response.user.emailVerifiedAt,
        },
        response.organization,
        'authenticated'
      );

      setSuccessData(response);
      toast.success('Password set and email verified successfully!');
    } catch (err: any) {
      const isUsed =
        err?.code === 'TOKEN_ALREADY_USED' ||
        err?.message?.toLowerCase().includes('already been used') ||
        err?.message?.toLowerCase().includes('already used');
      const isExpired =
        err?.code === 'TOKEN_EXPIRED' ||
        err?.message?.toLowerCase().includes('expired');

      if (isUsed) {
        setTokenStatus('already_used');
        toast.info('This verification link was already used. Your account is ready!');
      } else if (isExpired) {
        setTokenStatus('expired');
        toast.error('This verification link has expired. Please request a new one.');
      } else {
        const msg = err.message || 'Verification link may be invalid or expired.';
        setError(msg);
        toast.error(msg);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleResend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resendEmail) return;
    setIsResending(true);
    try {
      await resendVerificationEmail(resendEmail);
      setResendSuccess(true);
      toast.success('New verification link sent to your email!');
    } catch {
      toast.error('Could not send verification email. Please check the address.');
    } finally {
      setIsResending(false);
    }
  };

  const getWorkspaceUrl = (subdomain?: string) => {
    if (!subdomain) return '/orvio';
    return `${getTenantWorkspaceUrl(subdomain)}/orvio`;
  };

  return (
    <>
      <SeoHead
        title="Complete Account Setup | Orvio Hub"
        description="Set your permanent password and activate your Orvio Hub workspace."
      />

      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
        {/* Ambient glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-indigo-600/15 rounded-full blur-3xl pointer-events-none" />

        <div className="sm:mx-auto sm:w-full sm:max-w-md text-center z-10">
          <Link to="/" className="inline-flex items-center gap-2.5 group">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-500 via-indigo-600 to-sky-400 text-white shadow-lg shadow-indigo-500/25">
              <Zap className="h-5 w-5 fill-white" />
            </div>
            <span className="text-2xl font-black tracking-tight text-white">
              Orvio<span className="text-indigo-400">Hub</span>
            </span>
          </Link>
        </div>

        <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-lg z-10">
          <Card className="bg-slate-900/90 border-slate-800 text-white shadow-2xl p-6 sm:p-8 backdrop-blur-xl">
            {/* 1. SUCCESS STATE */}
            {successData && (
              <div className="text-center py-6 space-y-6 animate-in fade-in duration-300">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 mx-auto border border-emerald-500/30">
                  <CheckCircle2 className="h-9 w-9" />
                </div>

                <div className="space-y-2">
                  <h3 className="text-2xl font-bold text-white">Setup Completed Successfully!</h3>
                  <p className="text-xs text-slate-300 max-w-sm mx-auto">
                    Welcome aboard, <strong>{successData.user.fullName}</strong>! Your email is verified and password is active.
                  </p>
                </div>

                {successData.organization && (
                  <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 text-left space-y-2">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      Your Organization Workspace:
                    </div>
                    <div className="font-mono text-xs text-indigo-300 font-bold bg-slate-900 p-2.5 rounded-xl border border-indigo-500/30 flex items-center justify-between">
                      <span>{successData.organization.subdomain}.localhost:4000</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        Active
                      </span>
                    </div>
                  </div>
                )}

                <a
                  href={getWorkspaceUrl(successData.organization?.subdomain)}
                  className="block w-full"
                >
                  <Button variant="emerald" size="lg" className="w-full font-bold h-12 shadow-lg shadow-emerald-500/20">
                    <span>Enter Organization Workspace</span>
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </a>
              </div>
            )}

            {/* 2. ALREADY USED STATE */}
            {!successData && tokenStatus === 'already_used' && (
              <div className="text-center py-6 space-y-6 animate-in fade-in duration-300">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-indigo-500/20 text-indigo-400 mx-auto border border-indigo-500/30">
                  <CheckCircle2 className="h-9 w-9" />
                </div>

                <div className="space-y-2">
                  <h3 className="text-2xl font-bold text-white">Account Already Verified</h3>
                  <p className="text-xs text-slate-300 max-w-sm mx-auto">
                    This verification setup link has already been used and your password has been set. You can sign in to your workspace directly.
                  </p>
                </div>

                <div className="pt-2 space-y-3">
                  <Link to="/login" className="block w-full">
                    <Button variant="primary" size="lg" className="w-full font-bold h-12 shadow-lg shadow-indigo-500/20">
                      <span>Go to Sign In</span>
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </Link>

                  <div className="text-xs text-slate-400">
                    Forgot your password?{' '}
                    <Link to="/forgot-password" className="text-indigo-400 hover:underline font-semibold">
                      Reset Password
                    </Link>
                  </div>
                </div>
              </div>
            )}

            {/* 3. EXPIRED TOKEN STATE */}
            {!successData && tokenStatus === 'expired' && (
              <div className="text-center py-6 space-y-6 animate-in fade-in duration-300">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-500/20 text-amber-400 mx-auto border border-amber-500/30">
                  <XCircle className="h-9 w-9" />
                </div>

                <div className="space-y-2">
                  <h3 className="text-2xl font-bold text-white">Verification Link Expired</h3>
                  <p className="text-xs text-slate-300 max-w-sm mx-auto">
                    For your security, verification links expire after 24 hours. Request a new link below.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 text-left space-y-3">
                  <div className="text-xs font-semibold text-slate-200">Request a fresh verification link:</div>
                  {resendSuccess ? (
                    <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs text-emerald-400">
                      A new link has been sent to your email. Please check your inbox.
                    </div>
                  ) : (
                    <form onSubmit={handleResend} className="space-y-2">
                      <input
                        type="email"
                        placeholder="Enter your registered work email"
                        value={resendEmail}
                        onChange={(e) => setResendEmail(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500"
                        required
                      />
                      <Button
                        type="submit"
                        variant="primary"
                        disabled={isResending}
                        className="w-full font-bold h-10 text-xs"
                      >
                        {isResending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            <RefreshCw className="h-3.5 w-3.5" />
                            <span>Resend Verification Link</span>
                          </>
                        )}
                      </Button>
                    </form>
                  )}
                </div>
              </div>
            )}

            {/* 4. PASSWORD SETUP FORM (TOKEN PRESENT & IDLE) */}
            {!successData && token && tokenStatus === 'idle' && (
              <div className="space-y-6 animate-in fade-in duration-300">
                <div className="text-center space-y-2">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 mx-auto mb-2">
                    <Lock className="h-6 w-6" />
                  </div>
                  <h2 className="text-2xl font-bold text-white">Set Your Password</h2>
                  <p className="text-xs text-slate-400 max-w-sm mx-auto">
                    Create a secure password to verify your email and complete your organization setup.
                  </p>
                </div>

                {error && (
                  <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-medium">
                    {error}
                  </div>
                )}

                <form onSubmit={handlePasswordSetup} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-300">
                      New Password (minimum 12 characters)
                    </label>
                    <div className="relative">
                      <Lock className="h-4 w-4 absolute left-3.5 top-3.5 text-slate-500" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-10 py-3 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 transition-colors"
                        required
                        minLength={12}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3.5 top-3.5 text-slate-500 hover:text-slate-300 cursor-pointer"
                        aria-label={showPassword ? 'Hide new password' : 'Show new password'}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>

                    {/* Password requirements meter */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 pt-2">
                      <div className="flex items-center gap-1.5 text-[11px]">
                        <div
                          className={`w-2 h-2 rounded-full transition-colors ${passwordChecks.length ? 'bg-emerald-500' : 'bg-slate-700'}`}
                        />
                        <span className={passwordChecks.length ? 'text-emerald-400 font-medium' : 'text-slate-500'}>
                          Min 12 characters
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 text-[11px]">
                        <div
                          className={`w-2 h-2 rounded-full transition-colors ${passwordChecks.upper ? 'bg-emerald-500' : 'bg-slate-700'}`}
                        />
                        <span className={passwordChecks.upper ? 'text-emerald-400 font-medium' : 'text-slate-500'}>
                          1 uppercase
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 text-[11px]">
                        <div
                          className={`w-2 h-2 rounded-full transition-colors ${passwordChecks.lower ? 'bg-emerald-500' : 'bg-slate-700'}`}
                        />
                        <span className={passwordChecks.lower ? 'text-emerald-400 font-medium' : 'text-slate-500'}>
                          1 lowercase
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 text-[11px]">
                        <div
                          className={`w-2 h-2 rounded-full transition-colors ${passwordChecks.number ? 'bg-emerald-500' : 'bg-slate-700'}`}
                        />
                        <span className={passwordChecks.number ? 'text-emerald-400 font-medium' : 'text-slate-500'}>
                          1 number
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 text-[11px]">
                        <div
                          className={`w-2 h-2 rounded-full transition-colors ${passwordChecks.special ? 'bg-emerald-500' : 'bg-slate-700'}`}
                        />
                        <span className={passwordChecks.special ? 'text-emerald-400 font-medium' : 'text-slate-500'}>
                          1 special symbol
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-300">
                      Confirm Password
                    </label>
                    <div className="relative">
                      <Lock className="h-4 w-4 absolute left-3.5 top-3.5 text-slate-500" />
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        placeholder="••••••••"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-10 py-3 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 transition-colors"
                        required
                        minLength={12}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3.5 top-3.5 text-slate-500 hover:text-slate-300 cursor-pointer"
                        aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                      >
                        {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <Button
                    type="submit"
                    variant="primary"
                    size="lg"
                    disabled={submitting}
                    className="w-full font-bold h-12 bg-[#714b67] hover:bg-[#5c3c54] text-white shadow-lg shadow-[#714b67]/25 rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-all"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Verifying & Setting Password...</span>
                      </>
                    ) : (
                      <>
                        <span>Complete Setup & Launch</span>
                        <ArrowRight className="h-4 w-4" />
                      </>
                    )}
                  </Button>
                </form>
              </div>
            )}

            {/* 5. TOKEN MISSING STATE */}
            {!successData && (!token || tokenStatus === 'invalid') && tokenStatus !== 'already_used' && tokenStatus !== 'expired' && (
              <div className="text-center py-6 space-y-6 animate-in fade-in duration-300">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-rose-500/20 text-rose-400 mx-auto border border-rose-500/30">
                  <XCircle className="h-9 w-9" />
                </div>

                <div className="space-y-2">
                  <h3 className="text-2xl font-bold text-white">Verification Link Missing</h3>
                  <p className="text-xs text-slate-300 max-w-sm mx-auto">
                    Please use the link sent to your registered email to set your password and activate your organization.
                  </p>
                </div>

                {/* Resend Form */}
                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 text-left space-y-3">
                  <div className="text-xs font-semibold text-slate-200">Request a new verification link:</div>
                  {resendSuccess ? (
                    <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs text-emerald-400">
                      A new link has been sent to your email. Please check your inbox.
                    </div>
                  ) : (
                    <form onSubmit={handleResend} className="space-y-2">
                      <input
                        type="email"
                        placeholder="Enter your registered work email"
                        value={resendEmail}
                        onChange={(e) => setResendEmail(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500"
                        required
                      />
                      <Button
                        type="submit"
                        variant="primary"
                        disabled={isResending}
                        className="w-full font-bold h-10 text-xs"
                      >
                        {isResending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            <RefreshCw className="h-3.5 w-3.5" />
                            <span>Resend Verification Link</span>
                          </>
                        )}
                      </Button>
                    </form>
                  )}
                </div>

                <div className="pt-2 text-center text-xs text-slate-400">
                  Need help?{' '}
                  <a href="mailto:support@orvio.com" className="text-indigo-400 hover:underline">
                    Contact Support
                  </a>
                </div>
              </div>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
