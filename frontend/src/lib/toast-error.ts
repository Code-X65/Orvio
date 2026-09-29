import { ApiError } from './api';
import { notify } from './notifications';

export function showErrorToast(error: unknown): void {
  if (error instanceof ApiError && error.status < 500) {
    notify.error(error.message, { description: error.requestId ? `Reference: ${error.requestId}` : undefined });
    return;
  }

  notify.error('Something went wrong.', { description: 'Please try again. If the problem continues, contact support.' });
}
