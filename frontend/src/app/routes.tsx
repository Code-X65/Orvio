import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, LogOut, Mail } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import ReactMarkdown from 'react-markdown';
import { Link, Navigate, Route, Routes, useNavigate, useSearchParams } from 'react-router-dom';
import { toast, Toaster } from 'sonner';
import { z } from 'zod';
import { Field, FormAlert, PasswordField } from '../components/auth-form';
import { PhoneInput } from '../components/phone-input';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card, CardDescription, CardTitle } from '../components/ui/card';
import { apiRequest, ApiError, type AuthSession } from '../lib/api';
import { signIn, signOut, restoreSession, bootstrapSession, silentRefreshSession } from '../lib/auth';
import { getDeviceCategory, getSignupSource, identifyUser, trackEvent } from '../lib/analytics';
import { validatePhoneNumber } from '../lib/countries';
import { applyApiError } from '../lib/form-error';
import { useAuthStore } from '../stores/auth-store';

const name = z.string().trim().min(1, 'Required').max(80);
const email = z.string().email('Enter a valid email').max(320);
const securePassword = z.string()
  .min(12, 'Use at least 12 characters')
  .max(128)
  .regex(/[a-z]/, 'Include a lowercase letter')
  .regex(/[A-Z]/, 'Include an uppercase letter')
  .regex(/\d/, 'Include a number')
  .regex(/[^A-Za-z0-9]/, 'Include a symbol');
const password = securePassword;
const loginPassword = z.string().min(8, 'Use at least eight characters').max(128);
const changePasswordFormSchema = z.object({
  currentPassword: z.string().min(1, 'Enter your current password').max(128).optional(),
  newPassword: securePassword,
  confirmNewPassword: securePassword,
  revokeOtherSessions: z.boolean().default(true),
}).refine((value) => value.newPassword === value.confirmNewPassword, {
  path: ['confirmNewPassword'],
  message: 'Passwords do not match.',
});

const registerSchema = z.object({
  firstName: name,
  lastName: name,
  email,
  phone: z.string().optional().refine((val) => {
    if (!val || val.trim() === '') return true;
    return validatePhoneNumber(val).valid;
  }, { message: 'Enter a valid mobile number' }),
  password,
  passwordConfirmation: password,
  acceptTerms: z.boolean().refine(Boolean, 'You must accept the Terms of Service.'),
  acceptPrivacy: z.boolean().refine(Boolean, 'You must accept the Privacy Policy.'),
  marketingConsent: z.boolean().optional().default(false),
  rememberMe: z.boolean().optional().default(false),
}).refine((v) => v.password === v.passwordConfirmation, {
  path: ['passwordConfirmation'],
  message: 'Passwords do not match.',
});

function linkToken(params: URLSearchParams): string | null {
  return new URLSearchParams(window.location.hash.slice(1)).get('token') ?? params.get('token');
}

function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 py-10 text-foreground">
      <Toaster richColors position="top-right" theme="dark" />
      {children}
    </main>
  );
}

function Layout({ title, description, children }: { title: string; description: string; children?: React.ReactNode }) {
  return (
    <AppShell>
      <Card className="w-full max-w-md">
        <Badge>Orvio account</Badge>
        <CardTitle className="mt-5">{title}</CardTitle>
        <CardDescription aria-live="polite">{description}</CardDescription>
        <div className="mt-6">{children}</div>
      </Card>
    </AppShell>
  );
}

function useApiMutation<T, V>(path: string) {
  return useMutation({
    mutationFn: async (value: V) => (await apiRequest<T>(path, { method: 'POST', body: JSON.stringify(value) })).data,
  });
}

function RegisterPage() {
  const navigate = useNavigate();
  const signupSource = getSignupSource();
  const form = useForm<z.infer<typeof registerSchema>>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      password: '',
      passwordConfirmation: '',
      acceptTerms: false,
      acceptPrivacy: false,
      marketingConsent: false,
      rememberMe: false,
    },
  });
  const mutation = useApiMutation('auth/register');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    trackEvent('signup_started', { device: getDeviceCategory(), source: signupSource });
  }, [signupSource]);

  const watchedPassword = form.watch('password');

  const submit = form.handleSubmit(async (values) => {
    try {
      await mutation.mutateAsync({ ...values, source: signupSource });
      trackEvent('signup_completed', {
        method: 'email_password',
        source: signupSource,
      });
      toast.success('Account created! Please verify your email.');
      navigate(`/verify-email?email=${encodeURIComponent(values.email)}`);
    } catch (e) {
      setNotice(applyApiError(e, form.setError) ?? 'Unable to create your account.');
    }
  });

  return (
    <Layout title="Create your account" description="Start with your personal details, then finish secure account setup.">
      <form className="space-y-4" onSubmit={submit}>
        <fieldset disabled={mutation.isPending} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="First name" {...form.register('firstName')} error={form.formState.errors.firstName?.message} />
            <Field label="Last name" {...form.register('lastName')} error={form.formState.errors.lastName?.message} />
          </div>
          <Field label="Work email" type="email" {...form.register('email')} error={form.formState.errors.email?.message} />
          <Controller
            name="phone"
            control={form.control}
            render={({ field, fieldState }) => (
              <PhoneInput
                label="Mobile number (optional)"
                value={field.value}
                onChange={field.onChange}
                error={fieldState.error?.message}
                disabled={mutation.isPending}
              />
            )}
          />
          <PasswordField
            label="Password"
            {...form.register('password')}
            value={watchedPassword}
            showStrengthMeter
            error={form.formState.errors.password?.message}
          />
          <PasswordField
            label="Confirm password"
            {...form.register('passwordConfirmation')}
            error={form.formState.errors.passwordConfirmation?.message}
          />
          <div className="space-y-2 pt-2 text-sm text-slate-300">
            <label className="flex items-start gap-2 cursor-pointer">
              <input type="checkbox" className="mt-1" {...form.register('acceptTerms')} />
              <span>I agree to the <Link className="underline text-primary" to="/terms" target="_blank">Terms of Service</Link>.</span>
            </label>
            {form.formState.errors.acceptTerms && (
              <p className="text-xs text-red-400">{form.formState.errors.acceptTerms.message}</p>
            )}
            <label className="flex items-start gap-2 cursor-pointer">
              <input type="checkbox" className="mt-1" {...form.register('acceptPrivacy')} />
              <span>I acknowledge the <Link className="underline text-primary" to="/privacy" target="_blank">Privacy Policy</Link>.</span>
            </label>
            {form.formState.errors.acceptPrivacy && (
              <p className="text-xs text-red-400">{form.formState.errors.acceptPrivacy.message}</p>
            )}
            <label className="flex items-start gap-2 cursor-pointer text-slate-400">
              <input type="checkbox" className="mt-1" {...form.register('marketingConsent')} />
              <span>Send me product updates and security advisories <span className="text-xs text-slate-500">(optional)</span></span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer pt-1 text-slate-400">
              <input type="checkbox" {...form.register('rememberMe')} />
              <span>Remember this device for 30 days</span>
            </label>
          </div>
          <FormAlert message={notice} />
          <Button className="w-full mt-2" type="submit">
            {mutation.isPending ? 'Creating account…' : 'Create account'}
          </Button>
        </fieldset>
      </form>
      <p className="mt-5 text-sm">
        Already have an account? <Link className="underline text-primary" to="/login">Sign in</Link>
      </p>
    </Layout>
  );
}

function LoginPage() {
  const navigate = useNavigate();
  const form = useForm({
    resolver: zodResolver(z.object({ email, password: loginPassword, rememberMe: z.boolean() })),
    defaultValues: { email: '', password: '', rememberMe: false },
  });
  const [notice, setNotice] = useState('');

  useEffect(() => {
    trackEvent('login_started', { device: getDeviceCategory() });
  }, []);

  const mutation = useMutation({
    mutationFn: (v: { email: string; password: string; rememberMe: boolean }) => signIn(v.email, v.password, v.rememberMe),
    onSuccess: () => {
      trackEvent('login_completed', {
        method: 'email_password',
        device: getDeviceCategory(),
      });
      toast.success('Signed in successfully.');
      navigate('/app', { replace: true });
    },
  });
  const submit = form.handleSubmit(async (v) => {
    try {
      await mutation.mutateAsync(v);
    } catch (e) {
      trackEvent('login_failed', {
        reason: e instanceof ApiError ? e.code : 'UNKNOWN',
        device: getDeviceCategory(),
      });
      setNotice(
        (e instanceof ApiError && e.code === 'EMAIL_VERIFICATION_REQUIRED'
          ? 'Verify your email before signing in.'
          : applyApiError(e, form.setError)) ?? '',
      );
    }
  });

  return (
    <Layout title="Welcome back" description="Sign in to continue to Orvio.">
      <form className="space-y-4" onSubmit={submit}>
        <fieldset disabled={mutation.isPending} className="space-y-4">
          <Field label="Email address" type="email" {...form.register('email')} error={form.formState.errors.email?.message} />
          <PasswordField label="Password" {...form.register('password')} error={form.formState.errors.password?.message} />
          <label className="flex gap-2 text-sm">
            <input type="checkbox" {...form.register('rememberMe')} />Remember this device for 30 days
          </label>
          <FormAlert message={notice} />
          <Button className="w-full" type="submit">
            {mutation.isPending ? 'Signing in…' : 'Sign in'}
          </Button>
        </fieldset>
      </form>
      <p className="mt-5 text-sm">
        <Link className="underline" to="/reset-password">Forgot password?</Link> · <Link className="underline" to="/register">Create account</Link>
      </p>
    </Layout>
  );
}

function VerifyEmailPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = linkToken(params);
  const queryError = params.get('error');

  const initialStatus = queryError === 'invalid_or_expired'
    ? 'This verification link is invalid or has expired. Please request a new one below.'
    : token
    ? 'Verifying your email…'
    : 'Open the link from your email, or request another one below.';

  const [status, setStatus] = useState(initialStatus);
  const [isVerifying, setIsVerifying] = useState(Boolean(token));
  const form = useForm({
    resolver: zodResolver(z.object({ email })),
    defaultValues: { email: params.get('email') ?? '' },
  });

  useEffect(() => {
    if (!token) return;
    trackEvent('email_verification_clicked', { source: 'email_link' });
    window.history.replaceState(null, '', window.location.pathname);

    void apiRequest<AuthSession & { timeToVerifySeconds?: number }>('auth/verify-email/confirm', {
      method: 'POST',
      body: JSON.stringify({ token }),
    })
      .then(({ data }) => {
        identifyUser(data.user.id);
        trackEvent('email_verification_completed', {
          time_to_verify: data.timeToVerifySeconds ?? null,
        });
        toast.success('Email verified successfully! Welcome to Orvio.');
        useAuthStore.getState().setSession(data);
        navigate('/app', { replace: true });
      })
      .catch((e) => {
        const message = e instanceof Error ? e.message : 'Verification failed.';
        setStatus(message);
        toast.error(message);
      })
      .finally(() => {
        setIsVerifying(false);
      });
  }, [navigate, token]);

  const resend = useApiMutation('auth/verify-email/resend');

  return (
    <Layout title="Verify your email" description={status}>
      {isVerifying ? (
        <div className="flex items-center justify-center py-6 text-sm text-slate-400">
          <Mail className="mr-2 h-4 w-4 animate-bounce text-primary" />
          Verifying your account…
        </div>
      ) : (
        <form
          onSubmit={form.handleSubmit(async (v) => {
            try {
              await resend.mutateAsync(v);
              trackEvent('email_verification_sent', { source: 'resend_form' });
              toast.info('Verification email sent! Check your inbox.');
              setStatus('If the account needs verification, a new link has been sent.');
            } catch (e) {
              const err = applyApiError(e, form.setError) ?? 'Unable to resend.';
              setStatus(err);
              toast.error(err);
            }
          })}
          className="space-y-4"
        >
          <Field label="Email address" type="email" {...form.register('email')} error={form.formState.errors.email?.message} />
          <Button className="w-full" type="submit" disabled={resend.isPending}>
            {resend.isPending ? 'Sending…' : 'Resend verification email'}
          </Button>
        </form>
      )}
      <Link className="mt-4 inline-block underline text-sm" to="/login">
        Back to sign in
      </Link>
    </Layout>
  );
}

function ResetPage({ confirm = false }: { confirm?: boolean }) {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get('token');
  const queryError = params.get('error');

  const schema = confirm
    ? z.object({ password, passwordConfirmation: password }).refine((v) => v.password === v.passwordConfirmation, {
        path: ['passwordConfirmation'],
        message: 'Passwords do not match.',
      })
    : z.object({ email });

  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: confirm ? { password: '', passwordConfirmation: '' } : { email: '' },
  });

  const watchedPassword = form.watch('password');

  const mutation = useMutation({
    mutationFn: async (v: Record<string, string>) =>
      apiRequest(confirm ? 'auth/reset-password/confirm' : 'auth/reset-password', {
        method: 'POST',
        body: JSON.stringify(confirm ? { ...v, token: token ?? '' } : v),
      }),
  });
  const [status, setStatus] = useState(
    queryError === 'invalid_or_expired'
      ? 'This password reset link is invalid or has expired. Please request a new one below.'
      : '',
  );

  return (
    <Layout
      title={confirm ? 'Choose a new password' : 'Reset your password'}
      description={status || (confirm ? 'Choose a strong, unique password for your account.' : 'We’ll email a reset link if the account exists.')}
    >
      <form
        className="space-y-4"
        onSubmit={form.handleSubmit(async (v) => {
          try {
            await mutation.mutateAsync(v as unknown as Record<string, string>);
            if (confirm) {
              trackEvent('password_reset_completed', {});
              toast.success('Password updated successfully. You can now sign in.');
              setStatus('Password updated. You can now sign in.');
              navigate('/login', { replace: true });
            } else {
              trackEvent('password_reset_requested', { source: 'reset_form' });
              toast.success('Reset link sent if account exists.');
              setStatus('If the account exists, a reset link has been sent.');
            }
          } catch (e) {
            setStatus(applyApiError(e, form.setError) ?? 'Unable to reset password.');
          }
        })}
      >
        {confirm ? (
          <>
            <PasswordField
              label="New password"
              {...form.register('password')}
              value={watchedPassword}
              showStrengthMeter
              error={form.formState.errors.password?.message}
            />
            <PasswordField
              label="Confirm password"
              {...form.register('passwordConfirmation')}
              error={form.formState.errors.passwordConfirmation?.message}
            />
          </>
        ) : (
          <Field label="Email address" type="email" {...form.register('email')} error={form.formState.errors.email?.message} />
        )}
        <Button className="w-full" type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? 'Please wait…' : confirm ? 'Update password' : 'Send reset link'}
        </Button>
      </form>
      <p className="mt-5 text-sm">
        <Link className="underline text-primary" to="/login">Back to sign in</Link>
      </p>
    </Layout>
  );
}

function Step({
  path,
  title,
  description,
  schema,
  children,
  onDone,
}: {
  path: string;
  title: string;
  description: string;
  schema: z.ZodType;
  children: (form: ReturnType<typeof useForm>) => React.ReactNode;
  onDone?: (data: unknown) => void;
}) {
  const navigate = useNavigate();
  const form = useForm({ resolver: zodResolver(schema), defaultValues: {} });
  const mutation = useMutation({
    mutationFn: (v: unknown) => apiRequest(path, { method: 'POST', body: JSON.stringify(v) }),
  });
  const [notice, setNotice] = useState('');

  return (
    <Layout title={title} description={description}>
      <form
        className="space-y-4"
        onSubmit={form.handleSubmit(async (v) => {
          try {
            const result = await mutation.mutateAsync(v);
            onDone?.(result.data);
            if (!onDone) {
              await restoreSession();
              navigate('/app', { replace: true });
            }
          } catch (e) {
            setNotice(applyApiError(e, form.setError) ?? '');
          }
        })}
      >
        <fieldset disabled={mutation.isPending} className="space-y-4">
          {children(form)}
          <FormAlert message={notice} />
          <Button className="w-full" type="submit">
            {mutation.isPending ? 'Saving…' : 'Continue'}
          </Button>
        </fieldset>
      </form>
    </Layout>
  );
}

function ProfileStep() {
  return (
    <Step
      path="onboarding/profile"
      title="Complete your profile"
      description="Because you joined with social sign-in, please accept the current legal documents."
      schema={z.object({ firstName: name, lastName: name, acceptTerms: z.literal(true), acceptPrivacy: z.literal(true) })}
    >
      {(f) => (
        <>
          <Field label="First name" {...f.register('firstName')} error={f.formState.errors.firstName?.message as string} />
          <Field label="Last name" {...f.register('lastName')} error={f.formState.errors.lastName?.message as string} />
          <label className="flex gap-2 text-sm">
            <input type="checkbox" {...f.register('acceptTerms')} />I agree to the Terms.
          </label>
          <label className="flex gap-2 text-sm">
            <input type="checkbox" {...f.register('acceptPrivacy')} />I acknowledge the Privacy Policy.
          </label>
        </>
      )}
    </Step>
  );
}

function PhoneStep() {
  const [sent, setSent] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const navigate = useNavigate();
  const existingPhone = useAuthStore((s) => s.user?.phone);

  const phoneFormSchema = z.object({
    phone: z.string().superRefine((val, ctx) => {
      const res = validatePhoneNumber(val);
      if (!res.valid) ctx.addIssue({ code: z.ZodIssueCode.custom, message: res.message });
    }),
  });

  const phone = useForm<{ phone: string }>({
    resolver: zodResolver(phoneFormSchema),
    defaultValues: { phone: existingPhone ?? '' },
  });

  const code = useForm({
    resolver: zodResolver(z.object({ code: z.string().regex(/^\d{6}$/, 'Enter the six-digit code.') })),
    defaultValues: { code: '' },
  });

  const send = useApiMutation<{ sent: boolean; expiresInSeconds: number }, { phone: string }>('auth/phone/request');
  const confirm = useApiMutation('auth/phone/confirm');

  useEffect(() => {
    if (!seconds) return;
    const id = window.setInterval(() => setSeconds((s) => Math.max(0, s - 1)), 1000);
    return () => window.clearInterval(id);
  }, [seconds]);

  if (!sent) {
    return (
      <Layout title="Verify your phone" description="We’ll send a six-digit code to your mobile number.">
        <form
          className="space-y-4"
          onSubmit={phone.handleSubmit(async (v) => {
            try {
              const result = await send.mutateAsync(v);
              setSeconds(result.expiresInSeconds);
              setSent(true);
              trackEvent('phone_verification_requested', {});
              toast.info('Verification code sent to your phone.');
            } catch (e) {
              applyApiError(e, phone.setError);
            }
          })}
        >
          <Controller
            name="phone"
            control={phone.control}
            render={({ field, fieldState }) => (
              <PhoneInput
                label="Mobile number"
                value={field.value}
                onChange={field.onChange}
                error={fieldState.error?.message}
                disabled={send.isPending}
              />
            )}
          />
          <Button className="w-full" type="submit" disabled={send.isPending}>
            Send code
          </Button>
        </form>
      </Layout>
    );
  }

  return (
    <Layout title="Verify your phone" description={`Code expires in ${Math.ceil(seconds / 60)} minute(s).`}>
      <form
        className="space-y-4"
        onSubmit={code.handleSubmit(async (v) => {
          try {
            await confirm.mutateAsync(v);
            trackEvent('phone_verified', {});
            toast.success('Phone verified successfully.');
            await restoreSession();
            navigate('/app', { replace: true });
          } catch (e) {
            applyApiError(e, code.setError);
          }
        })}
      >
        <Field
          label="Verification code"
          inputMode="numeric"
          autoFocus
          maxLength={6}
          {...code.register('code', {
            onChange: (e) => {
              if (e.target.value.length === 6) {
                void code.handleSubmit(async (v) => {
                  await confirm.mutateAsync(v);
                  trackEvent('phone_verified', {});
                  toast.success('Phone verified successfully.');
                  await restoreSession();
                  navigate('/app', { replace: true });
                })();
              }
            },
          })}
          error={code.formState.errors.code?.message}
        />
        <Button className="w-full" type="submit" disabled={confirm.isPending}>
          Verify phone
        </Button>
        <Button className="w-full" variant="outline" onClick={() => setSent(false)}>
          Use another number
        </Button>
      </form>
    </Layout>
  );
}

type SurveyStatus = { completed: boolean; required: boolean };
type SurveyValues = { useCase: string; useCaseOther: string; discoverySource: string; discoverySourceOther: string; businessType: string; businessTypeOther: string; productCount: string; usesSoftware: string; softwareName: string; supportPhone: string };
const initialSurveyValues: SurveyValues = { useCase: '', useCaseOther: '', discoverySource: '', discoverySourceOther: '', businessType: '', businessTypeOther: '', productCount: '', usesSoftware: '', softwareName: '', supportPhone: '' };

function SurveyGate({ children }: { children: React.ReactNode }) {
  const survey = useQuery({ queryKey: ['onboarding-survey-status'], queryFn: async () => (await apiRequest<SurveyStatus>('onboarding/survey/status')).data });
  if (survey.isLoading) return <Layout title="Preparing your account" description="One moment…" />;
  if (survey.isError) return <Layout title="Unable to load onboarding" description="Please try again."><Button onClick={() => void survey.refetch()}>Retry</Button></Layout>;
  if (survey.data?.required) return <OnboardingSurvey onDone={() => void survey.refetch()} />;
  return <>{children}</>;
}

function OnboardingSurvey({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState(1);
  const [values, setValues] = useState<SurveyValues>(initialSurveyValues);
  const [error, setError] = useState('');
  const submit = useMutation({ mutationFn: (body: unknown) => apiRequest<SurveyStatus>('onboarding/survey', { method: 'POST', body: JSON.stringify(body) }) });
  useEffect(() => {
    const userId = useAuthStore.getState().user?.id;
    if (userId) identifyUser(userId);
    trackEvent('onboarding_survey_viewed', {});
    void apiRequest('onboarding/survey/started', { method: 'POST' });
  }, []);
  const update = (key: keyof SurveyValues, value: string) => setValues((current) => ({ ...current, [key]: value }));
  const requiresOther = (value: string, detail: string) => value !== 'other' || detail.trim().length > 0;
  const valid = () => {
    if (step === 1) return Boolean(values.useCase) && requiresOther(values.useCase, values.useCaseOther);
    if (step === 2) return Boolean(values.discoverySource) && requiresOther(values.discoverySource, values.discoverySourceOther);
    if (step === 3) return Boolean(values.businessType) && requiresOther(values.businessType, values.businessTypeOther);
    if (step === 4) return Boolean(values.productCount);
    if (step === 5) return Boolean(values.usesSoftware) && (values.usesSoftware === 'no' || values.softwareName.trim().length > 0);
    return !values.supportPhone || /^\+[1-9]\d{6,14}$/.test(values.supportPhone);
  };
  const answer = () => step === 1 ? values.useCase : step === 2 ? values.discoverySource : step === 3 ? values.businessType : step === 4 ? values.productCount : step === 5 ? values.usesSoftware : values.supportPhone ? 'phone_provided' : 'phone_not_provided';
  const complete = async () => {
    try {
      await submit.mutateAsync({ action: 'complete', answers: {
        useCase: { value: values.useCase, ...(values.useCase === 'other' ? { otherDetail: values.useCaseOther } : {}) },
        discoverySource: { value: values.discoverySource, ...(values.discoverySource === 'other' ? { otherDetail: values.discoverySourceOther } : {}) },
        businessType: { value: values.businessType, ...(values.businessType === 'other' ? { otherDetail: values.businessTypeOther } : {}) },
        productCount: values.productCount,
        existingSoftware: { usesSoftware: values.usesSoftware === 'yes', ...(values.usesSoftware === 'yes' ? { softwareName: values.softwareName } : {}) },
        ...(values.supportPhone ? { supportPhone: values.supportPhone } : {}),
      } });
      trackEvent('onboarding_completed', {
        answers_summary: `${values.useCase}|${values.businessType}|${values.productCount}|${values.usesSoftware === 'yes' ? 'uses_software' : 'no_software'}`,
        use_case: values.useCase,
        business_type: values.businessType,
        product_count: values.productCount,
        uses_software: values.usesSoftware === 'yes',
      });
      toast.success('Thanks! Your responses help us improve Orvio');
      onDone();
    } catch (e) { setError(e instanceof ApiError ? e.message : 'Unable to save your responses.'); }
  };
  const skip = async () => {
    try { await submit.mutateAsync({ action: 'skip' }); trackEvent('onboarding_skipped', {}); onDone(); }
    catch (e) { setError(e instanceof ApiError ? e.message : 'Unable to skip onboarding.'); }
  };
  const options = step === 1 ? [['inventory_management', 'Inventory management'], ['pos', 'POS'], ['whatsapp_orders', 'WhatsApp orders'], ['all_of_the_above', 'All of the above'], ['other', 'Other']]
    : step === 2 ? [['google_search', 'Google search'], ['social_media', 'Social media'], ['friend_or_colleague', 'Friend/colleague'], ['ad', 'Ad'], ['other', 'Other']]
    : step === 3 ? [['retail', 'Retail'], ['wholesale', 'Wholesale'], ['pharmacy', 'Pharmacy'], ['restaurant', 'Restaurant'], ['other', 'Other']]
    : step === 4 ? [['1_50', '1–50'], ['51_200', '51–200'], ['201_1000', '201–1000'], ['1000_plus', '1000+']]
    : step === 5 ? [['yes', 'Yes'], ['no', 'No']] : [];
  const key = step === 1 ? 'useCase' : step === 2 ? 'discoverySource' : step === 3 ? 'businessType' : step === 4 ? 'productCount' : 'usesSoftware';
  const title = step === 1 ? 'What do you want to use Orvio for?' : step === 2 ? 'How did you hear about us?' : step === 3 ? 'What is your business type?' : step === 4 ? 'How many products do you currently manage?' : step === 5 ? 'Do you currently use any software for inventory/POS?' : 'Phone number for support';
  const detailKey = step === 1 ? 'useCaseOther' : step === 2 ? 'discoverySourceOther' : 'businessTypeOther';
  return <Layout title="Help us understand your needs" description={`Step ${step} of 6`}>
    <div className="mb-5 h-1.5 overflow-hidden rounded bg-white/10"><div className="h-full bg-primary transition-all" style={{ width: `${(step / 6) * 100}%` }} /></div>
    <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); if (!valid()) { setError(step === 6 ? 'Enter a valid E.164 phone number or leave it blank.' : 'Answer this question before continuing.'); return; } setError(''); trackEvent('onboarding_survey_answered', { question_id: step, answer: answer() }); if (step === 6) void complete(); else setStep((current) => current + 1); }}>
      <fieldset disabled={submit.isPending} className="space-y-3"><legend className="text-base font-medium">{title}{step < 6 && <span className="text-red-300"> *</span>}</legend>
        {step < 6 && options.map(([value, label]) => <label key={value} className="flex items-center gap-2 rounded border border-white/10 p-3 text-sm"><input type="radio" name={key} checked={values[key as keyof SurveyValues] === value} onChange={() => update(key as keyof SurveyValues, value)} />{label}</label>)}
        {step <= 3 && values[key as keyof SurveyValues] === 'other' && <Field label="Please specify" value={values[detailKey as keyof SurveyValues]} onChange={(event) => update(detailKey as keyof SurveyValues, event.target.value)} maxLength={120} />}
        {step === 5 && values.usesSoftware === 'yes' && <Field label="Software name" value={values.softwareName} onChange={(event) => update('softwareName', event.target.value)} maxLength={120} />}
        {step === 6 && <Field label="Phone number (optional)" placeholder="+234..." value={values.supportPhone} onChange={(event) => update('supportPhone', event.target.value)} />}
        <FormAlert message={error} />
        <div className="flex gap-2"><Button type="button" variant="outline" disabled={step === 1} onClick={() => setStep((current) => current - 1)}>Back</Button><Button type="submit">{submit.isPending ? 'Saving…' : step === 6 ? 'Finish' : 'Next'}</Button><Button type="button" variant="ghost" className="ml-auto" onClick={() => void skip()} disabled={submit.isPending}>Skip for now</Button></div>
      </fieldset>
    </form>
  </Layout>;
}

function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();
  return (
    <Layout title={`Welcome, ${user?.firstName ?? ''}`} description="Your account is ready.">
      <CheckCircle2 className="text-emerald-400" />
      <div className="mt-6 flex gap-2">
        <Link to="/account">
          <Button variant="outline">Account</Button>
        </Link>
        <Button variant="outline" onClick={() => void signOut().then(() => navigate('/login'))}>
          <LogOut size={16} />Log out
        </Button>
      </div>
    </Layout>
  );
}

type Session = { id: string; current: boolean; createdAt: string; lastUsedAt: string; expiresAt: string; ip: string | null; userAgent: string | null };

function PasswordSettings() {
  const passwordSet = useAuthStore((s) => s.user?.passwordSet ?? false);
  const form = useForm<z.infer<typeof changePasswordFormSchema>>({
    resolver: zodResolver(changePasswordFormSchema),
    mode: 'onChange',
    defaultValues: { currentPassword: '', newPassword: '', confirmNewPassword: '', revokeOtherSessions: true },
  });
  const mutation = useMutation({
    mutationFn: async (value: z.infer<typeof changePasswordFormSchema>) => {
      if (passwordSet) {
        return apiRequest<{ passwordChanged: true; revokedOtherSessions: boolean }>('auth/change-password', {
          method: 'POST',
          body: JSON.stringify(value),
        });
      }
      return apiRequest('auth/set-password', {
        method: 'POST',
        body: JSON.stringify({
          password: value.newPassword,
          passwordConfirmation: value.confirmNewPassword,
          revokeOtherSessions: value.revokeOtherSessions,
        }),
      });
    },
  });
  const currentPassword = form.watch('currentPassword');
  const canSubmit = form.formState.isValid && (!passwordSet || Boolean(currentPassword));

  return (
    <section className="space-y-3" aria-labelledby="password-settings-heading">
      <div>
        <h2 id="password-settings-heading" className="font-medium">Password</h2>
        <p className="mt-1 text-sm text-slate-400">
          {passwordSet ? 'Use a strong, unique password to protect your account.' : 'Set a local password to sign in without your social provider.'}
        </p>
      </div>
      <form
        className="space-y-4"
        onSubmit={form.handleSubmit(async (value) => {
          if (passwordSet && !value.currentPassword) {
            form.setError('currentPassword', { type: 'required', message: 'Enter your current password' });
            return;
          }
          trackEvent('password_change_started', { revokeOtherSessions: value.revokeOtherSessions });
          try {
            await mutation.mutateAsync(value);
            trackEvent('password_change_completed', { revokeOtherSessions: value.revokeOtherSessions });
            form.reset({ currentPassword: '', newPassword: '', confirmNewPassword: '', revokeOtherSessions: true });
            toast.success('Password changed successfully');
          } catch (error) {
            applyApiError(error, form.setError);
          }
        })}
      >
        <fieldset disabled={mutation.isPending} className="space-y-4">
          {passwordSet && (
            <PasswordField
              label="Current password"
              autoComplete="current-password"
              {...form.register('currentPassword')}
              error={form.formState.errors.currentPassword?.message}
            />
          )}
          <PasswordField
            label="New password"
            autoComplete="new-password"
            {...form.register('newPassword')}
            value={form.watch('newPassword')}
            showStrengthMeter
            error={form.formState.errors.newPassword?.message}
          />
          <PasswordField
            label="Confirm new password"
            autoComplete="new-password"
            {...form.register('confirmNewPassword')}
            error={form.formState.errors.confirmNewPassword?.message}
          />
          <label className="flex items-start gap-2 text-sm text-slate-200">
            <input className="mt-1" type="checkbox" {...form.register('revokeOtherSessions')} />
            <span>Sign out other devices</span>
          </label>
          <Button type="submit" disabled={!canSubmit || mutation.isPending}>
            {mutation.isPending ? 'Updating…' : passwordSet ? 'Change password' : 'Set password'}
          </Button>
        </fieldset>
      </form>
    </section>
  );
}

function AccountPage() {
  const queryClient = useQueryClient();
  const sessions = useQuery({
    queryKey: ['sessions'],
    queryFn: async () => (await apiRequest<Session[]>('auth/sessions')).data,
  });
  const revoke = useMutation({
    mutationFn: (id: string) => apiRequest(`auth/sessions/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('Session revoked successfully.');
      void queryClient.invalidateQueries({ queryKey: ['sessions'] });
    },
  });
  const revokeOthers = useMutation({
    mutationFn: () => apiRequest('auth/sessions/revoke-others', { method: 'POST' }),
    onSuccess: () => {
      toast.success('All other devices signed out.');
      void queryClient.invalidateQueries({ queryKey: ['sessions'] });
    },
  });

  return (
    <Layout title="Account" description="Manage your account and active sessions.">
      <div className="space-y-3">
        <PasswordSettings />
        <hr className="border-white/10" />
        <h2 className="font-medium">Active sessions</h2>
        {sessions.isError && (
          <p role="alert">
            Unable to load sessions. <button className="underline" onClick={() => void sessions.refetch()}>Retry</button>
          </p>
        )}
        {sessions.data?.map((s) => (
          <div className="rounded border border-white/10 p-3 text-sm" key={s.id}>
            <p>{s.current ? 'Current session' : 'Other device'} · {s.ip ?? 'Unknown location'}</p>
            <p className="text-slate-400">Last active {new Date(s.lastUsedAt).toLocaleString()}</p>
            {!s.current && (
              <Button size="sm" variant="outline" className="mt-2" onClick={() => revoke.mutate(s.id)}>
                Revoke
              </Button>
            )}
          </div>
        ))}
        <Button variant="outline" className="w-full" disabled={revokeOthers.isPending} onClick={() => revokeOthers.mutate()}>
          Sign out all other devices
        </Button>
      </div>
      <Link className="mt-6 inline-block underline" to="/dashboard">
        Back to dashboard
      </Link>
    </Layout>
  );
}

function LegalPage({ type }: { type: 'terms' | 'privacy' }) {
  const legal = useQuery({
    queryKey: ['legal', type],
    queryFn: async () => (await apiRequest<{ title: string; content: string; version: string }>(`legal/${type}`)).data,
  });
  if (legal.isLoading) return <Layout title="Loading…" description="Loading legal document." />;
  if (legal.isError || !legal.data) {
    return (
      <Layout title="Document unavailable" description="Please try again shortly.">
        <Button onClick={() => void legal.refetch()}>Retry</Button>
      </Layout>
    );
  }
  return (
    <Layout title={legal.data.title} description={`Version ${legal.data.version}`}>
      <article className="prose prose-invert text-sm">
        <ReactMarkdown>{legal.data.content}</ReactMarkdown>
      </article>
    </Layout>
  );
}

function EmailPreferencesPage() {
  const [params] = useSearchParams();
  const unsubscribed = params.get('status') === 'unsubscribed';
  return <Layout title={unsubscribed ? 'You’re unsubscribed' : 'Email preferences'} description={unsubscribed ? 'You will no longer receive Orvio marketing emails. We may still send important account and security emails.' : 'Use the unsubscribe link in a marketing email to update your preferences.'}>
    <Link to="/login"><Button>Return to sign in</Button></Link>
  </Layout>;
}

function OAuthCallbackPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const popup = params.get('popup') === '1';
  const outcome = params.get('error') ? 'error' : params.get('linked') ? 'linked' : 'success';

  useEffect(() => {
    if (popup && window.opener) {
      window.opener.postMessage(
        { source: 'orvio-oauth', outcome, provider: params.get('provider') ?? params.get('linked') },
        window.location.origin,
      );
      window.close();
      return;
    }
    if (outcome === 'success') void restoreSession().then(() => navigate('/app', { replace: true }));
  }, [navigate, outcome, params, popup]);

  return (
    <Layout title="Social sign-in" description={outcome === 'error' ? 'Social sign-in could not be completed.' : 'Completing your sign-in…'}>
      <Link to="/login">
        <Button variant="outline">Back to sign in</Button>
      </Link>
    </Layout>
  );
}

function OnboardingRouter() {
  const stage = useAuthStore((s) => s.onboarding?.stage);
  if (stage === 'PROFILE') return <ProfileStep />;
  if (stage === 'PHONE_VERIFICATION') return <PhoneStep />;
  return <Navigate to="/dashboard" replace />;
}

function Protected({ dashboard = false }: { dashboard?: boolean }) {
  const auth = useAuthStore((s) => s.isAuthenticated);
  const boot = useAuthStore((s) => s.isBootstrapping);
  const unavailable = useAuthStore((s) => s.sessionUnavailable);
  const complete = useAuthStore((s) => s.onboarding?.completed);
  if (boot && !auth) return <Layout title="Restoring your session" description="Please wait…"><Mail className="animate-pulse" /></Layout>;
  if (!auth && unavailable) return <Layout title="Can’t reach Orvio" description="Check your connection and retry."><Button onClick={() => void restoreSession()}>Retry</Button></Layout>;
  if (!auth) return <Navigate to="/login" replace />;
  if (!complete) return <OnboardingRouter />;
  return <SurveyGate>{dashboard ? <DashboardPage /> : <AccountPage />}</SurveyGate>;
}

export function AppRoutes() {
  useEffect(() => {
    void bootstrapSession();
    const refresh = window.setInterval(() => {
      if (document.visibilityState === 'visible') void silentRefreshSession();
    }, 10 * 60_000);
    const visibility = () => {
      if (document.visibilityState === 'visible') {
        const state = useAuthStore.getState();
        if (state.isAuthenticated && Date.now() - (state.lastSyncedAt ?? 0) > 3 * 60_000) {
          void silentRefreshSession();
        }
      }
    };
    document.addEventListener('visibilitychange', visibility);
    return () => {
      window.clearInterval(refresh);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, []);

  return (
    <Routes>
      <Route path="/" element={<Navigate to="/app" replace />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/verify-email" element={<VerifyEmailPage />} />
      <Route path="/reset-password" element={<ResetPage />} />
      <Route path="/reset-password/confirm" element={<ResetPage confirm />} />
      <Route path="/auth/callback" element={<OAuthCallbackPage />} />
      <Route path="/terms" element={<LegalPage type="terms" />} />
      <Route path="/privacy" element={<LegalPage type="privacy" />} />
      <Route path="/email-preferences" element={<EmailPreferencesPage />} />
      <Route path="/app" element={<Protected />} />
      <Route path="/dashboard" element={<Protected dashboard />} />
      <Route path="/account" element={<Protected />} />
      <Route
        path="*"
        element={
          <Layout title="Page not found" description="This page does not exist.">
            <Link to="/app">
              <Button>Return to Orvio</Button>
            </Link>
          </Layout>
        }
      />
    </Routes>
  );
}
