import * as React from 'react';
import { useSearchParams } from 'react-router-dom';
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Card } from '../../components/ui/card';
import { AccountStep } from './steps/AccountStep';
import { OrganizationStep } from './steps/OrganizationStep';
import { ConfirmationStep } from './steps/ConfirmationStep';
import { SignupFormSchema, AccountStepSchema, type SignupFormData } from './schema';
import { register, resendVerification } from '../../lib/api/auth';
import { ApiError } from '../../lib/api/client';

export function SignupWizard() {
  const [searchParams] = useSearchParams();
  const planParam = searchParams.get('plan') as 'inventory' | 'gym' | 'bundle' | null;
  const initialPlan = planParam && ['inventory', 'gym', 'bundle'].includes(planParam) ? planParam : 'bundle';

  const getSavedDraft = () => {
    if (typeof window === 'undefined') return null;
    try {
      const saved = sessionStorage.getItem('orvio_signup_draft');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  };

  const draft = getSavedDraft();

  const [currentStep, setCurrentStep] = React.useState<1 | 2 | 3>(
    draft?.currentStep === 2 ? 2 : 1
  );
  const [serverSuggestions, setServerSuggestions] = React.useState<string[]>([]);
  const [isResending, setIsResending] = React.useState(false);

  // Created organization details after Step 2 submission
  const [createdDetails, setCreatedDetails] = React.useState<{
    email: string;
    organizationName: string;
    subdomain: string;
  } | null>(null);

  const methods = useForm<SignupFormData>({
    resolver: zodResolver(SignupFormSchema),
    mode: 'onTouched',
    defaultValues: {
      fullName: draft?.fullName || '',
      email: draft?.email || '',
      phone: draft?.phone || '',
      password: '',
      organizationName: draft?.organizationName || '',
      subdomain: draft?.subdomain || '',
      planCode: (draft?.planCode as 'inventory' | 'gym' | 'bundle') || initialPlan,
      timezone: draft?.timezone || 'Africa/Lagos',
      currency: draft?.currency || 'NGN',
      termsAccepted: draft?.termsAccepted ?? false,
      marketingOptIn: draft?.marketingOptIn ?? false,
    },
  });

  const {
    handleSubmit,
    trigger,
    setError,
    watch,
    formState: { isSubmitting },
  } = methods;

  // Persist form draft to sessionStorage on state changes
  React.useEffect(() => {
    const subscription = watch((values) => {
      if (typeof window === 'undefined' || currentStep === 3) return;
      try {
        const toSave = {
          fullName: values.fullName,
          email: values.email,
          phone: values.phone,
          organizationName: values.organizationName,
          subdomain: values.subdomain,
          planCode: values.planCode,
          timezone: values.timezone,
          currency: values.currency,
          termsAccepted: values.termsAccepted,
          marketingOptIn: values.marketingOptIn,
          currentStep,
        };
        sessionStorage.setItem('orvio_signup_draft', JSON.stringify(toSave));
      } catch {
        // Ignore quota / private mode storage error
      }
    });
    return () => subscription.unsubscribe();
  }, [watch, currentStep]);

  const handleStep1Next = (e?: React.FormEvent) => {
    e?.preventDefault?.();
    const values = methods.getValues();
    const result = AccountStepSchema.safeParse({
      fullName: values.fullName,
      email: values.email,
      phone: values.phone || undefined,
      password: values.password,
      termsAccepted: values.termsAccepted,
      marketingOptIn: values.marketingOptIn,
    });

    if (!result.success) {
      result.error.issues.forEach((issue) => {
        const field = issue.path[0] as keyof SignupFormData;
        if (field) {
          setError(field, { type: 'manual', message: issue.message });
        }
      });
      return;
    }

    methods.clearErrors(['fullName', 'email', 'phone', 'password', 'termsAccepted']);
    setCurrentStep(2);
  };

  const handleStep2Submit = async (data: SignupFormData) => {
    setServerSuggestions([]);
    try {
      const res = await register({
        fullName: data.fullName,
        email: data.email,
        phone: data.phone || undefined,
        password: data.password,
        organizationName: data.organizationName,
        subdomain: data.subdomain,
        planCode: data.planCode,
        timezone: data.timezone,
        currency: data.currency,
      });

      setCreatedDetails({
        email: res.email,
        organizationName: res.organization.name,
        subdomain: res.organization.subdomain,
      });

      try {
        sessionStorage.removeItem('orvio_signup_draft');
      } catch {
        // ignore
      }

      setCurrentStep(3);
      toast.success('Registration successful! Please verify your email.');
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        let hasStep1Error = false;

        if (err.details && typeof err.details === 'object') {
          const detailsObj = err.details as Record<string, unknown>;

          // 1. Check array fields: Array<{ field: string; message: string }>
          if (Array.isArray(detailsObj.fields)) {
            detailsObj.fields.forEach((item) => {
              if (item && typeof item === 'object' && 'field' in item && 'message' in item) {
                const f = String((item as { field: string }).field);
                const m = String((item as { message: string }).message);
                setError(f as keyof SignupFormData, { type: 'server', message: m });
                if (['email', 'fullName', 'password', 'phone'].includes(f)) {
                  hasStep1Error = true;
                }
              }
            });
          } else if (detailsObj.fields && typeof detailsObj.fields === 'object') {
            // 2. Check object fields: { [field]: string | string[] }
            Object.entries(detailsObj.fields as Record<string, unknown>).forEach(([field, msgs]) => {
              const msg = Array.isArray(msgs) ? String(msgs[0]) : String(msgs);
              setError(field as keyof SignupFormData, { type: 'server', message: msg });
              if (['email', 'fullName', 'password', 'phone'].includes(field)) {
                hasStep1Error = true;
              }
            });
          }

          // 3. Check single field error: { field: 'email' }
          if (typeof detailsObj.field === 'string') {
            const fieldName = detailsObj.field;
            setError(fieldName as keyof SignupFormData, { type: 'server', message: err.message });
            if (['email', 'fullName', 'password', 'phone'].includes(fieldName)) {
              hasStep1Error = true;
            }
          }

          // 4. Extract collision suggestions
          const suggestions = detailsObj.suggestions;
          if (Array.isArray(suggestions) && suggestions.length > 0) {
            setServerSuggestions(suggestions as string[]);
          }
        }

        if (hasStep1Error) {
          setCurrentStep(1);
        }

        toast.error(err.message);
      } else {
        toast.error('An unexpected error occurred during signup. Please try again.');
      }
    }
  };

  const handleResendVerification = async () => {
    if (!createdDetails?.email || isResending) return;
    setIsResending(true);
    try {
      await resendVerification(createdDetails.email);
      toast.success('A new verification email has been dispatched!');
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        toast.error(err.message);
      } else {
        toast.error('Failed to resend verification email. Please try again.');
      }
    } finally {
      setIsResending(false);
    }
  };

  return (
    <FormProvider {...methods}>
      {/* Stepper Indicator */}
      <div className="mt-6 flex items-center justify-center gap-3">
        <div className="flex items-center gap-2">
          <div
            className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
              currentStep >= 1
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/30'
                : 'bg-slate-800 text-slate-400'
            }`}
          >
            1
          </div>
          <span className={`text-xs font-medium ${currentStep === 1 ? 'text-white' : 'text-slate-400'}`}>
            Account
          </span>
        </div>
        <div className={`w-8 h-0.5 ${currentStep >= 2 ? 'bg-indigo-600' : 'bg-slate-800'}`} />
        <div className="flex items-center gap-2">
          <div
            className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
              currentStep >= 2
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/30'
                : 'bg-slate-800 text-slate-400'
            }`}
          >
            2
          </div>
          <span className={`text-xs font-medium ${currentStep === 2 ? 'text-white' : 'text-slate-400'}`}>
            Business
          </span>
        </div>
        <div className={`w-8 h-0.5 ${currentStep >= 3 ? 'bg-indigo-600' : 'bg-slate-800'}`} />
        <div className="flex items-center gap-2">
          <div
            className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
              currentStep === 3
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-500/30'
                : 'bg-slate-800 text-slate-400'
            }`}
          >
            3
          </div>
          <span className={`text-xs font-medium ${currentStep === 3 ? 'text-white' : 'text-slate-400'}`}>
            Verify
          </span>
        </div>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-xl z-10">
        <Card className="bg-slate-900/90 border-slate-800 text-white shadow-2xl p-6 sm:p-8 backdrop-blur-xl">
          {currentStep === 1 && <AccountStep onNext={handleStep1Next} />}

          {currentStep === 2 && (
            <form onSubmit={handleSubmit(handleStep2Submit)}>
              <OrganizationStep
                onBack={() => setCurrentStep(1)}
                isSubmitting={isSubmitting}
                externalSuggestions={serverSuggestions}
              />
            </form>
          )}

          {currentStep === 3 && createdDetails && (
            <ConfirmationStep
              email={createdDetails.email}
              organizationName={createdDetails.organizationName}
              subdomain={createdDetails.subdomain}
              onResend={handleResendVerification}
              isResending={isResending}
            />
          )}
        </Card>
      </div>
    </FormProvider>
  );
}
