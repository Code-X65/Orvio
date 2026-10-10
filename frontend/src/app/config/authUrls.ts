/**
 * Environment-aware helper for Orvio Hub authentication & accounts subdomain routing.
 * In development (localhost): points to http://accounts.localhost:4000/signup or /login
 * In production: points to https://accounts.orvio.com or configured VITE_ACCOUNTS_URL.
 */

export const ALLOWED_WORKSPACE_ROUTES = ['/inventory', '/dashboard', '/orvio'];

export function getAccountsBaseUrl(): string {
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    const port = window.location.port ? `:${window.location.port}` : '';
    const protocol = window.location.protocol;

    if (hostname.includes('localhost') || hostname === '127.0.0.1') {
      return `${protocol}//localhost${port}`;
    }
  }

  // Production fallback or custom env override
  return (
    (typeof import.meta !== 'undefined' && import.meta.env?.VITE_ACCOUNTS_URL) ||
    'https://orvio.com'
  );
}

export function getMainMarketingUrl(): string {
  return getAccountsBaseUrl();
}

export function getSignupUrl(plan?: string): string {
  const base = `${getAccountsBaseUrl()}/signup`;
  return plan ? `${base}?plan=${encodeURIComponent(plan)}` : base;
}

export function getTrialUrl(): string {
  return `${getAccountsBaseUrl()}/trial`;
}

export function getLoginUrl(returnUrl?: string): string {
  const base = `${getAccountsBaseUrl()}/login`;
  return returnUrl ? `${base}?returnUrl=${encodeURIComponent(returnUrl)}` : base;
}

/**
 * Extracts any subdomain prefix from the current window location.
 * e.g. "apexglobalstore67.localhost:4000" -> "apexglobalstore67"
 * e.g. "apexglobalstore67.orvio.com" -> "apexglobalstore67"
 */
export function getSubdomainFromHostname(): string | null {
  if (typeof window === 'undefined') return null;
  const hostname = window.location.hostname.toLowerCase();

  // Local dev: e.g. "myorg.localhost"
  if (hostname.includes('.localhost')) {
    const parts = hostname.split('.localhost');
    return parts[0] || null;
  }

  // Pure localhost or IP: no subdomain
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return null;
  }

  const baseDomain =
    (typeof import.meta !== 'undefined' && import.meta.env?.VITE_APP_BASE_DOMAIN) ||
    'orvio.com';

  if (hostname.endsWith(`.${baseDomain}`)) {
    const sub = hostname.replace(`.${baseDomain}`, '');
    return sub && !sub.includes('.') ? sub : null;
  }

  return null;
}

/**
 * Checks if the current window request is on the accounts.* subdomain (e.g. accounts.localhost:4000 or accounts.orvio.com)
 */
export function isAccountsSubdomain(): boolean {
  const sub = getSubdomainFromHostname();
  return sub === 'accounts';
}

/**
 * Checks if the current window is a dedicated tenant workspace subdomain (not accounts, www, api, etc.)
 */
export function isTenantSubdomain(): boolean {
  const sub = getSubdomainFromHostname();
  if (!sub) return false;
  const systemSubs = ['accounts', 'www', 'api', 'admin', 'mail', 'status', 'docs'];
  return !systemSubs.includes(sub);
}

/**
 * Derives the full workspace URL for a tenant organization.
 * In development: http://<subdomain>.localhost:4000
 * In production: https://<subdomain>.orvio.com (or VITE_APP_BASE_DOMAIN)
 */
export function getTenantWorkspaceUrl(subdomain: string): string {
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    const port = window.location.port ? `:${window.location.port}` : '';
    const protocol = window.location.protocol;

    if (hostname.includes('localhost') || hostname === '127.0.0.1') {
      return `${protocol}//${subdomain}.localhost${port}`;
    }
  }

  const baseDomain =
    (typeof import.meta !== 'undefined' && import.meta.env?.VITE_APP_BASE_DOMAIN) ||
    'orvio.com';
  return `https://${subdomain}.${baseDomain}`;
}

/**
 * Returns the display domain suffix for form inputs (e.g. ".localhost:4000" in dev or ".orvio.com" in prod).
 */
export function getSubdomainDisplaySuffix(): string {
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    const port = window.location.port ? `:${window.location.port}` : '';
    if (hostname.includes('localhost') || hostname === '127.0.0.1') {
      return `.localhost${port}`;
    }
  }

  const baseDomain =
    (typeof import.meta !== 'undefined' && import.meta.env?.VITE_APP_BASE_DOMAIN) ||
    'orvio.com';
  return `.${baseDomain}`;
}

/**
 * Sanitizes and validates a requested returnUrl to ensure it is a safe relative workspace path.
 * Fallback defaults to "/orvio" (Launchpad).
 */
export function sanitizeReturnUrl(rawUrl: string | null | undefined, fallback: string = '/orvio'): string {
  if (!rawUrl || typeof rawUrl !== 'string') return fallback;

  try {
    const decoded = decodeURIComponent(rawUrl).trim();

    // Prevent open redirects (must start with single '/', no protocol or protocol-relative slashes)
    if (!decoded.startsWith('/') || decoded.startsWith('//') || decoded.startsWith('/\\')) {
      return fallback;
    }

    const pathname = decoded.split('?')[0].split('#')[0].toLowerCase();

    // Reject authentication routes
    const isAuthRoute = [
      '/login',
      '/signup',
      '/forgot-password',
      '/reset-password',
      '/verify-email',
      '/trial',
    ].some((authPath) => pathname === authPath || pathname.startsWith(`${authPath}/`));

    if (isAuthRoute) return fallback;

    // Strict validation against registered workspace product routes
    const isAllowed = ALLOWED_WORKSPACE_ROUTES.some(
      (route) => pathname === route || pathname.startsWith(`${route}/`)
    );

    if (!isAllowed) return fallback;

    return decoded;
  } catch {
    return fallback;
  }
}

/**
 * Stores the user's last visited workspace path for seamless resume.
 */
export function saveLastVisitedPath(subdomainOrOrgId: string, path: string): void {
  if (typeof window === 'undefined' || !subdomainOrOrgId) return;
  const sanitized = sanitizeReturnUrl(path, '');
  if (!sanitized) return;

  try {
    localStorage.setItem(`orvio_last_path_${subdomainOrOrgId.toLowerCase()}`, sanitized);
  } catch {
    // Ignore storage errors
  }
}

/**
 * Retrieves the user's last visited workspace path for an organization.
 */
export function getLastVisitedPath(subdomainOrOrgId: string): string | null {
  if (typeof window === 'undefined' || !subdomainOrOrgId) return null;
  try {
    const stored = localStorage.getItem(`orvio_last_path_${subdomainOrOrgId.toLowerCase()}`);
    return sanitizeReturnUrl(stored, '') || null;
  } catch {
    return null;
  }
}
