export interface TimezoneOption {
  value: string;
  label: string;
}

const FALLBACK_TIMEZONES: readonly string[] = [
  'Africa/Lagos',
  'Africa/Accra',
  'Africa/Johannesburg',
  'Africa/Nairobi',
  'Africa/Cairo',
  'Europe/London',
  'Europe/Paris',
  'America/New_York',
  'America/Chicago',
  'America/Los_Angeles',
  'America/Toronto',
  'Asia/Dubai',
  'Asia/Singapore',
  'Asia/Tokyo',
  'UTC',
] as const;

export function getSupportedTimezones(): TimezoneOption[] {
  let timezones: readonly string[] = FALLBACK_TIMEZONES;

  if (typeof Intl !== 'undefined' && typeof Intl.supportedValuesOf === 'function') {
    try {
      timezones = Intl.supportedValuesOf('timeZone');
    } catch {
      timezones = FALLBACK_TIMEZONES;
    }
  }

  return timezones.map((tz) => ({
    value: tz,
    label: tz.replace(/_/g, ' '),
  }));
}

export function isValidTimezone(tz: string): boolean {
  if (!tz) return false;
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}
