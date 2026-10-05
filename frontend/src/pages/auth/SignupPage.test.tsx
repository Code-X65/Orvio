import { describe, expect, it, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SignupPage } from './SignupPage';

function renderSignupPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <SignupPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('SignupPage Wizard Component', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('renders Step 1 with account fields and stepper', () => {
    renderSignupPage();

    expect(screen.getByText(/Create your administrator account/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Alex Adeleke/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/alex@company.com/i)).toBeInTheDocument();
    expect(screen.getByText(/Continue to Business Details/i)).toBeInTheDocument();
  });

  it('progresses to Step 2 upon entering valid Step 1 data', async () => {
    const user = userEvent.setup({ delay: null });
    renderSignupPage();

    const nameInput = screen.getByPlaceholderText(/Alex Adeleke/i);
    const emailInput = screen.getByPlaceholderText(/alex@company.com/i);
    const passwordInput = screen.getByPlaceholderText(/••••••••/i);

    await user.type(nameInput, 'Alex Adeleke');
    await user.type(emailInput, 'alex@example.com');
    await user.type(passwordInput, 'Password123!');
    await user.click(screen.getByRole('checkbox', { name: /Terms of Service/i }));

    const nextBtn = screen.getByRole('button', { name: /Continue to Business Details/i });
    await user.click(nextBtn);

    expect(await screen.findByText(/Set up your business workspace/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Apex Global Store/i)).toBeInTheDocument();
    expect(screen.getByText(/Create Workspace/i)).toBeInTheDocument();
  });
});
