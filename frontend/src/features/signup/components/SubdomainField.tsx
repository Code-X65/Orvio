import * as React from 'react';
import { useFormContext } from 'react-hook-form';
import { sanitizeSubdomain } from '../../../lib/subdomain';
import { useSubdomainAvailability } from '../hooks/useSubdomainAvailability';
import { AvailabilityBadge } from './AvailabilityBadge';
import { getSubdomainDisplaySuffix } from '../../../app/config/authUrls';
import type { SignupFormData } from '../schema';

export interface SubdomainFieldProps {
  onAvailabilityChange?: (isAvailable: boolean | null) => void;
  externalSuggestions?: string[];
}

export function SubdomainField({
  onAvailabilityChange,
  externalSuggestions = [],
}: SubdomainFieldProps) {
  const {
    register,
    setValue,
    watch,
    formState: { errors },
  } = useFormContext<SignupFormData>();

  const watchedSubdomain = watch('subdomain') || '';
  const watchedOrgName = watch('organizationName') || '';

  const [isManual, setIsManual] = React.useState(false);

  // Auto-generate subdomain from org name if user hasn't explicitly customized
  React.useEffect(() => {
    if (!isManual && watchedOrgName) {
      const derived = sanitizeSubdomain(watchedOrgName);
      setValue('subdomain', derived, { shouldValidate: true });
    }
  }, [watchedOrgName, isManual, setValue]);

  const availability = useSubdomainAvailability(watchedSubdomain);

  React.useEffect(() => {
    onAvailabilityChange?.(availability.isAvailable);
  }, [availability.isAvailable, onAvailabilityChange]);

  const suggestions =
    externalSuggestions.length > 0
      ? externalSuggestions
      : availability.suggestions;

  const handleSelectSuggestion = (suggestion: string) => {
    setIsManual(true);
    setValue('subdomain', suggestion, { shouldValidate: true });
  };

  const domainSuffix = getSubdomainDisplaySuffix();

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label htmlFor="subdomain-input" className="text-xs font-semibold text-slate-300">
          Tenant Subdomain *
        </label>
        <span className="text-[10px] text-indigo-400 font-mono">Dedicated Isolation</span>
      </div>

      <div className="flex items-center bg-slate-950 border border-slate-800 rounded-xl overflow-hidden focus-within:border-indigo-500 transition-colors">
        <input
          id="subdomain-input"
          type="text"
          placeholder="apexstore"
          className="bg-transparent px-3.5 py-2.5 text-xs text-white placeholder:text-slate-600 focus:outline-none flex-1 font-mono lowercase"
          {...register('subdomain', {
            onChange: (e) => {
              setIsManual(true);
              const clean = sanitizeSubdomain(e.target.value);
              setValue('subdomain', clean, { shouldValidate: true });
            },
          })}
        />
        <span className="bg-slate-900 px-3 py-2.5 text-xs text-slate-400 font-mono border-l border-slate-800">
          {domainSuffix}
        </span>
      </div>

      {errors.subdomain && (
        <p className="text-[11px] text-rose-400">{errors.subdomain.message}</p>
      )}

      {/* Live Availability Badge */}
      <div className="pt-0.5 min-h-[20px]">
        <AvailabilityBadge
          isLoading={availability.isLoading}
          isAvailable={availability.isAvailable}
          subdomain={watchedSubdomain}
          reason={availability.reason}
        />

        {/* Suggestion Chips */}
        {suggestions.length > 0 && availability.isAvailable === false && (
          <div className="flex flex-wrap items-center gap-1.5 pt-2">
            <span className="text-[11px] text-slate-400">Suggestions:</span>
            {suggestions.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => handleSelectSuggestion(suggestion)}
                className="px-2 py-0.5 text-[11px] font-mono bg-slate-800 hover:bg-slate-700 text-indigo-300 rounded-md border border-slate-700 transition-colors cursor-pointer"
              >
                {suggestion}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
