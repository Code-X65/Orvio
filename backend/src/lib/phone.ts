export interface CountryPhoneRule {
  name: string;
  iso: string;
  dialCode: string;
  minLength: number;
  maxLength: number;
}

export const COUNTRY_PHONE_RULES: CountryPhoneRule[] = [
  // Primary African Markets
  { name: 'Nigeria', iso: 'NG', dialCode: '+234', minLength: 10, maxLength: 10 },
  { name: 'Ghana', iso: 'GH', dialCode: '+233', minLength: 9, maxLength: 9 },
  { name: 'Kenya', iso: 'KE', dialCode: '+254', minLength: 9, maxLength: 9 },
  { name: 'South Africa', iso: 'ZA', dialCode: '+27', minLength: 9, maxLength: 9 },
  { name: 'Rwanda', iso: 'RW', dialCode: '+250', minLength: 9, maxLength: 9 },
  { name: 'Uganda', iso: 'UG', dialCode: '+256', minLength: 9, maxLength: 9 },
  { name: 'Tanzania', iso: 'TZ', dialCode: '+255', minLength: 9, maxLength: 9 },
  { name: 'Egypt', iso: 'EG', dialCode: '+20', minLength: 10, maxLength: 10 },
  { name: 'Cameroon', iso: 'CM', dialCode: '+237', minLength: 9, maxLength: 9 },
  { name: "Côte d'Ivoire", iso: 'CI', dialCode: '+225', minLength: 10, maxLength: 10 },
  { name: 'Senegal', iso: 'SN', dialCode: '+221', minLength: 9, maxLength: 9 },
  { name: 'Ethiopia', iso: 'ET', dialCode: '+251', minLength: 9, maxLength: 9 },
  { name: 'Benin', iso: 'BJ', dialCode: '+229', minLength: 8, maxLength: 8 },
  { name: 'Togo', iso: 'TG', dialCode: '+228', minLength: 8, maxLength: 8 },

  // Global & Diaspora
  { name: 'United Kingdom', iso: 'GB', dialCode: '+44', minLength: 9, maxLength: 10 },
  { name: 'United States', iso: 'US', dialCode: '+1', minLength: 10, maxLength: 10 },
  { name: 'Canada', iso: 'CA', dialCode: '+1', minLength: 10, maxLength: 10 },
  { name: 'United Arab Emirates', iso: 'AE', dialCode: '+971', minLength: 9, maxLength: 9 },
  { name: 'India', iso: 'IN', dialCode: '+91', minLength: 10, maxLength: 10 },
  { name: 'Germany', iso: 'DE', dialCode: '+49', minLength: 10, maxLength: 11 },
  { name: 'France', iso: 'FR', dialCode: '+33', minLength: 9, maxLength: 9 },
  { name: 'Australia', iso: 'AU', dialCode: '+61', minLength: 9, maxLength: 9 },
  { name: 'China', iso: 'CN', dialCode: '+86', minLength: 11, maxLength: 11 },
  { name: 'Saudi Arabia', iso: 'SA', dialCode: '+966', minLength: 9, maxLength: 9 },
  { name: 'Ireland', iso: 'IE', dialCode: '+353', minLength: 9, maxLength: 9 },
  { name: 'Netherlands', iso: 'NL', dialCode: '+31', minLength: 9, maxLength: 9 },
];

export function findCountryRuleByPhone(phone: string): CountryPhoneRule | undefined {
  if (!phone || !phone.startsWith('+')) return undefined;
  return [...COUNTRY_PHONE_RULES]
    .sort((a, b) => b.dialCode.length - a.dialCode.length)
    .find((c) => phone.startsWith(c.dialCode));
}

export function validateInternationalPhone(phone: string): { valid: boolean; message?: string } {
  if (!phone || typeof phone !== 'string' || !phone.startsWith('+')) {
    return { valid: false, message: 'Enter a valid phone number starting with +' };
  }

  // Ensure digits only after plus
  const digitsOnly = phone.slice(1);
  if (!/^\d+$/.test(digitsOnly)) {
    return { valid: false, message: 'Phone number can only contain numeric digits after +' };
  }

  const rule = findCountryRuleByPhone(phone);
  if (rule) {
    const nationalDigits = phone.slice(rule.dialCode.length);
    if (nationalDigits.length < rule.minLength) {
      const lengthDesc = rule.minLength === rule.maxLength ? `${rule.minLength} digits` : `between ${rule.minLength} and ${rule.maxLength} digits`;
      return {
        valid: false,
        message: `Phone number for ${rule.name} (${rule.dialCode}) must be ${lengthDesc}.`,
      };
    }
    if (nationalDigits.length > rule.maxLength) {
      return {
        valid: false,
        message: `Phone number for ${rule.name} (${rule.dialCode}) cannot exceed ${rule.maxLength} digits.`,
      };
    }
    return { valid: true };
  }

  // Global E.164 bounds (ITU-T recommendation: 7 to 15 digits total)
  if (digitsOnly.length < 7 || digitsOnly.length > 15) {
    return {
      valid: false,
      message: 'International phone number must be between 7 and 15 digits total.',
    };
  }

  return { valid: true };
}
