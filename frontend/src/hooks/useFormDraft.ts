import * as React from 'react';

export function useFormDraft<T extends Record<string, any>>(
  formKey: string | null | undefined,
  initialValues: T
) {
  const storageKey = formKey ? `orvio_draft_${formKey}` : null;

  const getDraft = React.useCallback((): T | null => {
    if (typeof window === 'undefined' || !storageKey) return null;
    try {
      const stored = sessionStorage.getItem(storageKey);
      if (stored) {
        return JSON.parse(stored) as T;
      }
    } catch {
      // Ignore parse errors
    }
    return null;
  }, [storageKey]);

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
        sessionStorage.setItem(storageKey, JSON.stringify(updated));
        setDraft(updated);
      } catch {
        // Ignore storage errors
      }
    },
    [storageKey, getDraft, initialValues]
  );

  const clearDraft = React.useCallback(() => {
    if (typeof window === 'undefined' || !storageKey) return;
    try {
      sessionStorage.removeItem(storageKey);
      setDraft(null);
    } catch {
      // Ignore storage errors
    }
  }, [storageKey]);

  return {
    draft,
    saveDraft,
    clearDraft,
    hasDraft: draft !== null,
  };
}
