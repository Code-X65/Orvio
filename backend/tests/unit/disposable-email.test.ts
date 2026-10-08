import { describe, expect, it } from 'vitest';
import { isDisposableDomain } from '../../src/modules/auth/disposable-domains.js';
import { isDisposableEmail } from '../../src/modules/auth/schemas.js';

describe('Disposable Email Blocklist', () => {
  it('identifies common disposable email domains', () => {
    expect(isDisposableDomain('test@mailinator.com')).toBe(true);
    expect(isDisposableDomain('user@guerrillamail.com')).toBe(true);
    expect(isDisposableDomain('random@10minutemail.com')).toBe(true);
    expect(isDisposableDomain('someone@tempmail.com')).toBe(true);
    expect(isDisposableDomain('person@sharklasers.com')).toBe(true);
    expect(isDisposableDomain('user@yopmail.com')).toBe(true);
    expect(isDisposableDomain('bot@trashmail.com')).toBe(true);
  });

  it('identifies subdomains of disposable services', () => {
    expect(isDisposableDomain('test@sub.mailinator.com')).toBe(true);
    expect(isDisposableDomain('user@temp.guerrillamail.com')).toBe(true);
  });

  it('identifies domains matching disposable keyword patterns', () => {
    expect(isDisposableDomain('user@mycustomdisposablemail.org')).toBe(true);
    expect(isDisposableDomain('bot@instantthrowawayinbox.com')).toBe(true);
  });

  it('allows legitimate business and personal email domains', () => {
    expect(isDisposableDomain('alex@gmail.com')).toBe(false);
    expect(isDisposableDomain('sarah@yahoo.com')).toBe(false);
    expect(isDisposableDomain('ceo@orvio.com')).toBe(false);
    expect(isDisposableDomain('dev@microsoft.com')).toBe(false);
    expect(isDisposableDomain('contact@company.ng')).toBe(false);
  });

  it('schema helper isDisposableEmail delegates correctly', () => {
    expect(isDisposableEmail('test@mailinator.com')).toBe(true);
    expect(isDisposableEmail('alex@orvio.com')).toBe(false);
  });
});
