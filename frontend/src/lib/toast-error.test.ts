import { describe, expect, it, vi } from 'vitest';

vi.mock('sonner', () => ({ toast: { error: vi.fn() } }));

import { toast } from 'sonner';
import { ApiError } from './api';
import { showErrorToast } from './toast-error';

describe('showErrorToast', () => {
  it('shows a safe message for unexpected failures', () => {
    showErrorToast(new Error('internal detail'));
    expect(toast.error).toHaveBeenCalledWith('Something went wrong.', expect.any(Object));
  });

  it('shows documented client API failures', () => {
    showErrorToast(new ApiError('FORBIDDEN', 'Access denied.', 403, 'req-1'));
    expect(toast.error).toHaveBeenCalledWith('Access denied.', { description: 'Reference: req-1' });
  });
});
