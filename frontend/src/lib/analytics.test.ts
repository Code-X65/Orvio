import { afterEach, describe, expect, it, vi } from 'vitest';

import { getDeviceCategory, getSignupSource, identifyUser, resetIdentity, trackEvent } from './analytics';

type TestAnalyticsProvider = { track: ReturnType<typeof vi.fn>; identify: ReturnType<typeof vi.fn>; reset: ReturnType<typeof vi.fn> };

function setProvider(): TestAnalyticsProvider {
  const analytics: TestAnalyticsProvider = { track: vi.fn(), identify: vi.fn(), reset: vi.fn() };
  (window as unknown as { analytics?: TestAnalyticsProvider }).analytics = analytics;
  return analytics;
}

afterEach(() => {
  window.history.replaceState(null, '', '/');
  delete (window as unknown as { analytics?: TestAnalyticsProvider }).analytics;
});

describe('analytics helpers', () => {
  it('prefers UTM attribution, then referrer, then direct', () => {
    window.history.replaceState(null, '', '/register?utm_source=Partner%20Campaign');
    expect(getSignupSource()).toBe('partner campaign');

    window.history.replaceState(null, '', '/register');
    Object.defineProperty(document, 'referrer', { configurable: true, value: 'https://example.org/referral?email=not-used@example.com' });
    expect(getSignupSource()).toBe('example.org');

    Object.defineProperty(document, 'referrer', { configurable: true, value: '' });
    expect(getSignupSource()).toBe('direct');
  });

  it('classifies devices without returning a user agent', () => {
    Object.defineProperty(navigator, 'userAgent', { configurable: true, value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)' });
    expect(getDeviceCategory()).toBe('mobile');
    Object.defineProperty(navigator, 'userAgent', { configurable: true, value: 'Mozilla/5.0 (Linux; Android 13; Tablet)' });
    expect(getDeviceCategory()).toBe('tablet');
    Object.defineProperty(navigator, 'userAgent', { configurable: true, value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' });
    expect(getDeviceCategory()).toBe('desktop');
  });

  it('uses provider identity APIs and sends only the canonical tracking payload', () => {
    const analytics = setProvider();
    identifyUser('b4b8f0c0-6a1d-4a48-b2e6-1f86e8766020');
    resetIdentity();
    trackEvent('login_failed', { reason: 'INVALID_CREDENTIALS', device: 'desktop' });

    expect(analytics.identify).toHaveBeenCalledWith('b4b8f0c0-6a1d-4a48-b2e6-1f86e8766020');
    expect(analytics.reset).toHaveBeenCalledTimes(1);
    expect(analytics.track).toHaveBeenCalledWith('login_failed', expect.objectContaining({ reason: 'INVALID_CREDENTIALS', device: 'desktop' }));
    expect(analytics.track.mock.calls[0]?.[1]).not.toHaveProperty('email');
    expect(analytics.track.mock.calls[0]?.[1]).not.toHaveProperty('token');
  });
});
