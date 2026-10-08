import crypto from 'node:crypto';
import argon2 from 'argon2';
import { env } from '../config/env.js';
import { AppError } from './errors.js';

const isTestEnv = env.NODE_ENV === 'test';

// OWASP baseline parameters for Argon2id (reduced under test for high-speed unit tests)
const ARGON2_OPTIONS: argon2.Options = {
  type: argon2.argon2id,
  memoryCost: isTestEnv ? 1024 : 19456,
  timeCost: 2,
  parallelism: 1,
};

export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, ARGON2_OPTIONS);
}

export async function verifyPassword(hash: string, plain: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, plain);
  } catch {
    return false;
  }
}

export function assertPasswordPolicy(password: string): void {
  if (password.length < 12) {
    throw new AppError('VALIDATION_ERROR', 'Password must be at least 12 characters long', 400, {
      field: 'password',
      rule: 'min_length',
    });
  }
  if (!/[A-Z]/.test(password)) {
    throw new AppError('VALIDATION_ERROR', 'Password must contain at least one uppercase letter', 400, {
      field: 'password',
      rule: 'uppercase',
    });
  }
  if (!/[a-z]/.test(password)) {
    throw new AppError('VALIDATION_ERROR', 'Password must contain at least one lowercase letter', 400, {
      field: 'password',
      rule: 'lowercase',
    });
  }
  if (!/[0-9]/.test(password)) {
    throw new AppError('VALIDATION_ERROR', 'Password must contain at least one number', 400, {
      field: 'password',
      rule: 'number',
    });
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    throw new AppError('VALIDATION_ERROR', 'Password must contain at least one special character', 400, {
      field: 'password',
      rule: 'special_char',
    });
  }
}

/**
 * Frequently-used passwords that still satisfy the complexity rules above.
 * Compared case-insensitively. HIBP covers the long tail; this list catches the
 * worst offenders even when HIBP is unreachable.
 */
const COMMON_COMPLIANT_PASSWORDS = new Set(
  [
    'Password123!', 'Password1234!', 'Password@123', 'Password@1234', 'Password#123',
    'P@ssw0rd1234', 'P@ssword1234', 'P@ssw0rd123!', 'Passw0rd123!', 'Welcome123!!',
    'Welcome@1234', 'Welcome1234!', 'Qwerty123456!', 'Qwerty@12345', 'Admin@123456',
    'Admin123456!', 'Letmein12345!', 'Changeme123!', 'Iloveyou123!', 'Abcd@1234567',
    'Abc123456789!', 'Football123!', 'Sunshine123!', 'Monkey123456!', 'Princess123!',
    'Summer2024!!', 'Winter2024!!', 'Spring2024!!', 'Autumn2024!!', 'Summer@2025',
    'Orvio@123456', 'Orvio1234567!',
  ].map((p) => p.toLowerCase())
);

export interface PasswordContext {
  email?: string;
  fullName?: string;
}

function assertNoPersonalInfo(password: string, context?: PasswordContext): void {
  const lowered = password.toLowerCase();
  const fragments: string[] = [];
  const localPart = context?.email?.split('@')[0]?.toLowerCase();
  if (localPart) fragments.push(localPart);
  if (context?.fullName) {
    fragments.push(...context.fullName.toLowerCase().split(/\s+/));
  }
  const hit = fragments.find((f) => f.length >= 4 && lowered.includes(f));
  if (hit) {
    throw new AppError('VALIDATION_ERROR', 'Password must not contain your name or email address', 400, {
      field: 'password',
      rule: 'personal_info',
    });
  }
}

/**
 * Returns the number of times the password appears in known breaches according
 * to the HaveIBeenPwned range API, or null if the lookup could not complete.
 * Uses k-anonymity: only the first 5 hex chars of the SHA-1 hash are sent.
 */
export async function getPwnedCount(
  password: string,
  timeoutMs: number = env.PASSWORD_BREACH_CHECK_TIMEOUT_MS
): Promise<number | null> {
  const sha1 = crypto.createHash('sha1').update(password, 'utf8').digest('hex').toUpperCase();
  const prefix = sha1.slice(0, 5);
  const suffix = sha1.slice(5);

  try {
    const res = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      headers: { 'Add-Padding': 'true', 'User-Agent': 'Orvio-Hub-Auth' },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) return null;
    const body = await res.text();
    for (const line of body.split('\n')) {
      const [hashSuffix, count] = line.trim().split(':');
      if (hashSuffix === suffix) {
        return Number.parseInt(count, 10) || 0;
      }
    }
    return 0;
  } catch {
    // Timeout / network failure: fail open so signups are never blocked by a third party
    return null;
  }
}

/**
 * Full password security gate used by every flow that sets a password.
 */
export async function assertPasswordSecurity(password: string, context?: PasswordContext): Promise<void> {
  assertPasswordPolicy(password);
  assertNoPersonalInfo(password, context);

  if (!env.PASSWORD_BREACH_CHECK_ENABLED) return;

  if (COMMON_COMPLIANT_PASSWORDS.has(password.toLowerCase())) {
    throw new AppError('VALIDATION_ERROR', 'This password is too common. Please choose a more unique password.', 400, {
      field: 'password',
      rule: 'common_password',
    });
  }

  const pwnedCount = await getPwnedCount(password);
  if (pwnedCount && pwnedCount > 0) {
    throw new AppError(
      'VALIDATION_ERROR',
      'This password has appeared in a known data breach. Please choose a different password.',
      400,
      { field: 'password', rule: 'breached_password' }
    );
  }
}
