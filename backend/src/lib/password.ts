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
