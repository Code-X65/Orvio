import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { InventorySetupWizard } from './components/InventorySetupWizard';
import * as inventoryApi from './api';

vi.mock('./api', () => ({
  submitInventoryBranchSetup: vi.fn().mockResolvedValue({
    success: true,
    branch: { id: 'branch-123', name: 'Main Store', code: 'HQ', type: 'store', status: 'active' },
    onboarding: { id: 'onb-1', status: 'completed', completed_at: new Date().toISOString() },
  }),
  saveInventoryOnboardingDraft: vi.fn().mockResolvedValue({ success: true }),
}));

describe('InventorySetupWizard', () => {
  const mockOrg = {
    id: 'org-1',
    name: 'Apex Supermarket',
    subdomain: 'apex',
    currency: 'NGN',
    timezone: 'Africa/Lagos',
    businessEmail: 'contact@apex.ng',
    phone: '+2348011112222',
  };

  it('renders Step 1 with business categories and navigates through all 3 steps to completion', async () => {
    const onCompleted = vi.fn();
    render(
      <InventorySetupWizard
        organization={mockOrg}
        userEmail="owner@apex.ng"
        onCompleted={onCompleted}
      />
    );

    // STEP 1: Check category selection
    expect(screen.getByText('What type of business are you running?')).toBeInTheDocument();
    expect(screen.getByText('Retail Store & Supermarket')).toBeInTheDocument();
    expect(screen.getByText('Wholesale & Bulk Distribution')).toBeInTheDocument();

    // Advance to Step 2
    const step1Next = screen.getByRole('button', { name: /Continue to Branch Identity/i });
    fireEvent.click(step1Next);

    // STEP 2: Check branch identity & code
    expect(await screen.findByText('Name your primary branch & code')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Apex Supermarket Main Branch')).toBeInTheDocument();
    expect(screen.getByDisplayValue('HQ')).toBeInTheDocument();

    // Advance to Step 3
    const step2Next = screen.getByRole('button', { name: /Continue to Location Address/i });
    fireEvent.click(step2Next);

    // STEP 3: Location Address (Country: Nigeria disabled, State, City, Street)
    expect(await screen.findByText('Where is this branch located?')).toBeInTheDocument();
    expect(screen.getByText('Nigeria')).toBeInTheDocument();

    // Fill City and Street Address
    const cityInput = screen.getByPlaceholderText(/e.g. Ikeja/i);
    fireEvent.change(cityInput, { target: { value: 'Ikeja' } });

    const streetInput = screen.getByPlaceholderText(/Plot 12 Allen Avenue/i);
    fireEvent.change(streetInput, { target: { value: '45 Marina Street, Lagos Island' } });

    // Submit setup
    const submitBtn = screen.getByRole('button', { name: /Complete Setup & Launch/i });
    fireEvent.click(submitBtn);

    // Verify submission payload
    await waitFor(() => {
      expect(inventoryApi.submitInventoryBranchSetup).toHaveBeenCalledWith(
        expect.objectContaining({
          businessType: 'retail_supermarket',
          branchName: 'Apex Supermarket Main Branch',
          branchCode: 'HQ',
          useOrgEmail: true,
          useOrgPhone: true,
          address: expect.objectContaining({
            country: 'Nigeria',
            state: 'Lagos',
            city: 'Ikeja',
            streetAddress: '45 Marina Street, Lagos Island',
          }),
        })
      );
    });

    // Check celebration & welcome modal
    expect(await screen.findByText('Welcome to Orvio Inventory!')).toBeInTheDocument();
    expect(screen.getByText(/Apex Supermarket Main Branch \(HQ\)/i)).toBeInTheDocument();

    // Click Enter Inventory Workspace
    const enterBtn = screen.getByRole('button', { name: /Enter Inventory Workspace/i });
    fireEvent.click(enterBtn);
    expect(onCompleted).toHaveBeenCalled();
  });
});
