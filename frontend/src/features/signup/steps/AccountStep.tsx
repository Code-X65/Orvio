import * as React from 'react';
import { useFormContext } from 'react-hook-form';
import { Link } from 'react-router-dom';
import { User, Mail, Phone, Lock, Eye, EyeOff, ArrowRight } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import type { SignupFormData } from '../schema';

export interface AccountStepProps {
  onNext: () => void;
}

export function AccountStep({ onNext }: AccountStepProps) {
  const {
    register,
    watch,
    formState: { errors },
  } = useFormContext<SignupFormData>();

  const [showPassword, setShowPassword] = React.useState(false);
  const watchedPassword = watch('password') || '';

  const passwordChecks = {
    length: watchedPassword.length >= 12,
    upper: /[A-Z]/.test(watchedPassword),
    lower: /[a-z]/.test(watchedPassword),
    number: /[0-9]/.test(watchedPassword),
    special: /[^A-Za-z0-9]/.test(watchedPassword),
  };

  return (
    <form onSubmit={onNext} className="space-y-4 animate-in fade-in duration-200">
      <div className="space-y-1 mb-5">
        <h3 className="text-xl font-bold text-white">Create your administrator account</h3>
        <p className="text-xs text-slate-400">Step 1 of 2: Set your personal login credentials</p>
      </div>

      <div className="space-y-1">
        <label htmlFor="fullName" className="text-xs font-semibold text-slate-300">
          Full Name *
        </label>
        <div className="relative">
          <User className="h-4 w-4 absolute left-3.5 top-3.5 text-slate-500" />
          <Input
            id="fullName"
            placeholder="e.g. Alex Adeleke"
            className="bg-slate-950 border-slate-800 pl-10 text-white text-xs h-11"
            {...register('fullName')}
          />
        </div>
        {errors.fullName && (
          <span className="text-[11px] text-rose-400">{errors.fullName.message}</span>
        )}
      </div>

      <div className="space-y-1">
        <label htmlFor="email" className="text-xs font-semibold text-slate-300">
          Work Email *
        </label>
        <div className="relative">
          <Mail className="h-4 w-4 absolute left-3.5 top-3.5 text-slate-500" />
          <Input
            id="email"
            type="email"
            placeholder="alex@company.com"
            className="bg-slate-950 border-slate-800 pl-10 text-white text-xs h-11"
            {...register('email')}
          />
        </div>
        {errors.email && (
          <span className="text-[11px] text-rose-400">{errors.email.message}</span>
        )}
      </div>

      <div className="space-y-1">
        <label htmlFor="phone" className="text-xs font-semibold text-slate-300 flex justify-between">
          <span>Phone Number (WhatsApp for Order Receipts)</span>
          <span className="text-slate-500 font-normal">(Optional)</span>
        </label>
        <div className="relative">
          <Phone className="h-4 w-4 absolute left-3.5 top-3.5 text-slate-500" />
          <Input
            id="phone"
            placeholder="+234 801 234 5678"
            className="bg-slate-950 border-slate-800 pl-10 text-white text-xs h-11"
            {...register('phone')}
          />
        </div>
      </div>

      <div className="space-y-1">
        <label htmlFor="password" className="text-xs font-semibold text-slate-300">
          Password *
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
            className="absolute right-3.5 top-3.5 text-slate-500 hover:text-slate-300 cursor-pointer"
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        {errors.password && (
          <span className="text-[11px] text-rose-400">{errors.password.message}</span>
        )}

        {/* Password requirements meters */}
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

      {/* Terms & Privacy Consent Checkbox */}
      <div className="pt-2 space-y-2">
        <label htmlFor="termsAccepted" className="flex items-start gap-2.5 cursor-pointer">
          <input
            id="termsAccepted"
            type="checkbox"
            aria-label="I agree to the Terms of Service and Privacy Policy"
            className="mt-0.5 h-4 w-4 rounded border-slate-700 bg-slate-950 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
            {...register('termsAccepted')}
          />
          <span className="text-[11px] text-slate-300 leading-tight">
            I agree to the{' '}
            <Link to="/terms" target="_blank" className="text-indigo-400 hover:underline font-semibold">
              Terms of Service
            </Link>{' '}
            and acknowledge the{' '}
            <Link to="/privacy" target="_blank" className="text-indigo-400 hover:underline font-semibold">
              Privacy Policy
            </Link>
            . *
          </span>
        </label>
        {errors.termsAccepted && (
          <p className="text-[11px] text-rose-400 pl-6">{errors.termsAccepted.message}</p>
        )}

        <label htmlFor="marketingOptIn" className="flex items-start gap-2.5 cursor-pointer">
          <input
            id="marketingOptIn"
            type="checkbox"
            aria-label="Send me product updates and marketing communications"
            className="mt-0.5 h-4 w-4 rounded border-slate-700 bg-slate-950 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
            {...register('marketingOptIn')}
          />
          <span className="text-[11px] text-slate-400 leading-tight">
            Send me product updates, retail tips, and feature announcements (optional)
          </span>
        </label>
      </div>

      <Button
        type="submit"
        variant="primary"
        size="lg"
        className="w-full font-bold h-12 mt-4 shadow-lg shadow-indigo-600/30 cursor-pointer"
      >
        <span>Continue to Business Details</span>
        <ArrowRight className="h-4 w-4" />
      </Button>

      <div className="pt-2 text-center text-xs text-slate-400">
        Already have an account?{' '}
        <Link to="/login" className="text-indigo-400 hover:underline font-bold">
          Sign In
        </Link>
      </div>
    </form>
  );
}
