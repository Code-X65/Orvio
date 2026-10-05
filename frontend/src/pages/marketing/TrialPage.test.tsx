import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
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

describe('TrialPage Component', () => {
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
    expect(screen.getByText(/Point of Sale/i)).toBeDefined();
    expect(screen.getByText(/Gym Management/i)).toBeDefined();
    expect(screen.getByText(/CRM/i)).toBeDefined();
    expect(screen.getByText(/Invoicing/i)).toBeDefined();
    expect(screen.getByText(/Continue/i)).toBeDefined();
  });


  it('progresses to Step 2 Organization details when clicking Continue', () => {
    render(
      <MemoryRouter>
        <TrialPage />
      </MemoryRouter>
    );

    const continueBtn = screen.getByRole('button', { name: /Continue/i });
    fireEvent.click(continueBtn);

    expect(screen.getByText(/Get/i)).toBeDefined();
    expect(screen.getByText(/Started/i)).toBeDefined();
    expect(screen.getByText(/Change apps selection/i)).toBeDefined();
    expect(screen.getByPlaceholderText(/e\.g\. Jame/i)).toBeDefined();
    expect(screen.getByPlaceholderText(/e\.g\. Bolaji/i)).toBeDefined();
    expect(screen.getByPlaceholderText(/Company Name/i)).toBeDefined();
    expect(screen.getByPlaceholderText(/you@company\.com/i)).toBeDefined();
    expect(screen.getByPlaceholderText(/907 332 5783/i)).toBeDefined();
    expect(screen.getByRole('button', { name: /Start Now/i })).toBeDefined();
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
