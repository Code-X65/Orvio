import { describe, expect, it, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LoginPage } from './LoginPage';

function renderLoginPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('LoginPage Component', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('renders Central Organization Subdomain discovery lookup on root domain', () => {
    renderLoginPage();

    expect(screen.getByText(/Sign In to Your Workspace/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Organization Subdomain/i).length).toBeGreaterThan(0);
    expect(screen.getByPlaceholderText(/your-company/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Continue to Workspace/i })).toBeInTheDocument();
  });

  it('shows error when entered organization does not exist', async () => {
    renderLoginPage();

    const input = screen.getByPlaceholderText(/your-company/i);
    fireEvent.change(input, { target: { value: 'unknownbrand' } });

    const submitBtn = screen.getByRole('button', { name: /Continue to Workspace/i });
    fireEvent.submit(submitBtn.closest('form')!);

    await waitFor(() => {
      expect(screen.getByText(/No organization workspace found for "unknownbrand"/i)).toBeInTheDocument();
    }, { timeout: 4000 });
  });

  it('renders dedicated tenant email and password form when on tenant subdomain', () => {
    // Mock hostname to tenant subdomain
    const originalLocation = window.location;
    delete (window as any).location;
    (window as any).location = {
      href: 'http://fashben.localhost:4000/login',
      hostname: 'fashben.localhost',
      port: '4000',
      protocol: 'http:',
      search: '',
      pathname: '/login',
    };

    renderLoginPage();

    expect(screen.getByText(/Sign In to fashben/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/admin@company.com/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/••••••••/i)).toBeInTheDocument();
    expect(screen.getByText(/Email me a sign-in setup link/i)).toBeInTheDocument();

    (window as any).location = originalLocation;
  });
});
