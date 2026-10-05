import { Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { getSubdomainDisplaySuffix } from '../../../app/config/authUrls';

export interface AvailabilityBadgeProps {
  isLoading: boolean;
  isAvailable: boolean | null;
  subdomain: string;
  reason?: string;
}

export function AvailabilityBadge({
  isLoading,
  isAvailable,
  subdomain,
  reason,
}: AvailabilityBadgeProps) {
  const domainSuffix = getSubdomainDisplaySuffix();

  if (isLoading) {
    return (
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="flex items-center gap-1.5 text-xs text-slate-400"
      >
        <Loader2 className="h-3.5 w-3.5 animate-spin text-indigo-400" />
        <span>Checking subdomain availability...</span>
      </div>
    );
  }

  if (isAvailable === true) {
    return (
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="flex items-center gap-1.5 text-xs text-emerald-400"
      >
        <CheckCircle2 className="h-3.5 w-3.5" />
        <span>
          <strong>{subdomain}{domainSuffix}</strong> is available!
        </span>
      </div>
    );
  }

  if (isAvailable === false) {
    let message = 'Subdomain must be 3-30 lowercase letters and numbers.';
    if (reason === 'RESERVED') {
      message = 'This subdomain is reserved by the platform.';
    } else if (reason === 'ALREADY_TAKEN') {
      message = 'This subdomain is already taken by another organization.';
    } else if (reason === 'TOO_SHORT') {
      message = 'Subdomain must be at least 3 characters.';
    } else if (reason === 'TOO_LONG') {
      message = 'Subdomain must be at most 30 characters.';
    }

    return (
      <div
        role="alert"
        aria-live="polite"
        aria-atomic="true"
        className="flex items-center gap-1.5 text-xs text-rose-400"
      >
        <XCircle className="h-3.5 w-3.5" />
        <span>{message}</span>
      </div>
    );
  }

  return null;
}
