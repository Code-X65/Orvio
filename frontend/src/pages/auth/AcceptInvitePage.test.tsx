import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AcceptInvitePage } from './AcceptInvitePage';
import { staffApi } from '../../features/staff/api/staff-api';
import { useAuthStore } from '../../stores/auth-store';

vi.mock('../../features/staff/api/staff-api', () => ({
  staffApi: {
    getInvitationByToken: vi.fn(),
    acceptInvitation: vi.fn(),
  },
}));

vi.mock('../../stores/auth-store', () => {
  const setSessionMock = vi.fn();
  return {
    useAuthStore: {
      getState: () => ({
        setSession: setSessionMock,
      }),
    },
  };
});

describe('AcceptInvitePage Component', () => {
  const mockInvite = {
    id: 'inv-123',
    email: 'newuser@acme.com',
    role: 'cashier' as const,
    organization: {
      id: 'org-123',
      name: 'Acme Retail',
      subdomain: 'acme',
      logo_url: null,
    },
    defaultBranchId: 'branch-1',
    branches: [{ id: 'branch-1', name: 'HQ Store', code: 'HQ' }],
    expiresAt: new Date(Date.now() + 86400000).toISOString(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders invitation details, prefilled name, and password inputs', async () => {
    (staffApi.getInvitationByToken as any).mockResolvedValue(mockInvite);

    render(
      <MemoryRouter initialEntries={['/invite?token=valid-raw-token-123']}>
        <AcceptInvitePage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Join Acme Retail')).toBeInTheDocument();
      expect(screen.getByText(/newuser@acme.com/i)).toBeInTheDocument();
      expect(screen.getByText(/CASHIER/i)).toBeInTheDocument();
      expect(screen.getByText('HQ Store')).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: /Accept & Enter Workspace/i })).toBeInTheDocument();
  });

  it('submits form and calls acceptInvitation API with valid password', async () => {
    (staffApi.getInvitationByToken as any).mockResolvedValue(mockInvite);
    (staffApi.acceptInvitation as any).mockResolvedValue({
      accessToken: 'test-access-token',
      refreshToken: 'test-refresh-token',
      user: { id: 'u-1', email: 'newuser@acme.com', fullName: 'New User' },
      organization: { id: 'org-123', name: 'Acme Retail', subdomain: 'acme' },
      role: 'cashier',
    });

    render(
      <MemoryRouter initialEntries={['/invite?token=valid-raw-token-123']}>
        <AcceptInvitePage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Join Acme Retail')).toBeInTheDocument();
    });

    const nameInput = screen.getByPlaceholderText(/Adebayo Ogunlesi/i);
    const passwordInput = screen.getByPlaceholderText(/Create a secure password/i);
    const confirmInput = screen.getByPlaceholderText(/Repeat password/i);

    fireEvent.change(nameInput, { target: { value: 'New User' } });
    fireEvent.change(passwordInput, { target: { value: 'ValidSecurePassword123!' } });
    fireEvent.change(confirmInput, { target: { value: 'ValidSecurePassword123!' } });

    const submitBtn = screen.getByRole('button', { name: /Accept & Enter Workspace/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(staffApi.acceptInvitation).toHaveBeenCalledWith('valid-raw-token-123', {
        fullName: 'New User',
        password: 'ValidSecurePassword123!',
      });
    });
  });

  it('displays error state when token is invalid or expired', async () => {
    (staffApi.getInvitationByToken as any).mockRejectedValue(
      new Error('Invitation has expired or is invalid')
    );

    render(
      <MemoryRouter initialEntries={['/invite?token=expired-token']}>
        <AcceptInvitePage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Invitation Unavailable')).toBeInTheDocument();
      expect(screen.getByText(/Invitation has expired or is invalid/i)).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /Go to Sign in/i })).toBeInTheDocument();
    });
  });
});
