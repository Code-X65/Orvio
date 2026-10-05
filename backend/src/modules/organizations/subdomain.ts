import { AppError } from '../../lib/errors.js';

export const RESERVED_SUBDOMAINS = new Set([
  'app',
  'admin',
  'api',
  'auth',
  'accounts',
  'billing',
  'mail',
  'status',
  'portal',
  'help',
  'support',
  'dashboard',
  'root',
  'staging',
  'dev',
  'test',
  'demo',
  'internal',
  'cdn',
  'static',
  'assets',
  'webhook',
  'orvio',
  'hub',
  'login',
  'signup',
  'register',
  'docs',
  'blog',
]);

const SUBDOMAIN_REGEX = /^[a-z0-9]{3,30}$/;

export function normalizeOrganizationName(name: string): string {
  return name.trim().replace(/\s+/g, ' ');
}

export function deriveSubdomain(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\w]/g, '')
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 30);
}

export function isReserved(subdomain: string): boolean {
  return RESERVED_SUBDOMAINS.has(subdomain.toLowerCase().trim());
}

export function assertValidSubdomain(subdomain: string): void {
  const trimmed = subdomain.trim();

  if (trimmed.length < 3) {
    throw new AppError('INVALID_SUBDOMAIN', 'Subdomain must be at least 3 characters long', 400, {
      subdomain,
      rule: 'min_length',
    });
  }

  if (trimmed.length > 30) {
    throw new AppError('INVALID_SUBDOMAIN', 'Subdomain must not exceed 30 characters', 400, {
      subdomain,
      rule: 'max_length',
    });
  }

  if (!SUBDOMAIN_REGEX.test(trimmed)) {
    throw new AppError('INVALID_SUBDOMAIN', 'Subdomain must contain only lowercase letters and numbers', 400, {
      subdomain,
      rule: 'pattern',
    });
  }

  if (isReserved(trimmed)) {
    throw new AppError('INVALID_SUBDOMAIN', `Subdomain "${trimmed}" is reserved for system use`, 400, {
      subdomain,
      rule: 'reserved',
    });
  }
}

export function nextAvailableCandidates(base: string, count = 3): string[] {
  const clean = deriveSubdomain(base);
  const root = clean.length >= 3 ? clean.slice(0, 24) : 'org';
  
  const pool = [
    `${root}app`,
    `${root}hq`,
    `${root}hub`,
    `${root}ng`,
    `${root}store`,
    `${root}club`,
    `${root}77`,
    `${root}99`,
  ];

  const candidates: string[] = [];
  for (const candidate of pool) {
    const trimmed = candidate.slice(0, 30);
    if (!isReserved(trimmed) && !candidates.includes(trimmed) && SUBDOMAIN_REGEX.test(trimmed)) {
      candidates.push(trimmed);
      if (candidates.length >= count) {
        break;
      }
    }
  }

  return candidates;
}

// Backwards compatibility aliases
export const sanitizeSubdomain = deriveSubdomain;
export function validateSubdomain(subdomain: string): {
  valid: boolean;
  reason?: 'TOO_SHORT' | 'TOO_LONG' | 'INVALID_CHARACTERS' | 'RESERVED';
} {
  try {
    assertValidSubdomain(subdomain);
    return { valid: true };
  } catch (err) {
    if (err instanceof AppError && typeof err.details === 'object' && err.details !== null) {
      const rule = (err.details as { rule?: string }).rule;
      if (rule === 'min_length') return { valid: false, reason: 'TOO_SHORT' };
      if (rule === 'max_length') return { valid: false, reason: 'TOO_LONG' };
      if (rule === 'reserved') return { valid: false, reason: 'RESERVED' };
    }
    return { valid: false, reason: 'INVALID_CHARACTERS' };
  }
}

export const generateSuggestions = nextAvailableCandidates;

export function buildOrganizationUrl(subdomain: string, baseDomain = 'orvio.com', isProduction = false): string {
  const protocol = isProduction ? 'https' : 'http';
  return `${protocol}://${subdomain}.${baseDomain}`;
}

