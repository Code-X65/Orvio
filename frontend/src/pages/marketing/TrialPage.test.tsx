import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { TrialPage } from './TrialPage';
import { TrialThanksPage } from './TrialThanksPage';

vi.mock('../../features/trial/api', () => ({
  startFreeTrial: vi.fn().mockResolvedValue({
    accessToken: 'mock-token',
    user: { id: '1', email: 'test@fashben.com', fullName: 'Fash Ben', emailVerifiedAt: null },
    organization: { id: 'org_1', name: 'Fashben Gym', subdomain: 'fashben', status: 'active', planCode: 'trial', url: 'http://fashben.localhost:4000' },
    redirectUrl: 'http://fashben.localhost:4000/orvio',
  }),
  checkSubdomainAvailability: vi.fn().mockResolvedValue({
    available: true,
    subdomain: 'fashben',
  }),
  checkEmailAvailability: vi.fn().mockResolvedValue({
    available: true,
    email: 'test@fashben.com',
  }),
}));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe('TrialPage Component', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    sessionStorage.clear();
  });

  it('renders Choose your Apps grid, categorized apps, and sticky sidebar', () => {
    render(
      <MemoryRouter>
        <TrialPage />
      </MemoryRouter>
    );

    expect(screen.getByText(/Choose your/i)).toBeDefined();
    expect(screen.getAllByText(/Apps/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Free instant access. No credit card required./i)).toBeDefined();
    expect(screen.getAllByText(/Inventory/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Point of Sale/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Gym Management/i)).toBeDefined();
    expect(screen.getByText(/CRM/i)).toBeDefined();
    expect(screen.getByText(/Invoicing/i)).toBeDefined();
    expect(screen.getByRole('button', { name: /Continue/i })).toBeDefined();
  });

  it('allows toggling apps and saves selection when clicking Continue', () => {
    render(
      <MemoryRouter>
        <TrialPage />
      </MemoryRouter>
    );

    // Initial default: 2 apps (pos and inventory)
    expect(screen.getByText(/2 Apps Selected/i)).toBeDefined();

    // Toggle CRM app card
    const crmBtn = screen.getByRole('button', { name: /CRM/i });
    fireEvent.click(crmBtn);

    // Now 3 apps should be selected
    expect(screen.getByText(/3 Apps Selected/i)).toBeDefined();

    // Click Continue
    const continueBtn = screen.getByRole('button', { name: /Continue/i });
    fireEvent.click(continueBtn);

    // Verify sessionStorage and navigation
    const saved = JSON.parse(sessionStorage.getItem('orvio_selected_apps') || '[]');
    expect(saved).toContain('pos');
    expect(saved).toContain('inventory');
    expect(saved).toContain('crm');
    expect(mockNavigate).toHaveBeenCalledWith(expect.stringContaining('/signup?apps='));
  });
});


describe('TrialThanksPage Component', () => {
  it('renders provisioning screen with brand message and countdown', () => {
    render(
      <MemoryRouter initialEntries={['/thanks/trial?subdomain=fashben']}>
        <TrialThanksPage />
      </MemoryRouter>
    );

    expect(screen.getByText(/Workspace Provisioning/i)).toBeDefined();
    expect(screen.getByText(/fashben\.localhost:4000/i)).toBeDefined();
  });
});
