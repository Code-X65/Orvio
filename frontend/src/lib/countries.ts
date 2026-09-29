export interface Country {
  name: string;
  iso: string;
  dialCode: string;
  flag: string;
  example: string;
  minLength: number;
  maxLength: number;
}

export const COUNTRIES: Country[] = [
  // Primary African Markets
  { name: 'Nigeria', iso: 'NG', dialCode: '+234', flag: '🇳🇬', example: '801 234 5678', minLength: 10, maxLength: 10 },
  { name: 'Ghana', iso: 'GH', dialCode: '+233', flag: '🇬🇭', example: '24 123 4567', minLength: 9, maxLength: 9 },
  { name: 'Kenya', iso: 'KE', dialCode: '+254', flag: '🇰🇪', example: '712 345 678', minLength: 9, maxLength: 9 },
  { name: 'South Africa', iso: 'ZA', dialCode: '+27', flag: '🇿🇦', example: '82 123 4567', minLength: 9, maxLength: 9 },
  { name: 'Rwanda', iso: 'RW', dialCode: '+250', flag: '🇷🇼', example: '788 123 456', minLength: 9, maxLength: 9 },
  { name: 'Uganda', iso: 'UG', dialCode: '+256', flag: '🇺🇬', example: '772 123 456', minLength: 9, maxLength: 9 },
  { name: 'Tanzania', iso: 'TZ', dialCode: '+255', flag: '🇹🇿', example: '712 345 678', minLength: 9, maxLength: 9 },
  { name: 'Egypt', iso: 'EG', dialCode: '+20', flag: '🇪🇬', example: '100 123 4567', minLength: 10, maxLength: 10 },
  { name: 'Cameroon', iso: 'CM', dialCode: '+237', flag: '🇨🇲', example: '6 71 23 45 67', minLength: 9, maxLength: 9 },
  { name: "Côte d'Ivoire", iso: 'CI', dialCode: '+225', flag: '🇨🇮', example: '07 12 34 56 78', minLength: 10, maxLength: 10 },
  { name: 'Senegal', iso: 'SN', dialCode: '+221', flag: '🇸🇳', example: '77 123 45 67', minLength: 9, maxLength: 9 },
  { name: 'Ethiopia', iso: 'ET', dialCode: '+251', flag: '🇪🇹', example: '91 123 4567', minLength: 9, maxLength: 9 },
  { name: 'Benin', iso: 'BJ', dialCode: '+229', flag: '🇧🇯', example: '97 12 34 56', minLength: 8, maxLength: 8 },
  { name: 'Togo', iso: 'TG', dialCode: '+228', flag: '🇹🇬', example: '90 12 34 56', minLength: 8, maxLength: 8 },

  // Global & Diaspora
  { name: 'United Kingdom', iso: 'GB', dialCode: '+44', flag: '🇬🇧', example: '7911 123456', minLength: 9, maxLength: 10 },
  { name: 'United States', iso: 'US', dialCode: '+1', flag: '🇺🇸', example: '202 555 0123', minLength: 10, maxLength: 10 },
  { name: 'Canada', iso: 'CA', dialCode: '+1', flag: '🇨🇦', example: '416 555 0123', minLength: 10, maxLength: 10 },
  { name: 'United Arab Emirates', iso: 'AE', dialCode: '+971', flag: '🇦🇪', example: '50 123 4567', minLength: 9, maxLength: 9 },
  { name: 'India', iso: 'IN', dialCode: '+91', flag: '🇮🇳', example: '98765 43210', minLength: 10, maxLength: 10 },
  { name: 'Germany', iso: 'DE', dialCode: '+49', flag: '🇩🇪', example: '151 12345678', minLength: 10, maxLength: 11 },
  { name: 'France', iso: 'FR', dialCode: '+33', flag: '🇫🇷', example: '6 12 34 56 78', minLength: 9, maxLength: 9 },
  { name: 'Australia', iso: 'AU', dialCode: '+61', flag: '🇦🇺', example: '412 345 678', minLength: 9, maxLength: 9 },
  { name: 'China', iso: 'CN', dialCode: '+86', flag: '🇨🇳', example: '138 0013 8000', minLength: 11, maxLength: 11 },
  { name: 'Saudi Arabia', iso: 'SA', dialCode: '+966', flag: '🇸🇦', example: '50 123 4567', minLength: 9, maxLength: 9 },
  { name: 'Ireland', iso: 'IE', dialCode: '+353', flag: '🇮🇪', example: '85 123 4567', minLength: 9, maxLength: 9 },
  { name: 'Netherlands', iso: 'NL', dialCode: '+31', flag: '🇳🇱', example: '6 12345678', minLength: 9, maxLength: 9 },
];

export const DEFAULT_COUNTRY = COUNTRIES[0]; // Nigeria (+234)

const TIMEZONE_TO_ISO: Record<string, string> = {
  'Africa/Lagos': 'NG',
  'Africa/Accra': 'GH',
  'Africa/Nairobi': 'KE',
  'Africa/Johannesburg': 'ZA',
  'Africa/Kigali': 'RW',
  'Africa/Kampala': 'UG',
  'Africa/Dar_es_Salaam': 'TZ',
  'Africa/Cairo': 'EG',
  'Africa/Douala': 'CM',
  'Africa/Abidjan': 'CI',
  'Africa/Dakar': 'SN',
  'Africa/Addis_Ababa': 'ET',
  'Europe/London': 'GB',
  'America/New_York': 'US',
  'America/Chicago': 'US',
  'America/Denver': 'US',
  'America/Los_Angeles': 'US',
  'America/Toronto': 'CA',
  'America/Vancouver': 'CA',
  'Asia/Dubai': 'AE',
  'Asia/Kolkata': 'IN',
  'Asia/Calcutta': 'IN',
  'Europe/Berlin': 'DE',
  'Europe/Paris': 'FR',
  'Australia/Sydney': 'AU',
  'Australia/Melbourne': 'AU',
  'Asia/Riyadh': 'SA',
  'Europe/Dublin': 'IE',
  'Europe/Amsterdam': 'NL',
};

export function detectUserCountry(): Country {
  if (typeof window === 'undefined') return DEFAULT_COUNTRY;

  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz && TIMEZONE_TO_ISO[tz]) {
      const match = COUNTRIES.find((c) => c.iso === TIMEZONE_TO_ISO[tz]);
      if (match) return match;
    }

    const lang = navigator.language || (navigator.languages && navigator.languages[0]);
    if (lang && lang.includes('-')) {
      const iso = lang.split('-')[1]?.toUpperCase();
      const match = COUNTRIES.find((c) => c.iso === iso);
      if (match) return match;
    }
  } catch {
    // Fallback safely
  }

  return DEFAULT_COUNTRY;
}

export function findCountryByPhone(phone: string): Country | undefined {
  if (!phone || !phone.startsWith('+')) return undefined;
  return [...COUNTRIES]
    .sort((a, b) => b.dialCode.length - a.dialCode.length)
    .find((c) => phone.startsWith(c.dialCode));
}

export function formatE164(dialCode: string, nationalNumber: string): string {
  const digitsOnly = nationalNumber.replace(/\D/g, '');
  const cleanedNational = digitsOnly.replace(/^0+/, '');
  if (!cleanedNational) return '';
  const prefix = dialCode.startsWith('+') ? dialCode : `+${dialCode}`;
  return `${prefix}${cleanedNational}`;
}

export function validatePhoneNumber(phone: string): { valid: boolean; message?: string } {
  if (!phone || !phone.startsWith('+')) {
    return { valid: false, message: 'Please enter a valid phone number.' };
  }

  const country = findCountryByPhone(phone);
  if (country) {
    const nationalDigits = phone.slice(country.dialCode.length).replace(/\D/g, '');
    if (nationalDigits.length < country.minLength) {
      const needed = country.minLength === country.maxLength ? `${country.minLength}` : `${country.minLength}-${country.maxLength}`;
      return {
        valid: false,
        message: `Phone number for ${country.name} must be ${needed} digits.`,
      };
    }
    if (nationalDigits.length > country.maxLength) {
      return {
        valid: false,
        message: `Phone number for ${country.name} cannot exceed ${country.maxLength} digits.`,
      };
    }
    return { valid: true };
  }

  // Global fallback for unlisted country codes
  const digitsOnly = phone.slice(1).replace(/\D/g, '');
  if (digitsOnly.length < 7 || digitsOnly.length > 15) {
    return { valid: false, message: 'Phone number must be between 7 and 15 digits.' };
  }

  return { valid: true };
}
