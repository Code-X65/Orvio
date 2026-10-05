import * as React from 'react';
import { useFormContext } from 'react-hook-form';
import { Building2, Boxes, Dumbbell, Layers, Sparkles, ArrowRight, ArrowLeft, Loader2 } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Select } from '../../../components/ui/select';
import { SubdomainField } from '../components/SubdomainField';
import { getSupportedTimezones } from '../../../domains/shared/timezones';
import { SUPPORTED_CURRENCIES } from '../../../domains/shared/currencies';
import type { SignupFormData } from '../schema';

export interface OrganizationStepProps {
  onBack: () => void;
  isSubmitting: boolean;
  externalSuggestions?: string[];
}

export function OrganizationStep({
  onBack,
  isSubmitting,
  externalSuggestions = [],
}: OrganizationStepProps) {
  const {
    register,
    watch,
    setValue,
    formState: { errors },
  } = useFormContext<SignupFormData>();

  const selectedPlan = watch('planCode') || 'bundle';
  const [isSubdomainAvailable, setIsSubdomainAvailable] = React.useState<boolean | null>(null);

  const timezoneOptions = React.useMemo(() => getSupportedTimezones(), []);
  const currencyOptions = React.useMemo(
    () =>
      SUPPORTED_CURRENCIES.map((c) => ({
        value: c.code,
        label: `${c.name} (${c.code} ${c.symbol})`,
      })),
    []
  );

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      <div className="space-y-1">
        <h3 className="text-xl font-bold text-white">Set up your business workspace</h3>
        <p className="text-xs text-slate-400">Step 2 of 2: Organization and tenant address</p>
      </div>

      {/* Plan Selection Pills */}
      <div className="space-y-2">
        <label id="plan-selection-label" className="text-xs font-semibold text-slate-300">
          Selected Plan Trial:
        </label>
        <div
          role="radiogroup"
          aria-labelledby="plan-selection-label"
          className="grid grid-cols-3 gap-2"
        >
          <button
            type="button"
            role="radio"
            aria-checked={selectedPlan === 'inventory'}
            aria-label="Inventory Plan - ₦10,000 per month"
            onClick={() => setValue('planCode', 'inventory', { shouldValidate: true })}
            className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
              selectedPlan === 'inventory'
                ? 'border-indigo-500 bg-indigo-600/20 text-white shadow-sm ring-1 ring-indigo-500'
                : 'border-slate-800 bg-slate-950/60 text-slate-400 hover:text-white'
            }`}
          >
            <Boxes className="h-4 w-4 text-indigo-400 mb-1" />
            <div className="text-xs font-bold leading-tight">Inventory</div>
            <div className="text-[10px] text-slate-400">₦10k/mo</div>
          </button>

          <button
            type="button"
            role="radio"
            aria-checked={selectedPlan === 'gym'}
            aria-label="Gym Hub Plan - ₦8,000 per month"
            onClick={() => setValue('planCode', 'gym', { shouldValidate: true })}
            className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
              selectedPlan === 'gym'
                ? 'border-emerald-500 bg-emerald-600/20 text-white shadow-sm ring-1 ring-emerald-500'
                : 'border-slate-800 bg-slate-950/60 text-slate-400 hover:text-white'
            }`}
          >
            <Dumbbell className="h-4 w-4 text-emerald-400 mb-1" />
            <div className="text-xs font-bold leading-tight">Gym Hub</div>
            <div className="text-[10px] text-slate-400">₦8k/mo</div>
          </button>

          <button
            type="button"
            role="radio"
            aria-checked={selectedPlan === 'bundle'}
            aria-label="Bundle Plan - ₦15,000 per month"
            onClick={() => setValue('planCode', 'bundle', { shouldValidate: true })}
            className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer relative ${
              selectedPlan === 'bundle'
                ? 'border-indigo-400 bg-gradient-to-br from-indigo-600/30 to-slate-900 text-white shadow-sm ring-1 ring-indigo-500'
                : 'border-slate-800 bg-slate-950/60 text-slate-400 hover:text-white'
            }`}
          >
            <span className="absolute -top-2 right-2 bg-indigo-500 text-white text-[8px] font-extrabold px-1.5 py-0.2 rounded-full">
              Best
            </span>
            <Layers className="h-4 w-4 text-indigo-300 mb-1" />
            <div className="text-xs font-bold leading-tight">Bundle</div>
            <div className="text-[10px] text-slate-400">₦15k/mo</div>
          </button>
        </div>
      </div>

      {/* Business Name */}
      <div className="space-y-1">
        <label htmlFor="organizationName" className="text-xs font-semibold text-slate-300">
          Business / Organization Name *
        </label>
        <div className="relative">
          <Building2 className="h-4 w-4 absolute left-3.5 top-3.5 text-slate-500" />
          <Input
            id="organizationName"
            placeholder="e.g. Apex Global Store"
            className="bg-slate-950 border-slate-800 pl-10 text-white text-xs h-11"
            {...register('organizationName')}
          />
        </div>
        {errors.organizationName && (
          <span className="text-[11px] text-rose-400">{errors.organizationName.message}</span>
        )}
      </div>

      {/* Subdomain Input */}
      <SubdomainField
        onAvailabilityChange={setIsSubdomainAvailable}
        externalSuggestions={externalSuggestions}
      />

      {/* Timezone & Currency Selects */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
        <Select
          label="Timezone"
          options={timezoneOptions}
          error={errors.timezone?.message}
          {...register('timezone')}
        />

        <Select
          label="Base Currency"
          options={currencyOptions}
          error={errors.currency?.message}
          {...register('currency')}
        />
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3 pt-2">
        <Button
          type="button"
          variant="outline"
          onClick={onBack}
          disabled={isSubmitting}
          className="w-1/3 font-bold h-12 border-slate-800 text-slate-300 hover:bg-slate-800 cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back</span>
        </Button>

        <Button
          type="submit"
          variant="primary"
          size="lg"
          disabled={isSubmitting || isSubdomainAvailable === false}
          className="w-2/3 font-bold h-12 shadow-lg shadow-indigo-600/30 cursor-pointer"
        >
          {isSubmitting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              <span>Create Workspace</span>
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
