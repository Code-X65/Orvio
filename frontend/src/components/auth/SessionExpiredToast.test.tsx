import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SessionExpiredListener } from './SessionExpiredToast';
import { toast } from 'sonner';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

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
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('listens to orvio:auth:session-expired event and shows toast with 3s redirect', () => {
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

    expect(sessionStorage.getItem('orvio_redirect_after_login')).toBe('/inventory/stock?action=adjust');

    expect(toast.error).toHaveBeenCalledWith(
      'Session Expired',
      expect.objectContaining({
        id: 'orvio-session-expired',
        description: expect.stringContaining('Redirecting in 3s...'),
        action: expect.objectContaining({
          label: 'Sign In',
        }),
      })
    );
  });

  it('auto-redirects to login after 3 seconds', () => {
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

    expect(mockNavigate).not.toHaveBeenCalled();

    // Advance 3 seconds
    vi.advanceTimersByTime(3000);

    expect(mockNavigate).toHaveBeenCalledWith(
      '/login?returnUrl=%2Finventory%2Fdashboard',
      expect.objectContaining({ replace: true })
    );
    expect(toast.dismiss).toHaveBeenCalledWith('orvio-session-expired');
  });

  it('handles clicking the Sign In action in the toast immediately', () => {
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
    expect(mockNavigate).toHaveBeenCalledWith(
      '/login?returnUrl=%2Finventory%2Fdashboard',
      expect.objectContaining({ replace: true })
    );
  });

  it('cancels auto-redirect and prevents repeat toasts if dismissed by user', () => {
    render(
      <MemoryRouter initialEntries={['/inventory/items']}>
        <SessionExpiredListener />
      </MemoryRouter>
    );

    window.dispatchEvent(
      new CustomEvent('orvio:auth:session-expired', {
        detail: { redirectPath: '/inventory/items' },
      })
    );

    const callArgs = vi.mocked(toast.error).mock.calls[0];
    const toastConfig = callArgs[1] as any;

    // Simulate user clicking close 'x' or swiping away
    toastConfig.onDismiss();

    // Fast-forward past 3 seconds
    vi.advanceTimersByTime(5000);

    // User should NOT be navigated away because they cancelled/dismissed
    expect(mockNavigate).not.toHaveBeenCalled();

    // Background requests firing new session-expired event should NOT spam new toast
    vi.mocked(toast.error).mockClear();
    window.dispatchEvent(
      new CustomEvent('orvio:auth:session-expired', {
        detail: { redirectPath: '/inventory/items' },
      })
    );

    expect(toast.error).not.toHaveBeenCalled();
  });
});
