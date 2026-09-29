import { apiRequest, refreshSession, type AuthSession } from './api';
import { identifyUser, resetIdentity } from './analytics';
import { useAuthStore } from '../stores/auth-store';

type AuthChannelMessage =
  | { type: 'SESSION_SET'; session: AuthSession }
  | { type: 'SESSION_CLEARED' };

const authChannel: BroadcastChannel | null =
  typeof window !== 'undefined' && 'BroadcastChannel' in window
    ? new BroadcastChannel('orvio_auth_channel')
    : null;

if (authChannel) {
  authChannel.onmessage = (event: MessageEvent<AuthChannelMessage>) => {
    if (event.data?.type === 'SESSION_SET') {
      useAuthStore.getState().setSession(event.data.session);
      identifyUser(event.data.session.user.id);
    } else if (event.data?.type === 'SESSION_CLEARED') {
      useAuthStore.getState().clearSession();
      resetIdentity();
    }
  };
}

export async function signIn(email: string, password: string, rememberMe = false): Promise<void> {
  const { data } = await apiRequest<AuthSession>('auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password, rememberMe }),
  });
  useAuthStore.getState().setSession(data);
  identifyUser(data.user.id);
  authChannel?.postMessage({ type: 'SESSION_SET', session: data });
}

export async function signOut(): Promise<void> {
  try {
    await apiRequest('auth/logout', { method: 'POST' });
  } finally {
    useAuthStore.getState().clearSession();
    resetIdentity();
    authChannel?.postMessage({ type: 'SESSION_CLEARED' });
  }
}

/**
 * Cold start bootstrapping — displays the splash screen only on initial page load
 * while waiting for the first refresh response.
 */
export async function bootstrapSession(): Promise<void> {
  const store = useAuthStore.getState();
  if (store.isAuthenticated) return;
  store.setBootstrapping(true);
  try {
    await refreshSession();
  } finally {
    useAuthStore.getState().setBootstrapping(false);
  }
}

/**
 * Non-blocking background refresh — updates access tokens silently without unmounting
 * active components, destroying user form state, or showing splash screens.
 */
export async function silentRefreshSession(): Promise<boolean> {
  return refreshSession();
}

/**
 * Intelligent session restore — uses cold bootstrap if unauthenticated,
 * or silent background refresh if already authenticated.
 */
export async function restoreSession(): Promise<void> {
  if (useAuthStore.getState().isAuthenticated) {
    await silentRefreshSession();
  } else {
    await bootstrapSession();
  }
}
