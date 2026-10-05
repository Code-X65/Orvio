import * as React from 'react';
import { Link, useNavigate } from 'react-router-dom';
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
import { Input } from '../../components/ui/input';
import { Card } from '../../components/ui/card';
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
        const targetUrl = `${getTenantWorkspaceUrl(clean)}/login`;
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
      const targetSubdomain = response.organization?.subdomain;

      if (targetSubdomain && currentSubdomain && currentSubdomain.toLowerCase() !== targetSubdomain.toLowerCase()) {
        window.location.href = `${getTenantWorkspaceUrl(targetSubdomain)}/orvio?token=${encodeURIComponent(response.accessToken)}`;
      } else if (!currentSubdomain && targetSubdomain) {
        window.location.href = `${getTenantWorkspaceUrl(targetSubdomain)}/orvio?token=${encodeURIComponent(response.accessToken)}`;
      } else {
        navigate('/orvio');
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

      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
        {/* Ambient atmospheric glows */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="sm:mx-auto sm:w-full sm:max-w-md text-center z-10">
          <a
            href={getMainMarketingUrl()}
            className="inline-flex items-center gap-2.5 group"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-500 via-indigo-600 to-sky-400 text-white shadow-lg shadow-indigo-500/25 group-hover:scale-105 transition-transform">
              <Zap className="h-5 w-5 fill-white" />
            </div>
            <span className="text-2xl font-black tracking-tight text-white">
              Orvio<span className="text-indigo-400">Hub</span>
            </span>
          </a>

          <h2 className="mt-4 text-3xl font-black tracking-tight text-white">
            {isTenant ? `Sign In to ${tenantSlug}` : 'Sign In to Your Workspace'}
          </h2>
          <p className="mt-1.5 text-xs text-slate-400">
            {isTenant
              ? 'Enter your credentials to access your organization dashboard'
              : 'Enter your organization subdomain to continue to your workspace'}
          </p>
        </div>

        <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md z-10">
          <Card className="bg-slate-900/90 border-slate-800 text-white shadow-2xl p-6 sm:p-8 backdrop-blur-xl rounded-3xl">
            {!isTenant ? (
              /* ============================================================ */
              /* 1. CENTRAL SUBDOMAIN LOOKUP FORM                             */
              /* ============================================================ */
              <form onSubmit={handleSubdomainLookup} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">
                    Organization Subdomain <span className="text-rose-400">*</span>
                  </label>

                  <div className="flex items-center rounded-xl bg-slate-950 border border-slate-800 focus-within:border-indigo-500 focus-within:ring-1 focus-within:ring-indigo-500/20 transition-all overflow-hidden">
                    <span className="pl-3.5 pr-1 text-xs font-semibold text-slate-500 select-none">
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
                      className="w-full bg-transparent px-1 py-3 text-xs text-white placeholder:text-slate-600 focus:outline-none font-medium"
                      autoFocus
                    />
                    <span className="pr-3.5 pl-1 text-xs font-bold text-indigo-400 select-none">
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
                  variant="primary"
                  size="lg"
                  disabled={checkingSubdomain || !subdomainInput.trim()}
                  className="w-full font-bold h-12 mt-2 shadow-lg shadow-indigo-600/30 rounded-xl cursor-pointer"
                >
                  {checkingSubdomain ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Locating Workspace...</span>
                    </>
                  ) : (
                    <>
                      <span>Continue to Workspace</span>
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </Button>

                <div className="pt-4 border-t border-slate-800 text-center text-xs text-slate-400">
                  Don't have a workspace yet?{' '}
                  <a href={getTrialUrl()} className="text-indigo-400 hover:underline font-bold">
                    Start 14-Day Free Trial
                  </a>
                </div>
              </form>
            ) : (
              /* ============================================================ */
              /* 2. DEDICATED TENANT SUBDOMAIN LOGIN FORM                     */
              /* ============================================================ */
              <form onSubmit={handleSubmit(onTenantSubmit)} className="space-y-4">
                {/* Active Subdomain Badge */}
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-indigo-400" />
                    <span className="font-mono text-slate-300 font-semibold">{tenantSlug}{displaySuffix}</span>
                  </div>
                  <a
                    href={`${getAccountsBaseUrl()}/login?switch=true`}
                    onClick={() => useAuthStore.getState().clearSession()}
                    className="text-[11px] text-indigo-400 hover:underline font-medium cursor-pointer"
                  >
                    Switch
                  </a>
                </div>

                {/* Email Field */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-300">
                    Business Email <span className="text-rose-400">*</span>
                  </label>
                  <div className="relative">
                    <Mail className="h-4 w-4 absolute left-3.5 top-3.5 text-slate-500" />
                    <Input
                      type="email"
                      placeholder="admin@company.com"
                      className="bg-slate-950 border-slate-800 pl-10 text-white text-xs h-11 rounded-xl"
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
                    <label className="text-xs font-semibold text-slate-300">
                      Password <span className="text-rose-400">*</span>
                    </label>
                    <Link
                      to="/forgot-password"
                      className="text-[11px] text-indigo-400 hover:underline"
                    >
                      Forgot password?
                    </Link>
                  </div>
                  <div className="relative">
                    <Lock className="h-4 w-4 absolute left-3.5 top-3.5 text-slate-500" />
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      placeholder="••••••••"
                      className="bg-slate-950 border-slate-800 pl-10 pr-10 text-white text-xs h-11 rounded-xl"
                      {...register('password')}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-3.5 text-slate-500 hover:text-slate-300 cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {errors.password && (
                    <span className="text-[11px] text-rose-400">{errors.password.message}</span>
                  )}
                </div>

                {/* Submit Sign In Button */}
                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  disabled={isSubmitting}
                  className="w-full font-bold h-12 mt-2 shadow-lg shadow-indigo-600/30 rounded-xl cursor-pointer"
                >
                  {isSubmitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <span>Sign In</span>
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </Button>

                {/* Passwordless Magic Sign-In / Setup Option for Owners */}
                <div className="pt-2 text-center">
                  <button
                    type="button"
                    onClick={handleRequestMagicLink}
                    disabled={sendingMagicLink}
                    className="text-xs text-slate-400 hover:text-indigo-300 underline inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    {sendingMagicLink ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="h-3.5 w-3.5 text-indigo-400" />
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

                <div className="pt-3 border-t border-slate-800 text-center text-xs text-slate-400">
                  Need a new workspace?{' '}
                  <a href={getTrialUrl()} className="text-indigo-400 hover:underline font-bold">
                    Start 14-Day Free Trial
                  </a>
                </div>
              </form>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
