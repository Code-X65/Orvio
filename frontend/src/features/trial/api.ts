import { api } from '../../lib/api';

export interface StartTrialPayload {
  selectedApps: ('inventory' | 'gym')[];
  primaryApp: 'inventory' | 'gym';
  organizationName: string;
  subdomain?: string;
  firstName?: string;
  lastName?: string;
  fullName?: string;
  email: string;
  phone: string;
  country?: string;
  language?: string;
  organizationSize?: string;
  primaryInterest?: string;
  password?: string;
  termsAccepted: true;
}

export interface StartTrialResponse {
  user: {
    id: string;
    email: string;
    fullName: string;
    phone?: string;
    status: string;
    emailVerifiedAt: string | null;
  };
  organization: {
    id: string;
    name: string;
    subdomain: string;
    status: string;
    planCode: string;
    trialEndsAt?: string;
    url: string;
  };
  accessToken: string;
  refreshToken?: string;
  redirectUrl: string;
}

function generateIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'idem_' + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
}

export async function startFreeTrial(payload: StartTrialPayload, idempotencyKey?: string): Promise<StartTrialResponse> {
  const key = idempotencyKey || generateIdempotencyKey();
  return await api.post<StartTrialResponse>('/auth/trial', payload, {
    headers: {
      'Idempotency-Key': key,
    },
  });
}

export interface SetupPasswordPayload {
  token: string;
  password: string;
  confirmPassword: string;
}

export async function setupPasswordAndVerify(payload: SetupPasswordPayload, idempotencyKey?: string): Promise<StartTrialResponse> {
  const key = idempotencyKey || generateIdempotencyKey();
  return await api.post<StartTrialResponse>('/auth/setup-password-and-verify', payload, {
    headers: {
      'Idempotency-Key': key,
    },
  });
}

export async function checkSubdomainAvailability(subdomain: string): Promise<{
  available: boolean;
  subdomain: string;
  reason?: string;
  suggestions?: string[];
}> {
  try {
    return await api.get<{
      available: boolean;
      subdomain: string;
      reason?: string;
      suggestions?: string[];
    }>('/orgs/check-subdomain', { params: { subdomain } });
  } catch {
    return { available: false, subdomain, reason: 'ERROR' };
  }
}

export async function checkEmailAvailability(email: string): Promise<{
  available: boolean;
  email: string;
}> {
  try {
    return await api.get<{
      available: boolean;
      email: string;
    }>('/auth/check-email', { params: { email } });
  } catch {
    return { available: true, email };
  }
}


