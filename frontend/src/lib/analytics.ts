type CanonicalProperties = {
  signup_started: { device: DeviceCategory; source: string };
  signup_completed: { method: 'email_password'; source: string };
  email_verification_sent: { source: 'resend_form' };
  email_verification_clicked: { source: 'email_link' };
  email_verification_completed: { time_to_verify: number | null };
  login_started: { device: DeviceCategory };
  login_completed: { method: string; device: DeviceCategory };
  login_failed: { reason: string; device: DeviceCategory };
  password_reset_requested: { source: 'reset_form' };
  password_reset_completed: Record<string, never>;
  onboarding_survey_viewed: Record<string, never>;
  onboarding_survey_answered: { question_id: number; answer: string };
  onboarding_completed: { answers_summary: string; use_case: string; business_type: string; product_count: string; uses_software: boolean };
  onboarding_skipped: Record<string, never>;
};
type SupplementalProperties = {
  phone_verification_requested: Record<string, never>; phone_verified: Record<string, never>;
  password_change_started: { revokeOtherSessions: boolean }; password_change_completed: { revokeOtherSessions: boolean };
};
export type AnalyticsEvent = keyof CanonicalProperties | keyof SupplementalProperties;
type EventProperties<E extends AnalyticsEvent> = E extends keyof CanonicalProperties ? CanonicalProperties[E] : E extends keyof SupplementalProperties ? SupplementalProperties[E] : never;
export type DeviceCategory = 'mobile' | 'tablet' | 'desktop';
type AnalyticsProvider = { track: (event: string, properties: object) => void; identify?: (id: string) => void; reset?: () => void };

function provider(): AnalyticsProvider | undefined { return typeof window === 'undefined' ? undefined : (window as unknown as { analytics?: AnalyticsProvider }).analytics; }
export function getDeviceCategory(): DeviceCategory {
  if (typeof navigator === 'undefined') return 'desktop';
  const ua = navigator.userAgent.toLowerCase();
  if (/ipad|tablet/.test(ua) || (/android/.test(ua) && !/mobile/.test(ua))) return 'tablet';
  return /mobi|iphone|android/.test(ua) ? 'mobile' : 'desktop';
}
export function getSignupSource(): string {
  if (typeof window === 'undefined') return 'direct';
  const utm = new URLSearchParams(window.location.search).get('utm_source')?.trim();
  if (utm) return utm.slice(0, 64).toLowerCase();
  if (!document.referrer) return 'direct';
  try { return new URL(document.referrer).hostname.toLowerCase().slice(0, 120) || 'direct'; } catch { return 'direct'; }
}
export function getClientContext() {
  if (typeof window === 'undefined') return {};
  return { path: window.location.pathname, referrer: document.referrer || null, screen: `${window.innerWidth}x${window.innerHeight}`, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC', timestamp: new Date().toISOString() };
}
export function identifyUser(userId: string) { provider()?.identify?.(userId); }
export function resetIdentity() { provider()?.reset?.(); }
export function trackEvent<E extends AnalyticsEvent>(event: E, properties: EventProperties<E>) {
  const payload = { event, properties, context: getClientContext() };
  if (import.meta.env.DEV) console.debug(`[Analytics] ${event}`, payload);
  provider()?.track(event, { ...properties, ...payload.context });
}
