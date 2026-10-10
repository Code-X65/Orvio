import * as React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import {
  Zap,
  Lock,
  Mail,
  ArrowRight,
  Loader2,
  Eye,
  EyeOff,
  Building2,
  Sparkles,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { SeoHead } from '../../components/seo/SeoHead';
import { Button } from '../../components/ui/button';
import { loginUser, checkSubdomainAvailability, requestMagicLogin } from '../../domains/auth/api';
import { ApiError } from '../../lib/api';
import { useAuthStore } from '../../stores/auth-store';
import {
  isTenantSubdomain,
  getSubdomainFromHostname,
  getTenantWorkspaceUrl,
  getAccountsBaseUrl,
  getMainMarketingUrl,
  getTrialUrl,
  getSubdomainDisplaySuffix,
  sanitizeReturnUrl,
  getLastVisitedPath,
} from '../../app/config/authUrls';

const LoginSchema = z.object({
  email: z.string().email('Please enter a valid business email'),
  password: z.string().min(1, 'Please enter your password'),
});

type LoginFormData = z.infer<typeof LoginSchema>;

export function LoginPage() {
  const isTenant = isTenantSubdomain();
  const tenantSlug = getSubdomainFromHostname() || '';

  // Central Subdomain Lookup State
  const [subdomainInput, setSubdomainInput] = React.useState('');
  const [checkingSubdomain, setCheckingSubdomain] = React.useState(false);
  const [subdomainError, setSubdomainError] = React.useState<string | null>(null);

  // Tenant Login State
  const [showPassword, setShowPassword] = React.useState(false);
  const [sendingMagicLink, setSendingMagicLink] = React.useState(false);
  const [magicLinkSent, setMagicLinkSent] = React.useState(false);

  const displaySuffix = getSubdomainDisplaySuffix();

  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormData>({
    resolver: zodResolver(LoginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const location = useLocation();
  const searchParams = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
  const rawReturnUrl = searchParams.get('returnUrl') || (location.state as { returnUrl?: string; from?: { pathname?: string } })?.returnUrl || (location.state as { from?: { pathname?: string } })?.from?.pathname;

  // 1. Handle Central Subdomain Lookup (on root domain or accounts subdomain)
  const handleSubdomainLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = subdomainInput
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]/g, '');

    if (!clean || clean.length < 3) {
      setSubdomainError('Please enter a valid organization subdomain (at least 3 characters).');
      return;
    }

    setCheckingSubdomain(true);
    setSubdomainError(null);

    try {
      const res = await checkSubdomainAvailability(clean);

      // If available is FALSE and reason is ALREADY_TAKEN, the organization exists in database!
      if (!res.available && res.reason === 'ALREADY_TAKEN') {
        const queryParam = rawReturnUrl ? `?returnUrl=${encodeURIComponent(rawReturnUrl)}` : '';
        const targetUrl = `${getTenantWorkspaceUrl(clean)}/login${queryParam}`;
        window.location.href = targetUrl;
      } else {
        setSubdomainError(`No organization workspace found for "${clean}".`);
      }
    } catch {
      setSubdomainError('Could not verify organization subdomain. Please check your network connection.');
    } finally {
      setCheckingSubdomain(false);
    }
  };

  const navigate = useNavigate();

  // 2. Handle Tenant Login Submission
  const onTenantSubmit = async (data: LoginFormData) => {
    try {
      const response = await loginUser({
        email: data.email,
        password: data.password,
        subdomain: tenantSlug || undefined,
      });

      if (response.accessToken && response.user && response.organization) {
        useAuthStore.getState().setSession(
          response.accessToken,
          response.user,
          response.organization,
          response.user.emailVerifiedAt ? 'authenticated' : 'pending-verification'
        );
      }

      toast.success(`Welcome back, ${response.user.fullName}!`);

      const currentSubdomain = getSubdomainFromHostname();
      const targetSubdomain = response.organization?.subdomain || tenantSlug;

      // Determine return path: query param -> last visited path -> default to /orvio
      const lastPath = targetSubdomain ? getLastVisitedPath(targetSubdomain) : null;
      const targetDestination = sanitizeReturnUrl(rawReturnUrl || lastPath || '/orvio', '/orvio');

      if (targetSubdomain && currentSubdomain && currentSubdomain.toLowerCase() !== targetSubdomain.toLowerCase()) {
        window.location.href = `${getTenantWorkspaceUrl(targetSubdomain)}${targetDestination}?token=${encodeURIComponent(response.accessToken)}`;
      } else if (!currentSubdomain && targetSubdomain) {
        window.location.href = `${getTenantWorkspaceUrl(targetSubdomain)}${targetDestination}?token=${encodeURIComponent(response.accessToken)}`;
      } else {
        navigate(targetDestination);
      }
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === 'PASSWORD_NOT_SET') {
          toast.error(
            'You have not set a permanent password yet. Click "Email me a sign-in link" below to access your workspace.'
          );
        } else if (err.code === 'ORGANIZATION_ACCESS_DENIED') {
          toast.error(`Your account does not have access to the "${tenantSlug}" workspace.`);
        } else if (err.code === 'EMAIL_NOT_VERIFIED') {
          toast.error('Your email is not verified yet. Please check your inbox or request a sign-in link.');
        } else {
          toast.error(err.message || 'Invalid email or password.');
        }
      } else {
        toast.error('Login failed. Please check your credentials.');
      }
    }
  };

  // 3. Handle Passwordless Magic Login / Setup Link Request
  const handleRequestMagicLink = async () => {
    const email = getValues('email')?.trim().toLowerCase();
    if (!email || !email.includes('@')) {
      toast.error('Please enter your business email address first to receive a sign-in setup link.');
      return;
    }

    setSendingMagicLink(true);
    try {
      await requestMagicLogin({
        email,
        subdomain: tenantSlug || undefined,
      });
      setMagicLinkSent(true);
      toast.success(`Sign-in setup link dispatched to ${email}!`);
    } catch {
      toast.error('Failed to send sign-in link. Please try again.');
    } finally {
      setSendingMagicLink(false);
    }
  };

  return (
    <>
      <SeoHead
        title={
          isTenant
            ? `Sign In to ${tenantSlug} | Orvio Workspace`
            : 'Sign In to Your Workspace | Orvio Hub'
        }
        description="Access your Orvio Hub inventory, POS cashier desk, and business management apps."
      />

      <div
        className="min-h-screen bg-[#111215] text-slate-100 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 relative overflow-x-hidden font-sans selection:bg-[#985184] selection:text-white"
        style={{
          backgroundImage: 'radial-gradient(circle, rgba(255, 255, 255, 0.07) 1px, transparent 1px)',
          backgroundSize: '24px 24px',
        }}
      >
        {/* Subtle Ambient Glow with #985184 */}
        <div className="fixed top-1/3 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-[#985184]/12 rounded-full blur-[140px] pointer-events-none -z-10" />

        <div className="sm:mx-auto sm:w-full sm:max-w-md text-center z-10">
          <a
            href={getMainMarketingUrl()}
            className="inline-flex items-center gap-2.5 group"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-sm bg-[#985184] text-white shadow-sm group-hover:scale-105 transition-transform">
              <Zap className="h-4 w-4 fill-white" />
            </div>
            <span className="text-xl font-black tracking-tight text-white">
              Orvio<span className="text-[#fbb945]">Hub</span>
            </span>
          </a>

          <h1 className="mt-4 text-2xl font-black tracking-tight text-white">
            {isTenant ? `Sign In to ${tenantSlug}` : 'Sign In to Your Workspace'}
          </h1>
          <p className="mt-1 text-xs text-slate-400">
            {isTenant
              ? 'Enter your credentials to access your organization dashboard'
              : 'Enter your organization subdomain to continue to your workspace'}
          </p>
        </div>

        {/* Form Container (No card background, no borders, max rounded-sm) */}
        <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md z-10">
          <div className="bg-transparent text-white p-4 sm:p-6 w-full">
            {!isTenant ? (
              /* ============================================================ */
              /* 1. CENTRAL SUBDOMAIN LOOKUP FORM                             */
              /* ============================================================ */
              <form onSubmit={handleSubdomainLookup} className="space-y-5">
                <div className="space-y-1">
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Organization Subdomain <span className="text-[#fbb945]">*</span>
                  </label>

                  <div className="flex items-center border-0 border-b border-white/20 focus-within:border-[#985184] transition-colors">
                    <span className="pr-1 text-xs text-slate-500 select-none font-mono">
                      https://
                    </span>
                    <input
                      type="text"
                      placeholder="your-company"
                      value={subdomainInput}
                      onChange={(e) => {
                        setSubdomainInput(
                          e.target.value
                            .toLowerCase()
                            .replace(/[^a-z0-9]/g, '')
                            .slice(0, 30)
                        );
                        if (subdomainError) setSubdomainError(null);
                      }}
                      className="w-full bg-transparent py-2.5 text-xs text-white placeholder:text-slate-600 focus:outline-none font-medium"
                      autoFocus
                    />
                    <span className="pl-1 text-xs font-mono text-[#fbb945] select-none font-bold">
                      {displaySuffix}
                    </span>
                  </div>

                  {subdomainError && (
                    <div className="flex items-start gap-1.5 text-[11px] text-rose-400 pt-1">
                      <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                      <span>{subdomainError}</span>
                    </div>
                  )}
                </div>

                <Button
                  type="submit"
                  size="sm"
                  disabled={checkingSubdomain || !subdomainInput.trim()}
                  className="w-full font-semibold h-10 mt-2 bg-[#985184] hover:bg-[#854372] text-white rounded-sm shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer text-xs"
                >
                  {checkingSubdomain ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-white" />
                      <span>Locating Workspace...</span>
                    </>
                  ) : (
                    <>
                      <span>Continue to Workspace</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </>
                  )}
                </Button>

                <div className="pt-4 border-t border-white/5 text-center text-xs text-slate-400">
                  Don't have a workspace yet?{' '}
                  <a href={getTrialUrl()} className="text-[#fbb945] hover:underline font-semibold">
                    Start 14-Day Free Trial
                  </a>
                </div>
              </form>
            ) : (
              /* ============================================================ */
              /* 2. DEDICATED TENANT SUBDOMAIN LOGIN FORM                     */
              /* ============================================================ */
              <form onSubmit={handleSubmit(onTenantSubmit)} className="space-y-5">
                {/* Active Subdomain Badge */}
                <div className="flex items-center justify-between py-2 border-b border-white/10 text-xs">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-3.5 w-3.5 text-[#fbb945]" />
                    <span className="font-mono text-slate-200 font-semibold">{tenantSlug}{displaySuffix}</span>
                  </div>
                  <a
                    href={`${getAccountsBaseUrl()}/login?switch=true`}
                    onClick={() => useAuthStore.getState().clearSession()}
                    className="text-[11px] text-[#fbb945] hover:underline font-medium cursor-pointer"
                  >
                    Switch
                  </a>
                </div>

                {/* Email Field */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Business Email <span className="text-[#fbb945]">*</span>
                  </label>
                  <div className="relative border-0 border-b border-white/20 focus-within:border-[#985184] transition-colors">
                    <Mail className="h-3.5 w-3.5 absolute left-0 top-3 text-slate-500" />
                    <input
                      type="email"
                      placeholder="admin@company.com"
                      className="w-full bg-transparent pl-6 py-2 text-xs text-white placeholder:text-slate-600 focus:outline-none"
                      {...register('email')}
                    />
                  </div>
                  {errors.email && (
                    <span className="text-[11px] text-rose-400">{errors.email.message}</span>
                  )}
                </div>

                {/* Password Field */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                      Password <span className="text-[#fbb945]">*</span>
                    </label>
                    <Link
                      to="/forgot-password"
                      className="text-[11px] text-[#fbb945] hover:underline"
                    >
                      Forgot password?
                    </Link>
                  </div>
                  <div className="relative border-0 border-b border-white/20 focus-within:border-[#985184] transition-colors">
                    <Lock className="h-3.5 w-3.5 absolute left-0 top-3 text-slate-500" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      placeholder="••••••••"
                      className="w-full bg-transparent pl-6 pr-8 py-2 text-xs text-white placeholder:text-slate-600 focus:outline-none"
                      {...register('password')}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-0 top-2.5 text-slate-500 hover:text-slate-300 cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                  {errors.password && (
                    <span className="text-[11px] text-rose-400">{errors.password.message}</span>
                  )}
                </div>

                {/* Submit Sign In Button */}
                <Button
                  type="submit"
                  size="sm"
                  disabled={isSubmitting}
                  className="w-full font-semibold h-10 mt-2 bg-[#985184] hover:bg-[#854372] text-white rounded-sm shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer text-xs"
                >
                  {isSubmitting ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-white" />
                  ) : (
                    <>
                      <span>Sign In</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </>
                  )}
                </Button>

                {/* Passwordless Magic Sign-In */}
                <div className="pt-2 text-center">
                  <button
                    type="button"
                    onClick={handleRequestMagicLink}
                    disabled={sendingMagicLink}
                    className="text-xs text-slate-400 hover:text-[#fbb945] underline inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    {sendingMagicLink ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-[#985184]" />
                    ) : (
                      <Sparkles className="h-3.5 w-3.5 text-[#fbb945]" />
                    )}
                    <span>No password yet? Email me a sign-in setup link</span>
                  </button>

                  {magicLinkSent && (
                    <p className="text-[11px] text-emerald-400 mt-1 flex items-center justify-center gap-1">
                      <CheckCircle2 className="h-3 w-3" />
                      <span>Sign-in setup link sent! Please check your inbox.</span>
                    </p>
                  )}
                </div>

                <div className="pt-4 border-t border-white/5 text-center text-xs text-slate-400">
                  Need a new workspace?{' '}
                  <a href={getTrialUrl()} className="text-[#fbb945] hover:underline font-semibold">
                    Start 14-Day Free Trial
                  </a>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
export default LoginPage;
