import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { AppProviders } from './providers';
import { AppRoutes } from './routes';
import { calculatePasswordStrength } from '../lib/password';

describe('AppRoutes', () => {
  it('redirects protected routes to the reserved login route', () => {
    render(
      <AppProviders>
        <MemoryRouter initialEntries={['/dashboard']}>
          <AppRoutes />
        </MemoryRouter>
      </AppProviders>,
    );
    expect(screen.getByText('Welcome back')).toBeInTheDocument();
  });

  it('renders registration form with password strength and optional phone input', () => {
    render(
      <AppProviders>
        <MemoryRouter initialEntries={['/register']}>
          <AppRoutes />
        </MemoryRouter>
      </AppProviders>,
    );
    expect(screen.getByText('Create your account')).toBeInTheDocument();
    expect(screen.getByLabelText(/First name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Last name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Work email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Mobile number/i)).toBeInTheDocument();
    expect(screen.getByText(/Send me product updates and security advisories/i)).toBeInTheDocument();
  });

  it('renders a recovery path for unknown routes', () => {
    render(
      <AppProviders>
        <MemoryRouter initialEntries={['/missing']}>
          <AppRoutes />
        </MemoryRouter>
      </AppProviders>,
    );
    expect(screen.getByText('Page not found')).toBeInTheDocument();
  });

  it('renders email verification page with resend action', () => {
    render(
      <AppProviders>
        <MemoryRouter initialEntries={['/verify-email?email=test%40example.com']}>
          <AppRoutes />
        </MemoryRouter>
      </AppProviders>,
    );
    expect(screen.getByText('Verify your email')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Resend verification email/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/Email address/i)).toHaveValue('test@example.com');
  });

  it('renders clear error message when verification link is expired or invalid', () => {
    render(
      <AppProviders>
        <MemoryRouter initialEntries={['/verify-email?error=invalid_or_expired']}>
          <AppRoutes />
        </MemoryRouter>
      </AppProviders>,
    );
    expect(screen.getByText(/This verification link is invalid or has expired/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Resend verification email/i })).toBeInTheDocument();
  });

  it('renders password reset request page', () => {
    render(
      <AppProviders>
        <MemoryRouter initialEntries={['/reset-password']}>
          <AppRoutes />
        </MemoryRouter>
      </AppProviders>,
    );
    expect(screen.getByText('Reset your password')).toBeInTheDocument();
    expect(screen.getByLabelText(/Email address/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Send reset link/i })).toBeInTheDocument();
  });

  it('renders password reset confirmation page with strength indicator', () => {
    render(
      <AppProviders>
        <MemoryRouter initialEntries={['/reset-password/confirm?token=sample-token']}>
          <AppRoutes />
        </MemoryRouter>
      </AppProviders>,
    );
    expect(screen.getByText('Choose a new password')).toBeInTheDocument();
    expect(screen.getByLabelText(/^New password/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Confirm password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Update password/i })).toBeInTheDocument();
  });
});
describe('calculatePasswordStrength', () => {
  it('correctly scores password criteria', () => {
    const weak = calculatePasswordStrength('short');
    expect(weak.score).toBeLessThanOrEqual(1);

    const strong = calculatePasswordStrength('SecureP@ssw0rd!2026');
    expect(strong.score).toBe(4);
    expect(strong.hasMinLength).toBe(true);
    expect(strong.hasMixedCase).toBe(true);
    expect(strong.hasNumber).toBe(true);
    expect(strong.hasSpecial).toBe(true);
    expect(strong.label).toBe('Strong');
  });
});
