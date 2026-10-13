/**
 * Centralized URL parameter sanitization and validation utilities.
 * Defends against:
 * 1. Prototype Pollution (__proto__, constructor, prototype)
 * 2. HTTP Parameter Pollution (HPP) / Duplicate Keys
 * 3. Control Character & Null Byte Injection (\0, ASCII < 0x20)
 * 4. Dangerous URI injection / XSS markers
 */

const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
const SAFE_KEY_REGEX = /^[a-zA-Z0-9_.-]{1,64}$/;
const CONTROL_CHARS_REGEX = /[\x00-\x1F\x7F]/g;
const MAX_PARAM_LENGTH_DEFAULT = 512;

/**
 * Checks whether a parameter key is safe from prototype pollution and malicious characters.
 */
export function isSafeParamKey(key: string): boolean {
  if (!key || typeof key !== 'string') return false;
  const lower = key.trim().toLowerCase();
  if (FORBIDDEN_KEYS.has(lower)) return false;
  return SAFE_KEY_REGEX.test(key);
}

/**
 * Sanitizes a single parameter value:
 * - Normalizes arrays (HPP mitigation: picks the last scalar entry)
 * - Removes null bytes and unprintable ASCII control characters
 * - Caps maximum string length to prevent memory exhaustion
 */
export function sanitizeParamValue(
  value: unknown,
  maxLength = MAX_PARAM_LENGTH_DEFAULT
): string | null {
  if (value === null || value === undefined) return null;

  let str: string;
  if (Array.isArray(value)) {
    // Parameter Pollution: find last valid non-empty scalar element
    const validItems = value.filter(
      (item) => item !== null && item !== undefined && String(item).trim() !== ''
    );
    if (validItems.length === 0) return null;
    str = String(validItems[validItems.length - 1]);
  } else if (typeof value === 'object') {
    return null; // Reject raw nested objects
  } else {
    str = String(value);
  }

  // Strip null bytes and control characters
  const cleaned = str.replace(CONTROL_CHARS_REGEX, '').trim();
  if (!cleaned) return null;

  // Enforce maximum length
  return cleaned.length > maxLength ? cleaned.slice(0, maxLength) : cleaned;
}

/**
 * Sanitizes a dictionary of query parameters.
 * Strips prototype pollution keys, invalid keys, null/empty values, and cleans values.
 */
export function sanitizeQueryParams(
  params?: Record<string, unknown> | null,
  allowedKeys?: readonly string[]
): Record<string, string> {
  if (!params || typeof params !== 'object') return {};

  const result: Record<string, string> = Object.create(null);
  const allowedSet = allowedKeys ? new Set(allowedKeys) : null;

  for (const [rawKey, rawValue] of Object.entries(params)) {
    if (!isSafeParamKey(rawKey)) continue;
    if (allowedSet && !allowedSet.has(rawKey)) continue;

    const sanitizedValue = sanitizeParamValue(rawValue);
    if (sanitizedValue !== null) {
      result[rawKey] = sanitizedValue;
    }
  }

  return result;
}

/**
 * Validates a parameter value against a whitelist of approved string values.
 */
export function validateParamWithWhitelist<T extends string>(
  value: string | null | undefined,
  allowedValues: readonly T[]
): T | null {
  if (!value) return null;
  const sanitized = sanitizeParamValue(value);
  if (!sanitized) return null;
  return (allowedValues as readonly string[]).includes(sanitized) ? (sanitized as T) : null;
}

/**
 * Validates an entity ID format against an approved regex pattern (default: alphanumeric with hyphens/underscores).
 */
export function validateEntityId(
  id: string | null | undefined,
  pattern = /^[a-zA-Z0-9_-]{1,64}$/
): string | null {
  if (!id) return null;
  const sanitized = sanitizeParamValue(id, 64);
  if (!sanitized) return null;
  return pattern.test(sanitized) ? sanitized : null;
}
