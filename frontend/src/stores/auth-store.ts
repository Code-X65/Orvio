import { create } from 'zustand';

interface AuthState {
  isAuthenticated: boolean;
  isBootstrapping: boolean;
  sessionUnavailable: boolean;
  lastSyncedAt: number | null;
  accessToken: string | null;
  user: { id: string; email: string; firstName: string | null; lastName: string | null; phone: string | null; emailVerified: boolean; phoneVerified: boolean; passwordSet: boolean } | null;
  onboarding: { stage: 'PROFILE' | 'EMAIL_VERIFICATION' | 'PHONE_VERIFICATION' | 'COMPLETE'; completed: boolean } | null;
  setSession: (session: { accessToken: string; user: { id: string; email: string; firstName: string | null; lastName: string | null; phone: string | null; emailVerified: boolean; phoneVerified: boolean; passwordSet: boolean }; onboarding: { stage: 'PROFILE' | 'EMAIL_VERIFICATION' | 'PHONE_VERIFICATION' | 'COMPLETE'; completed: boolean } }) => void;
  setBootstrapping: (value: boolean) => void;
  setSessionUnavailable: (value: boolean) => void;
  clearSession: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  isAuthenticated: false,
  isBootstrapping: false,
  sessionUnavailable: false,
  lastSyncedAt: null,
  accessToken: null,
  user: null,
  onboarding: null,
  setSession: ({ accessToken, user, onboarding }) => set({
    isAuthenticated: true,
    accessToken,
    user,
    onboarding,
    sessionUnavailable: false,
    lastSyncedAt: Date.now(),
  }),
  setBootstrapping: (isBootstrapping) => set({ isBootstrapping }),
  setSessionUnavailable: (sessionUnavailable) => set({ sessionUnavailable }),
  clearSession: () => set({
    isAuthenticated: false,
    accessToken: null,
    user: null,
    onboarding: null,
    sessionUnavailable: false,
    lastSyncedAt: null,
  }),
}));
