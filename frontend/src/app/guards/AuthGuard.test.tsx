import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { AuthGuard } from './AuthGuard';
import { useAuthStore } from '../../stores/auth-store';
import { sanitizeReturnUrl, saveLastVisitedPath, getLastVisitedPath } from '../config/authUrls';

describe('AuthGuard & Continuous Parameters', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    useAuthStore.setState({
      accessToken: null,
      user: null,
      organization: null,
      status: 'anonymous',
      isHydrated: true,
    });
  });

  describe('sanitizeReturnUrl Helper', () => {
    it('allows valid registered workspace routes (/inventory, /dashboard, /orvio)', () => {
      expect(sanitizeReturnUrl('/inventory')).toBe('/inventory');
      expect(sanitizeReturnUrl('/inventory?filter=low-stock')).toBe('/inventory?filter=low-stock');
      expect(sanitizeReturnUrl('/dashboard')).toBe('/dashboard');
      expect(sanitizeReturnUrl('/orvio')).toBe('/orvio');
    });

    it('rejects external URLs and open redirects', () => {
      expect(sanitizeReturnUrl('https://malicious.com')).toBe('/orvio');
      expect(sanitizeReturnUrl('//evil.com')).toBe('/orvio');
      expect(sanitizeReturnUrl('/\\evil.com')).toBe('/orvio');
      expect(sanitizeReturnUrl('javascript:alert(1)')).toBe('/orvio');
    });

    it('rejects auth routes', () => {
      expect(sanitizeReturnUrl('/login')).toBe('/orvio');
      expect(sanitizeReturnUrl('/signup')).toBe('/orvio');
      expect(sanitizeReturnUrl('/forgot-password')).toBe('/orvio');
    });

    it('falls back when route is not an allowed workspace route', () => {
      expect(sanitizeReturnUrl('/unregistered-route')).toBe('/orvio');
    });
  });

  describe('Last Visited Path Memory', () => {
    it('saves and retrieves sanitized last visited workspace path', () => {
      saveLastVisitedPath('acme', '/inventory');
      expect(getLastVisitedPath('acme')).toBe('/inventory');
    });

    it('rejects invalid or unsafe paths when saving', () => {
      saveLastVisitedPath('acme', 'https://phishing.com');
      expect(getLastVisitedPath('acme')).toBeNull();
    });
  });

  describe('AuthGuard Redirection', () => {
    it('redirects unauthenticated user to /login preserving ?returnUrl=/inventory', () => {
      render(
        <MemoryRouter initialEntries={['/inventory']}>
          <Routes>
            <Route
              path="/inventory"
              element={
                <AuthGuard>
                  <div>Protected Inventory</div>
                </AuthGuard>
              }
            />
            <Route
              path="/login"
              element={<div>Login Page Target</div>}
            />
          </Routes>
        </MemoryRouter>
      );

      expect(screen.getByText('Login Page Target')).toBeInTheDocument();
      expect(screen.queryByText('Protected Inventory')).not.toBeInTheDocument();
    });

    it('renders protected content when authenticated', () => {
      useAuthStore.setState({
        accessToken: 'valid-jwt',
        user: { id: 'u1', email: 'test@example.com', fullName: 'Test User', status: 'active', emailVerifiedAt: new Date().toISOString() },
        organization: { id: 'org1', name: 'Acme', subdomain: 'acme', status: 'active' },
        status: 'authenticated',
        isHydrated: true,
      });

      render(
        <MemoryRouter initialEntries={['/inventory']}>
          <Routes>
            <Route
              path="/inventory"
              element={
                <AuthGuard>
                  <div>Protected Inventory Content</div>
                </AuthGuard>
              }
            />
          </Routes>
        </MemoryRouter>
      );

      expect(screen.getByText('Protected Inventory Content')).toBeInTheDocument();
    });
  });
});
