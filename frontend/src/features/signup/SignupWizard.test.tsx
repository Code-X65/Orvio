import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SignupWizard } from './SignupWizard';

vi.mock('../../lib/api/auth', () => ({
  register: vi.fn(),
  checkSubdomain: vi.fn(),
  resendVerification: vi.fn(),
}));

function renderWizard(initialRoute = '/signup') {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialRoute]}>
        <SignupWizard />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('SignupWizard Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
  });

  it('renders Step 1 with account fields and stepper header', () => {
    renderWizard();

    expect(screen.getByText('Create your administrator account')).toBeInTheDocument();
    expect(screen.getByLabelText(/Full Name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Work Email/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/••••••••/i)).toBeInTheDocument();
    expect(screen.getByText('Continue to Business Details')).toBeInTheDocument();
  });

  it('progresses to Step 2 upon entering valid Step 1 data and supports navigation back', async () => {
    const user = userEvent.setup({ delay: null });
    renderWizard();

    await user.type(screen.getByLabelText(/Full Name/i), 'Alex Adeleke');
    await user.type(screen.getByLabelText(/Work Email/i), 'alex@company.com');
    await user.type(screen.getByPlaceholderText(/••••••••/i), 'Password123!');
    await user.click(screen.getByRole('checkbox', { name: /Terms of Service/i }));

    await user.click(screen.getByText('Continue to Business Details'));

    await waitFor(() => {
      expect(screen.getByText('Set up your business workspace')).toBeInTheDocument();
    });

    expect(screen.getByLabelText(/Business \/ Organization Name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Tenant Subdomain/i)).toBeInTheDocument();

    // Click Back to return to Step 1
    await user.click(screen.getByText('Back'));

    await waitFor(() => {
      expect(screen.getByText('Create your administrator account')).toBeInTheDocument();
      expect(screen.getByLabelText(/Full Name/i)).toHaveValue('Alex Adeleke');
    });
  });

  it('submits valid registration and renders Step 3 Confirmation', async () => {
    const { register, checkSubdomain } = await import('../../lib/api/auth');
    vi.mocked(checkSubdomain).mockResolvedValue({
      available: true,
      subdomain: 'adelekestore',
    });
    vi.mocked(register).mockResolvedValue({
      userId: 'usr_new_1',
      email: 'alex@company.com',
      fullName: 'Alex Adeleke',
      accessToken: 'jwt_mock_token',
      organization: {
        id: 'org_new_1',
        name: 'Adeleke Store',
        subdomain: 'adelekestore',
        status: 'pending',
      },
    });

    const user = userEvent.setup({ delay: null });
    renderWizard();

    // Step 1
    await user.type(screen.getByLabelText(/Full Name/i), 'Alex Adeleke');
    await user.type(screen.getByLabelText(/Work Email/i), 'alex@company.com');
    await user.type(screen.getByPlaceholderText(/••••••••/i), 'Password123!');
    await user.click(screen.getByRole('checkbox', { name: /Terms of Service/i }));
    await user.click(screen.getByText('Continue to Business Details'));

    // Step 2
    await waitFor(() => {
      expect(screen.getByText('Set up your business workspace')).toBeInTheDocument();
    });

    await user.type(screen.getByLabelText(/Business \/ Organization Name/i), 'Adeleke Store');

    // Wait for debounced availability check to resolve
    await waitFor(
      () => {
        expect(screen.getByText(/is available!/i)).toBeInTheDocument();
      },
      { timeout: 4000 }
    );

    const submitBtn = screen.getByRole('button', { name: /Create Workspace/i });
    await user.click(submitBtn);

    // Step 3
    await waitFor(
      () => {
        expect(screen.getByText('Verify your email address')).toBeInTheDocument();
        expect(screen.getByText(/alex@company.com/)).toBeInTheDocument();
        expect(screen.getByText(/adelekestore/i)).toBeInTheDocument();
      },
      { timeout: 4000 }
    );
  }, 25000);
});
