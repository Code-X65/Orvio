import * as React from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Zap, Lock, ArrowRight, Loader2, CheckCircle2, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { SeoHead } from '../../components/seo/SeoHead';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Card } from '../../components/ui/card';
import { resetPassword } from '../../lib/api/auth';
import { ApiError } from '../../lib/api/client';

const ResetPasswordSchema = z
  .object({
    password: z
      .string()
      .min(12, 'Password must be at least 12 characters')
      .regex(/[A-Z]/, 'Must contain at least one uppercase letter')
      .regex(/[a-z]/, 'Must contain at least one lowercase letter')
      .regex(/[0-9]/, 'Must contain at least one number')
      .regex(/[^A-Za-z0-9]/, 'Must contain at least one special character'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

type ResetPasswordFormData = z.infer<typeof ResetPasswordSchema>;

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();

  const [showPassword, setShowPassword] = React.useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = React.useState(false);
  const [success, setSuccess] = React.useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordFormData>({
    resolver: zodResolver(ResetPasswordSchema),
    defaultValues: { password: '', confirmPassword: '' },
  });

  const watchedPassword = watch('password') || '';
  const passwordChecks = {
    length: watchedPassword.length >= 12,
    upper: /[A-Z]/.test(watchedPassword),
    lower: /[a-z]/.test(watchedPassword),
    number: /[0-9]/.test(watchedPassword),
    special: /[^A-Za-z0-9]/.test(watchedPassword),
  };

  const onSubmit = async (data: ResetPasswordFormData) => {
    if (!token) {
      toast.error('Missing reset token. Please use the link in your email.');
      return;
    }

    try {
      await resetPassword(token, data.password);
      setSuccess(true);
      toast.success('Password reset successfully! Please log in.');
      setTimeout(() => navigate('/login'), 3000);
    } catch (err) {
      if (err instanceof ApiError) {
        toast.error(err.message);
      } else {
        toast.error('Failed to reset password. The link may have expired.');
      }
    }
  };

  if (!token) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <Card className="bg-slate-900 border-slate-800 p-8 text-center space-y-4">
            <AlertCircle className="h-12 w-12 text-rose-500 mx-auto" />
            <h2 className="text-xl font-bold text-white">Invalid Reset Link</h2>
            <p className="text-xs text-slate-400">
              No password reset token was provided. Please check the link from your email.
            </p>
            <Link to="/forgot-password">
              <Button variant="primary" size="default" className="w-full mt-2 font-bold">
                Request New Link
              </Button>
            </Link>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <>
      <SeoHead
        title="Set New Password | Orvio Hub"
        description="Choose a new secure password for your Orvio Hub account."
      />

      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="sm:mx-auto sm:w-full sm:max-w-md text-center z-10">
          <Link to="/" className="inline-flex items-center gap-2.5 group">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-500 via-indigo-600 to-sky-400 text-white shadow-lg shadow-indigo-500/25 group-hover:scale-105 transition-transform">
              <Zap className="h-5 w-5 fill-white" />
            </div>
            <span className="text-2xl font-black tracking-tight text-white">
              Orvio<span className="text-indigo-400">Hub</span>
            </span>
          </Link>
          <h2 className="mt-4 text-3xl font-black tracking-tight text-white">
            Set New Password
          </h2>
          <p className="mt-1.5 text-xs text-slate-400">
            Create a strong, unique password for your account
          </p>
        </div>

        <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md z-10">
          <Card className="bg-slate-900/90 border-slate-800 text-white shadow-2xl p-6 sm:p-8 backdrop-blur-xl">
            {success ? (
              <div className="text-center py-4 space-y-4 animate-in fade-in duration-300">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 mx-auto border border-emerald-500/30">
                  <CheckCircle2 className="h-8 w-8" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-lg font-bold text-white">Password Changed!</h3>
                  <p className="text-xs text-slate-300">
                    Your password has been updated. Redirecting to sign in...
                  </p>
                </div>
                <Link to="/login" className="block pt-2">
                  <Button variant="primary" size="default" className="w-full font-bold">
                    Go to Sign In
                  </Button>
                </Link>
              </div>
            ) : (
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div className="space-y-1">
                  <label htmlFor="password" className="text-xs font-semibold text-slate-300">
                    New Password *
                  </label>
                  <div className="relative">
                    <Lock className="h-4 w-4 absolute left-3.5 top-3.5 text-slate-500" />
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      placeholder="••••••••"
                      className="bg-slate-950 border-slate-800 pl-10 pr-10 text-white text-xs h-11"
                      {...register('password')}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-3.5 text-slate-500 hover:text-slate-300"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {errors.password && (
                    <span className="text-[11px] text-rose-400">{errors.password.message}</span>
                  )}

                  {/* Password requirements meter */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 pt-2">
                    <div className="flex items-center gap-1.5 text-[11px]">
                      <div className={`w-2 h-2 rounded-full transition-colors ${passwordChecks.length ? 'bg-emerald-500' : 'bg-slate-700'}`} />
                      <span className={passwordChecks.length ? 'text-emerald-400 font-medium' : 'text-slate-500'}>Min 12 characters</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px]">
                      <div className={`w-2 h-2 rounded-full transition-colors ${passwordChecks.upper ? 'bg-emerald-500' : 'bg-slate-700'}`} />
                      <span className={passwordChecks.upper ? 'text-emerald-400 font-medium' : 'text-slate-500'}>1 uppercase</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px]">
                      <div className={`w-2 h-2 rounded-full transition-colors ${passwordChecks.lower ? 'bg-emerald-500' : 'bg-slate-700'}`} />
                      <span className={passwordChecks.lower ? 'text-emerald-400 font-medium' : 'text-slate-500'}>1 lowercase</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px]">
                      <div className={`w-2 h-2 rounded-full transition-colors ${passwordChecks.number ? 'bg-emerald-500' : 'bg-slate-700'}`} />
                      <span className={passwordChecks.number ? 'text-emerald-400 font-medium' : 'text-slate-500'}>1 number</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px]">
                      <div className={`w-2 h-2 rounded-full transition-colors ${passwordChecks.special ? 'bg-emerald-500' : 'bg-slate-700'}`} />
                      <span className={passwordChecks.special ? 'text-emerald-400 font-medium' : 'text-slate-500'}>1 special symbol</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-1">
                  <label htmlFor="confirmPassword" className="text-xs font-semibold text-slate-300">
                    Confirm New Password *
                  </label>
                  <div className="relative">
                    <Lock className="h-4 w-4 absolute left-3.5 top-3.5 text-slate-500" />
                    <Input
                      id="confirmPassword"
                      type={showConfirmPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      placeholder="••••••••"
                      className="bg-slate-950 border-slate-800 pl-10 pr-10 text-white text-xs h-11"
                      {...register('confirmPassword')}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3.5 top-3.5 text-slate-500 hover:text-slate-300 cursor-pointer"
                      aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                    >
                      {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {errors.confirmPassword && (
                    <span className="text-[11px] text-rose-400">{errors.confirmPassword.message}</span>
                  )}
                </div>

                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  disabled={isSubmitting}
                  className="w-full font-bold h-12 mt-2 shadow-lg shadow-indigo-600/30"
                >
                  {isSubmitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <span>Update Password</span>
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </Button>
              </form>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
