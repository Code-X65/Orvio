import { describe, it, expect } from 'vitest';
import { AccountStepSchema, OrganizationStepSchema, SignupFormSchema } from './schema';

describe('Signup Schemas', () => {
  describe('AccountStepSchema', () => {
    it('accepts valid account details', () => {
      const valid = {
        fullName: 'Alex Adeleke',
        email: 'alex@company.com',
        phone: '+2348012345678',
        password: 'Password123!',
        termsAccepted: true,
      };
      const result = AccountStepSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it('rejects when terms are not accepted', () => {
      const invalid = {
        fullName: 'Alex Adeleke',
        email: 'alex@company.com',
        phone: '+2348012345678',
        password: 'Password123!',
        termsAccepted: false,
      };
      const result = AccountStepSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it('rejects passwords failing complexity rules', () => {
      expect(
        AccountStepSchema.safeParse({
          fullName: 'Alex',
          email: 'alex@test.com',
          password: 'simplepassword', // missing uppercase, number & special char
          termsAccepted: true,
        }).success
      ).toBe(false);

      expect(
        AccountStepSchema.safeParse({
          fullName: 'Alex',
          email: 'alex@test.com',
          password: 'PASSWORD123!', // missing lowercase
          termsAccepted: true,
        }).success
      ).toBe(false);

      expect(
        AccountStepSchema.safeParse({
          fullName: 'Alex',
          email: 'alex@test.com',
          password: 'Pass1!', // too short (< 12)
          termsAccepted: true,
        }).success
      ).toBe(false);

      expect(
        AccountStepSchema.safeParse({
          fullName: 'Alex',
          email: 'alex@test.com',
          password: 'Password1234', // missing special char
          termsAccepted: true,
        }).success
      ).toBe(false);
    });
  });

  describe('OrganizationStepSchema', () => {
    it('accepts valid organization details with lowercase alphanumeric subdomain', () => {
      const valid = {
        organizationName: 'Lekki Fitness Hub',
        subdomain: 'lekkifitness',
        planCode: 'gym',
        timezone: 'Africa/Lagos',
        currency: 'NGN',
      };
      const result = OrganizationStepSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it('rejects subdomains containing hyphens or symbols', () => {
      const invalid = {
        organizationName: 'Lekki Fitness',
        subdomain: 'lekki-fitness', // hyphens are forbidden
        planCode: 'bundle',
        timezone: 'Africa/Lagos',
        currency: 'NGN',
      };
      const result = OrganizationStepSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });
  });

  describe('SignupFormSchema', () => {
    it('combines both steps for complete submission validation', () => {
      const completeData = {
        fullName: 'Alex Adeleke',
        email: 'alex@company.com',
        password: 'Password123!',
        termsAccepted: true,
        organizationName: 'Lekki Fitness Hub',
        subdomain: 'lekkifitness',
        planCode: 'bundle',
        timezone: 'Africa/Lagos',
        currency: 'NGN',
      };
      const result = SignupFormSchema.safeParse(completeData);
      expect(result.success).toBe(true);
    });
  });
});
