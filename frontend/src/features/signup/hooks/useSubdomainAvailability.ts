import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { validateSubdomainFormat } from '../../../lib/subdomain';
import { checkSubdomain, type CheckSubdomainResponse } from '../../../lib/api/auth';

export interface UseSubdomainAvailabilityResult {
  isLoading: boolean;
  isAvailable: boolean | null;
  reason?: string;
  suggestions: string[];
  error: string | null;
}

export function useSubdomainAvailability(subdomain: string): UseSubdomainAvailabilityResult {
  const [debouncedSubdomain, setDebouncedSubdomain] = React.useState(subdomain);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSubdomain(subdomain);
    }, 400);

    return () => clearTimeout(timer);
  }, [subdomain]);

  const formatValidation = React.useMemo(
    () => validateSubdomainFormat(debouncedSubdomain),
    [debouncedSubdomain]
  );

  const isFormatValid = debouncedSubdomain.length >= 3 && formatValidation.valid;

  const query = useQuery<CheckSubdomainResponse>({
    queryKey: ['subdomain-availability', debouncedSubdomain],
    queryFn: ({ signal }) => {
      return checkSubdomain(debouncedSubdomain, { signal });
    },
    enabled: isFormatValid,
    staleTime: 30 * 1000,
    retry: false,
  });

  const isDebouncing = subdomain !== debouncedSubdomain;
  const isLoading = (isDebouncing && subdomain.length >= 3) || (isFormatValid && query.isLoading);

  if (!debouncedSubdomain) {
    return {
      isLoading: false,
      isAvailable: null,
      suggestions: [],
      error: null,
    };
  }

  if (!formatValidation.valid) {
    return {
      isLoading: false,
      isAvailable: false,
      reason: formatValidation.reason,
      suggestions: [],
      error: null,
    };
  }

  if (query.data) {
    return {
      isLoading: false,
      isAvailable: query.data.available,
      reason: query.data.reason,
      suggestions: query.data.suggestions ?? [],
      error: null,
    };
  }

  if (query.isError) {
    return {
      isLoading: false,
      isAvailable: null,
      reason: undefined,
      suggestions: [],
      error: query.error instanceof Error ? query.error.message : 'Check failed',
    };
  }

  return {
    isLoading,
    isAvailable: null,
    suggestions: [],
    error: null,
  };
}
