import * as React from 'react';

export interface FormDraftEnvelope<T> {
  data: T;
  updatedAt: number;
  version: number;
  namespace?: string;
}

export interface UseFormDraftOptions {
  namespace?: string;
  ttlMs?: number;
}

const DEFAULT_DRAFT_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Scans sessionStorage and removes any drafts older than the specified max age.
 */
export function cleanupStaleDrafts(maxAgeMs = DEFAULT_DRAFT_TTL_MS): number {
  if (typeof window === 'undefined') return 0;
  let cleanedCount = 0;
  try {
    Object.keys(sessionStorage).forEach((key) => {
      if (key.startsWith('orvio_draft_')) {
        try {
          const stored = sessionStorage.getItem(key);
          if (stored) {
            const parsed = JSON.parse(stored);
            if (parsed && typeof parsed === 'object' && typeof parsed.updatedAt === 'number') {
              if (Date.now() - parsed.updatedAt > maxAgeMs) {
                sessionStorage.removeItem(key);
                cleanedCount++;
              }
            }
          }
        } catch {
          sessionStorage.removeItem(key);
          cleanedCount++;
        }
      }
    });
  } catch {
    // Ignore storage errors
  }
  return cleanedCount;
}

export function useFormDraft<T extends Record<string, any>>(
  formKey: string | null | undefined,
  initialValues: T,
  options: UseFormDraftOptions = {}
) {
  const { namespace, ttlMs = DEFAULT_DRAFT_TTL_MS } = options;
  const prefix = namespace ? `orvio_draft_${namespace}_` : 'orvio_draft_';
  const storageKey = formKey ? `${prefix}${formKey}` : null;

  const [lastSavedAt, setLastSavedAt] = React.useState<number | null>(null);

  const getDraft = React.useCallback((): T | null => {
    if (typeof window === 'undefined' || !storageKey) return null;
    try {
      const stored = sessionStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Envelope format
        if (parsed && typeof parsed === 'object' && 'data' in parsed && typeof parsed.updatedAt === 'number') {
          if (Date.now() - parsed.updatedAt > ttlMs) {
            sessionStorage.removeItem(storageKey);
            return null;
          }
          setLastSavedAt(parsed.updatedAt);
          return parsed.data as T;
        }
        // Backward-compatible fallback for plain object
        return parsed as T;
      }
    } catch {
      // Ignore parse errors
    }
    return null;
  }, [storageKey, ttlMs]);

  const [draft, setDraft] = React.useState<T | null>(() => getDraft());

  React.useEffect(() => {
    setDraft(getDraft());
  }, [getDraft]);

  const saveDraft = React.useCallback(
    (values: Partial<T>) => {
      if (typeof window === 'undefined' || !storageKey) return;
      try {
        const current = getDraft() || initialValues;
        const updated = { ...current, ...values };
        const now = Date.now();
        const envelope: FormDraftEnvelope<T> = {
          data: updated,
          updatedAt: now,
          version: 1,
          namespace,
        };
        sessionStorage.setItem(storageKey, JSON.stringify(envelope));
        setDraft(updated);
        setLastSavedAt(now);
      } catch {
        // Ignore storage errors
      }
    },
    [storageKey, getDraft, initialValues, namespace]
  );

  const clearDraft = React.useCallback(() => {
    if (typeof window === 'undefined' || !storageKey) return;
    try {
      sessionStorage.removeItem(storageKey);
      setDraft(null);
      setLastSavedAt(null);
    } catch {
      // Ignore storage errors
    }
  }, [storageKey]);

  return {
    draft,
    saveDraft,
    clearDraft,
    hasDraft: draft !== null && Object.keys(draft).length > 0,
    lastSavedAt,
    isRestored: Boolean(draft && lastSavedAt),
  };
}

