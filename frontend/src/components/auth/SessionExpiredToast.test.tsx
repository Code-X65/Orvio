import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SessionExpiredListener } from './SessionExpiredToast';
import { toast } from 'sonner';

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    dismiss: vi.fn(),
  },
}));

describe('SessionExpiredListener Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
  });

  it('listens to orvio:auth:session-expired event and shows persistent toast', () => {
    render(
      <MemoryRouter>
        <SessionExpiredListener />
      </MemoryRouter>
    );

    window.dispatchEvent(
      new CustomEvent('orvio:auth:session-expired', {
        detail: { redirectPath: '/inventory/stock?action=adjust' },
      })
    );

    // Verifies sessionStorage saved redirect path
    expect(sessionStorage.getItem('orvio_redirect_after_login')).toBe('/inventory/stock?action=adjust');

    // Verifies toast.error called with 'Session Expired'
    expect(toast.error).toHaveBeenCalledWith(
      'Session Expired',
      expect.objectContaining({
        id: 'orvio-session-expired',
        description: 'Your session has expired. Please sign in again to continue.',
        action: expect.objectContaining({
          label: 'Sign In',
        }),
      })
    );
  });

  it('handles clicking the Sign In action in the toast', () => {
    render(
      <MemoryRouter initialEntries={['/inventory/dashboard']}>
        <SessionExpiredListener />
      </MemoryRouter>
    );

    window.dispatchEvent(
      new CustomEvent('orvio:auth:session-expired', {
        detail: { redirectPath: '/inventory/dashboard' },
      })
    );

    const callArgs = vi.mocked(toast.error).mock.calls[0];
    const actionConfig = (callArgs[1] as any).action;

    // Trigger action click
    actionConfig.onClick();

    expect(toast.dismiss).toHaveBeenCalledWith('orvio-session-expired');
    expect(sessionStorage.getItem('orvio_redirect_after_login')).toBe('/inventory/dashboard');
  });
});
