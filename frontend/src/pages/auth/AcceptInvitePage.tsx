import * as React from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { Shield, Building2, CheckCircle2, AlertCircle, ArrowRight, Lock, User } from 'lucide-react';
import { toast } from 'sonner';
import { staffApi, type InvitationMetadataResponse } from '../../features/staff/api/staff-api';
import { useAuthStore } from '../../stores/auth-store';
import { SeoHead } from '../../components/seo/SeoHead';

export function AcceptInvitePage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();

  const [invitation, setInvitation] = React.useState<InvitationMetadataResponse | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  // Form state
  const [fullName, setFullName] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!token) {
      setErrorMsg('Missing invitation token in the link.');
      setIsLoading(false);
      return;
    }

    const fetchInvite = async () => {
      try {
        const data = await staffApi.getInvitationByToken(token);
        setInvitation(data);
        if (data.email) {
          const defaultName = data.email.split('@')[0].replace(/[._-]/g, ' ');
          setFullName(defaultName.charAt(0).toUpperCase() + defaultName.slice(1));
        }
      } catch (err: any) {
        setErrorMsg(err.message || 'Invitation is invalid, expired, or has already been accepted.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchInvite();
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!token) return;

    if (fullName.trim().length < 2) {
      setFormError('Please enter your full name');
      return;
    }

    if (password.length < 12) {
      setFormError('Password must be at least 12 characters long');
      return;
    }

    if (password !== confirmPassword) {
      setFormError('Passwords do not match');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await staffApi.acceptInvitation(token, {
        fullName: fullName.trim(),
        password,
      });

      // Save authenticated session in Zustand auth store
      useAuthStore.getState().setSession(
        res.accessToken,
        {
          id: res.user.id,
          email: res.user.email,
          fullName: res.user.fullName,
          status: 'active',
        },
        {
          id: res.organization.id,
          name: res.organization.name,
          subdomain: res.organization.subdomain,
          status: 'active',
        },
        'authenticated'
      );

      toast.success(`Welcome to ${res.organization.name}!`);

      // Determine redirect URL
      const currentHost = window.location.host;
      if (currentHost.includes('localhost') && !currentHost.startsWith(res.organization.subdomain)) {
        // Redirect to tenant subdomain on localhost
        const port = window.location.port ? `:${window.location.port}` : '';
        const target = `${window.location.protocol}//${res.organization.subdomain}.localhost${port}/inventory`;
        window.location.href = target;
      } else {
        navigate('/inventory', { replace: true });
      }
    } catch (err: any) {
      const msg = err.message || 'Failed to accept invitation';
      setFormError(msg);
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="min-h-screen text-slate-100 flex flex-col justify-center items-center px-4 py-12 selection:bg-[#714b67] selection:text-white antialiased font-sans"
      style={{
        backgroundColor: '#0d0b11',
        backgroundImage: `
          radial-gradient(at 0% 0%, rgba(113, 75, 103, 0.22) 0px, transparent 45%),
          radial-gradient(at 100% 0%, rgba(251, 185, 69, 0.09) 0px, transparent 40%),
          radial-gradient(at 50% 100%, rgba(113, 75, 103, 0.12) 0px, transparent 50%)
        `,
        backgroundAttachment: 'fixed',
      }}
    >
      <SeoHead
        title="Accept Invitation — Orvio"
        description="Join your team workspace on Orvio."
      />

      {/* Brand Header */}
      <div className="mb-8 text-center">
        <Link to="/" className="inline-flex items-center space-x-2 group">
          <span className="text-3xl font-black tracking-tight text-white group-hover:text-amber-50 transition-colors">
            orvio
          </span>
          <span className="h-2.5 w-2.5 rounded-full bg-[#714b67] group-hover:bg-[#fbb945] animate-pulse transition-colors duration-300" />
        </Link>
      </div>

      <div className="w-full max-w-md bg-[#181a20] border border-[#2b2f3a] rounded-2xl shadow-2xl overflow-hidden p-6 sm:p-8">
        {isLoading ? (
          <div className="py-12 text-center text-slate-400 space-y-3">
            <div className="w-7 h-7 border-2 border-white/20 border-t-[#714b67] rounded-full animate-spin mx-auto" />
            <p className="text-xs">Verifying invitation link...</p>
          </div>
        ) : errorMsg || !invitation ? (
          <div className="py-8 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mx-auto">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Invitation Unavailable</h2>
              <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
                {errorMsg || 'This invitation has expired or has already been used.'}
              </p>
            </div>
            <div className="pt-2">
              <Link
                to="/login"
                className="inline-flex items-center justify-center px-4 py-2 bg-[#714b67] hover:bg-[#87597b] text-white text-xs font-semibold rounded-lg transition-colors"
              >
                Go to Sign in
              </Link>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Org Welcome Banner */}
            <div className="text-center pb-4 border-b border-[#2b2f3a]">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-[#714b67] to-purple-600 flex items-center justify-center mx-auto mb-3 shadow-lg shadow-[#714b67]/30 text-white font-extrabold text-lg">
                {invitation.organization.name.charAt(0).toUpperCase()}
              </div>
              <h2 className="text-lg font-bold text-white">Join {invitation.organization.name}</h2>
              <p className="text-xs text-slate-400 mt-1">
                You were invited as{' '}
                <span className="text-[#fbb945] font-semibold uppercase">{invitation.role}</span>
              </p>

              {invitation.branches.length > 0 && (
                <div className="flex flex-wrap justify-center gap-1.5 mt-2.5">
                  {invitation.branches.map((b) => (
                    <span
                      key={b.id}
                      className="text-[10px] bg-white/5 border border-[#3b3f4d] text-slate-300 px-2 py-0.5 rounded-full flex items-center gap-1"
                    >
                      <Building2 className="w-2.5 h-2.5 text-slate-400" />
                      {b.name}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {formError && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg text-rose-400 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            {/* Email (Readonly) */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-400 block">Invited Email</label>
              <div className="w-full bg-[#121418]/60 border border-[#2b2f3a] rounded-lg px-3.5 py-2 text-xs text-slate-400 font-mono">
                {invitation.email}
              </div>
            </div>

            {/* Full Name */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-300 block">
                Full Name <span className="text-[#fbb945]">*</span>
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Adebayo Ogunlesi"
                  required
                  className="w-full bg-[#121418] border border-[#2b2f3a] rounded-lg pl-9 pr-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#714b67]"
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-300 block flex items-center justify-between">
                <span>Set Password <span className="text-[#fbb945]">*</span></span>
                <span className="text-[11px] text-slate-500">Min. 12 characters</span>
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Create a secure password"
                  required
                  minLength={12}
                  className="w-full bg-[#121418] border border-[#2b2f3a] rounded-lg pl-9 pr-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#714b67]"
                />
              </div>
            </div>

            {/* Confirm Password */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-300 block">
                Confirm Password <span className="text-[#fbb945]">*</span>
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repeat password"
                  required
                  minLength={12}
                  className="w-full bg-[#121418] border border-[#2b2f3a] rounded-lg pl-9 pr-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#714b67]"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full mt-2 py-2.5 px-4 bg-[#714b67] hover:bg-[#87597b] text-white text-xs font-bold rounded-lg shadow-md shadow-[#714b67]/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50 active:scale-95 cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Joining Workspace...</span>
                </>
              ) : (
                <>
                  <span>Accept & Enter Workspace</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
