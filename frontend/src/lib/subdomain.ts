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

export function sanitizeSubdomain(name: string): string {
  return name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 30);
}

export function validateSubdomainFormat(subdomain: string): {
  valid: boolean;
  reason?: 'TOO_SHORT' | 'TOO_LONG' | 'INVALID_CHARACTERS' | 'RESERVED';
} {
  if (!subdomain || subdomain.length < 3) {
    return { valid: false, reason: 'TOO_SHORT' };
  }
  if (subdomain.length > 30) {
    return { valid: false, reason: 'TOO_LONG' };
  }
  if (!SUBDOMAIN_REGEX.test(subdomain)) {
    return { valid: false, reason: 'INVALID_CHARACTERS' };
  }
  if (RESERVED_SUBDOMAINS.has(subdomain)) {
    return { valid: false, reason: 'RESERVED' };
  }
  return { valid: true };
}
