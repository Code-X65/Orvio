import * as React from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Zap, Mail, ArrowRight, Loader2, CheckCircle2, ArrowLeft } from 'lucide-react';
import { SeoHead } from '../../components/seo/SeoHead';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Card } from '../../components/ui/card';
import { forgotPassword } from '../../lib/api/auth';
import { ApiError } from '../../lib/api/client';

const ForgotPasswordSchema = z.object({
  email: z.string().email('Please enter a valid work email'),
});

type ForgotPasswordFormData = z.infer<typeof ForgotPasswordSchema>;

export function ForgotPasswordPage() {
  const [submitted, setSubmitted] = React.useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(ForgotPasswordSchema),
    defaultValues: { email: '' },
  });

  const emailValue = watch('email');

  const onSubmit = async (data: ForgotPasswordFormData) => {
    try {
      await forgotPassword(data.email);
      setSubmitted(true);
      toast.success('Password reset instructions sent!');
    } catch (err) {
      if (err instanceof ApiError) {
        toast.error(err.message);
      } else {
        toast.error('Failed to dispatch password reset request.');
      }
    }
  };

  return (
    <>
      <SeoHead
        title="Forgot Password | Orvio Hub"
        description="Reset your Orvio Hub administrator or workspace password."
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
            Reset Your Password
          </h2>
          <p className="mt-1.5 text-xs text-slate-400">
            We will send you a secure link to choose a new password
          </p>
        </div>

        <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md z-10">
          <Card className="bg-slate-900/90 border-slate-800 text-white shadow-2xl p-6 sm:p-8 backdrop-blur-xl">
            {submitted ? (
              <div className="text-center py-4 space-y-4 animate-in fade-in duration-300">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 mx-auto border border-emerald-500/30">
                  <CheckCircle2 className="h-8 w-8" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-lg font-bold text-white">Check your email</h3>
                  <p className="text-xs text-slate-300">
                    If an account exists for <strong className="text-white">{emailValue}</strong>, we've sent instructions to reset your password.
                  </p>
                </div>
                <div className="pt-4 border-t border-slate-800">
                  <Link to="/login" className="inline-flex items-center gap-1.5 text-xs text-indigo-400 hover:underline font-bold">
                    <ArrowLeft className="h-3.5 w-3.5" />
                    <span>Return to Sign In</span>
                  </Link>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div className="space-y-1">
                  <label htmlFor="email" className="text-xs font-semibold text-slate-300">
                    Registered Work Email *
                  </label>
                  <div className="relative">
                    <Mail className="h-4 w-4 absolute left-3.5 top-3.5 text-slate-500" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="admin@company.com"
                      className="bg-slate-950 border-slate-800 pl-10 text-white text-xs h-11"
                      {...register('email')}
                    />
                  </div>
                  {errors.email && (
                    <span className="text-[11px] text-rose-400">{errors.email.message}</span>
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
                      <span>Send Reset Link</span>
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </Button>

                <div className="pt-3 border-t border-slate-800 text-center text-xs text-slate-400">
                  Remember your password?{' '}
                  <Link to="/login" className="text-indigo-400 hover:underline font-bold">
                    Sign In
                  </Link>
                </div>
              </form>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
