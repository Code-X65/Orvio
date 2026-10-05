/**
 * Environment-aware helper for Orvio Hub authentication & accounts subdomain routing.
 * In development (localhost): points to http://accounts.localhost:4000/signup or /login
 * In production: points to https://accounts.orvio.com or configured VITE_ACCOUNTS_URL.
 */

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

export function getLoginUrl(): string {
  return `${getAccountsBaseUrl()}/login`;
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
