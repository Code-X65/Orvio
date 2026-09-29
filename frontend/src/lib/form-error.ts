import type { FieldValues, Path, UseFormSetError } from 'react-hook-form';
import { ApiError, NetworkError } from './api';

type Flattened = { fieldErrors?: Record<string, string[] | undefined>; formErrors?: string[] };
export function applyApiError<T extends FieldValues>(error: unknown, setError: UseFormSetError<T>): string | undefined {
  if (error instanceof NetworkError) return error.message;
  if (!(error instanceof ApiError)) return 'Something went wrong. Please try again.';
  const details = error.details as Flattened | undefined;
  if (details?.fieldErrors) for (const [field, messages] of Object.entries(details.fieldErrors)) if (messages?.[0]) setError(field as Path<T>, { type: 'server', message: messages[0] });
  if (error.code === 'EMAIL_IN_USE') { setError('email' as Path<T>, { type: 'server', message: error.message }); return; }
  const retryAfter = (error.details as { retryAfterSeconds?: number } | undefined)?.retryAfterSeconds;
  return retryAfter ? `${error.message} Try again in ${Math.ceil(retryAfter / 60)} minute(s).` : details?.formErrors?.[0] ?? error.message;
}
