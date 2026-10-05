import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { VerifyEmailPage } from './VerifyEmailPage';
import * as trialApi from '../../features/trial/api';

vi.mock('../../features/trial/api', () => ({
  setupPasswordAndVerify: vi.fn(),
}));

vi.mock('../../domains/auth/api', () => ({
  resendVerificationEmail: vi.fn(),
}));

describe('VerifyEmailPage Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders Set Your Password form when token is provided in query params', () => {
    render(
      <MemoryRouter initialEntries={['/verify-email?token=valid-test-token']}>
        <VerifyEmailPage />
      </MemoryRouter>
    );

    expect(screen.getByText('Set Your Password')).toBeInTheDocument();
    expect(screen.getByText('New Password (minimum 12 characters)')).toBeInTheDocument();
    expect(screen.getByText('Min 12 characters')).toBeInTheDocument();
    expect(screen.getByText('1 uppercase')).toBeInTheDocument();
    expect(screen.getByText('1 lowercase')).toBeInTheDocument();
    expect(screen.getByText('1 number')).toBeInTheDocument();
    expect(screen.getByText('1 special symbol')).toBeInTheDocument();
  });

  it('toggles password visibility when clicking the eye icon button', () => {
    render(
      <MemoryRouter initialEntries={['/verify-email?token=valid-test-token']}>
        <VerifyEmailPage />
      </MemoryRouter>
    );

    const showPasswordBtn = screen.getByRole('button', { name: 'Show new password' });
    const passwordInputs = screen.getAllByPlaceholderText('••••••••');
    const newPasswordInput = passwordInputs[0];

    expect(newPasswordInput).toHaveAttribute('type', 'password');

    // Click to reveal password
    fireEvent.click(showPasswordBtn);
    expect(newPasswordInput).toHaveAttribute('type', 'text');

    // Click again to hide password
    const hidePasswordBtn = screen.getByRole('button', { name: 'Hide new password' });
    fireEvent.click(hidePasswordBtn);
    expect(newPasswordInput).toHaveAttribute('type', 'password');
  });

  it('shows error and blocks submission if password does not meet 12-char strong requirements', async () => {
    render(
      <MemoryRouter initialEntries={['/verify-email?token=valid-test-token']}>
        <VerifyEmailPage />
      </MemoryRouter>
    );

    const passwordInputs = screen.getAllByPlaceholderText('••••••••');
    const newPasswordInput = passwordInputs[0];
    const confirmPasswordInput = passwordInputs[1];
    const submitBtn = screen.getByRole('button', { name: /Complete Setup & Launch/i });

    // 1. Password under 12 characters
    fireEvent.change(newPasswordInput, { target: { value: 'Short1!' } });
    fireEvent.change(confirmPasswordInput, { target: { value: 'Short1!' } });
    fireEvent.click(submitBtn);

    expect(await screen.findByText('Password must be at least 12 characters long.')).toBeInTheDocument();
    expect(trialApi.setupPasswordAndVerify).not.toHaveBeenCalled();
  });

  it('successfully submits valid 12-char strong password and renders success view', async () => {
    vi.mocked(trialApi.setupPasswordAndVerify).mockResolvedValueOnce({
      accessToken: 'test_token',
      refreshToken: 'test_refresh_token',
      redirectUrl: 'https://acmeretail.orvio.com/orvio',
      user: {
        id: 'usr_1',
        email: 'founder@acme.com',
        fullName: 'Jane Founder',
        phone: '+2348012345678',
        status: 'active',
        emailVerifiedAt: '2026-10-01T00:00:00Z',
      },
      organization: {
        id: 'org_1',
        name: 'Acme Retail',
        subdomain: 'acmeretail',
        status: 'active',
        planCode: 'bundle',
        url: 'https://acmeretail.orvio.com',
      },
    });

    render(
      <MemoryRouter initialEntries={['/verify-email?token=valid-test-token']}>
        <VerifyEmailPage />
      </MemoryRouter>
    );

    const passwordInputs = screen.getAllByPlaceholderText('••••••••');
    fireEvent.change(passwordInputs[0], { target: { value: 'StrongPass123!#' } });
    fireEvent.change(passwordInputs[1], { target: { value: 'StrongPass123!#' } });

    const submitBtn = screen.getByRole('button', { name: /Complete Setup & Launch/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(trialApi.setupPasswordAndVerify).toHaveBeenCalledWith({
        token: 'valid-test-token',
        password: 'StrongPass123!#',
        confirmPassword: 'StrongPass123!#',
      });
    });

    expect(await screen.findByText('Setup Completed Successfully!')).toBeInTheDocument();
  });
});
