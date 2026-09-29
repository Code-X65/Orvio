import { Eye, EyeOff, Check, X } from 'lucide-react';
import { useState, type InputHTMLAttributes } from 'react';
import { calculatePasswordStrength } from '../lib/password';

export function PasswordStrengthMeter({ password }: { password?: string }) {
  if (!password) return null;
  const strength = calculatePasswordStrength(password);

  return (
    <div className="space-y-2 pt-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-slate-400">Password strength</span>
        <span className="font-medium text-slate-200">{strength.label}</span>
      </div>
      <div className="grid grid-cols-4 gap-1.5 h-1.5">
        {[1, 2, 3, 4].map((step) => (
          <div
            key={step}
            className={`rounded-full transition-all duration-300 ${
              strength.score >= step ? strength.color : 'bg-white/10'
            }`}
          />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-xs text-slate-400 pt-1">
        <div className="flex items-center gap-1.5">
          {strength.hasMinLength ? (
            <Check size={12} className="text-emerald-400 shrink-0" />
          ) : (
            <X size={12} className="text-slate-500 shrink-0" />
          )}
          <span className={strength.hasMinLength ? 'text-slate-300' : 'text-slate-500'}>
            12+ characters
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {strength.hasMixedCase ? (
            <Check size={12} className="text-emerald-400 shrink-0" />
          ) : (
            <X size={12} className="text-slate-500 shrink-0" />
          )}
          <span className={strength.hasMixedCase ? 'text-slate-300' : 'text-slate-500'}>
            Uppercase & lowercase
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {strength.hasNumber ? (
            <Check size={12} className="text-emerald-400 shrink-0" />
          ) : (
            <X size={12} className="text-slate-500 shrink-0" />
          )}
          <span className={strength.hasNumber ? 'text-slate-300' : 'text-slate-500'}>
            At least one number
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {strength.hasSpecial ? (
            <Check size={12} className="text-emerald-400 shrink-0" />
          ) : (
            <X size={12} className="text-slate-500 shrink-0" />
          )}
          <span className={strength.hasSpecial ? 'text-slate-300' : 'text-slate-500'}>
            Symbol or special char
          </span>
        </div>
      </div>
    </div>
  );
}

export function Field({ label, error, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string }) {
  const id = props.id ?? props.name ?? label.toLowerCase().replace(/\W+/g, '-');
  return (
    <label className="block space-y-1.5 text-sm text-slate-200" htmlFor={id}>
      <span>{label}</span>
      <input
        id={id}
        className="h-11 w-full rounded-sm border border-white/10 bg-input px-4 text-sm text-foreground placeholder:text-slate-500 focus-visible:border-primary focus-visible:outline-none"
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        {...props}
      />
      {error && <span id={`${id}-error`} role="alert" className="block text-xs text-red-300">{error}</span>}
    </label>
  );
}

export function PasswordField({
  label,
  error,
  showStrengthMeter,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string; showStrengthMeter?: boolean }) {
  const [visible, setVisible] = useState(false);
  const id = props.id ?? props.name ?? label.toLowerCase().replace(/\W+/g, '-');
  return (
    <div className="space-y-1.5">
      <div className="relative">
        <Field {...props} id={id} label={label} error={error} type={visible ? 'text' : 'password'} minLength={12} />
        <button
          className="absolute right-3 top-8 text-slate-400 hover:text-slate-200 transition-colors"
          type="button"
          onClick={() => setVisible(!visible)}
          aria-label={visible ? 'Hide password' : 'Show password'}
          aria-controls={id}
        >
          {visible ? <EyeOff size={17} /> : <Eye size={17} />}
        </button>
      </div>
      {showStrengthMeter && <PasswordStrengthMeter password={typeof props.value === 'string' ? props.value : undefined} />}
    </div>
  );
}

export function FormAlert({ message }: { message?: string }) {
  return message ? <p role="alert" aria-live="polite" className="text-sm text-amber-300">{message}</p> : null;
}
