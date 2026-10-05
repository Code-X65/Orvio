import { describe, expect, it } from 'vitest';
import { createVerifyEmailTemplate } from '../../src/modules/auth/templates/verify-email.js';
import { createWelcomeEmailTemplate } from '../../src/modules/auth/templates/welcome.js';

describe('Email Templates', () => {
  describe('createVerifyEmailTemplate', () => {
    it('generates email subject, HTML and plain text with verification link and tenant URL', () => {
      const template = createVerifyEmailTemplate({
        toName: 'Alex Adeleke',
        organizationName: 'Prime Global',
        verificationLink: 'http://localhost:4000/verify-email?token=abc123token',
        orgUrl: 'http://primeglobal.localhost:4000',
      });

      expect(template.subject).toContain('Prime Global');
      expect(template.html).toContain('Alex Adeleke');
      expect(template.html).toContain('http://localhost:4000/verify-email?token=abc123token');
      expect(template.html).toContain('http://primeglobal.localhost:4000');
      expect(template.text).toContain('http://localhost:4000/verify-email?token=abc123token');
    });
  });

  describe('createWelcomeEmailTemplate', () => {
    it('generates welcome email with activated tenant dashboard URL', () => {
      const template = createWelcomeEmailTemplate({
        toName: 'Alex Adeleke',
        organizationName: 'Prime Global',
        orgUrl: 'http://primeglobal.localhost:4000',
        planCode: 'bundle',
      });

      expect(template.subject).toContain('Prime Global');
      expect(template.html).toContain('http://primeglobal.localhost:4000/dashboard');
      expect(template.html).toContain('Complete Business Suite Bundle');
      expect(template.text).toContain('http://primeglobal.localhost:4000/dashboard');
    });
  });
});
