import { describe, expect, it } from 'vitest';

import { providerAuthorizationUrl, isOAuthProvider } from '../../src/modules/auth/oauth.js';
import { testEnv } from '../helpers/app.js';

describe('OAuth provider setup', () => {
  it('accepts only the configured social providers', () => {
    expect(isOAuthProvider('google')).toBe(true);
    expect(isOAuthProvider('facebook')).toBe(true);
    expect(isOAuthProvider('microsoft')).toBe(false);
  });

  it('creates a Google authorization URL with state, nonce, and the backend callback', () => {
    const url = new URL(providerAuthorizationUrl({ ...testEnv, PUBLIC_API_URL: 'http://localhost:3000', GOOGLE_CLIENT_ID: 'google-client', GOOGLE_CLIENT_SECRET: 'google-secret' }, 'google', 'state-value', 'nonce-value'));
    expect(url.origin).toBe('https://accounts.google.com');
    expect(url.searchParams.get('state')).toBe('state-value');
    expect(url.searchParams.get('nonce')).toBe('nonce-value');
    expect(url.searchParams.get('redirect_uri')).toBe('http://localhost:3000/api/v1/auth/oauth/google/callback');
  });
});
