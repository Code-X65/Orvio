import { describe, expect, it } from 'vitest';
import { createVerifyEmailTemplate } from '../../src/modules/auth/templates/verify-email.js';
import { createWelcomeEmailTemplate } from '../../src/modules/auth/templates/welcome.js';

describe('Email Templates (HTML Generation)', () => {
  describe('createVerifyEmailTemplate', () => {
    it('generates personalized verification email with link and expiration info', () => {
      const template = createVerifyEmailTemplate({
        toName: 'Alex Adeleke',
        organizationName: 'Adeleke Logistics',
        verificationLink: 'http://localhost:4000/verify-email?token=xyz123',
      });

      expect(template.html).toContain('Alex Adeleke');
      expect(template.html).toContain('Adeleke Logistics');
      expect(template.html).toContain('http://localhost:4000/verify-email?token=xyz123');
      expect(template.html).toContain('Verify Email & Activate Workspace');
      expect(template.html).toContain('24 hours');
      expect(template.subject).toContain('Adeleke Logistics');
    });
  });

  describe('createWelcomeEmailTemplate', () => {
    it('generates personalized welcome onboarding email with workspace URL', () => {
      const template = createWelcomeEmailTemplate({
        toName: 'Alex Adeleke',
        organizationName: 'Adeleke Logistics',
        orgUrl: 'http://adelekelogistics.localhost:4000',
        planCode: 'bundle',
      });

      expect(template.html).toContain('Alex Adeleke');
      expect(template.html).toContain('Adeleke Logistics');
      expect(template.html).toContain('http://adelekelogistics.localhost:4000/dashboard');
      expect(template.html).toContain('Complete Business Suite Bundle');
      expect(template.subject).toContain('Adeleke Logistics is now active');
    });
  });
});
