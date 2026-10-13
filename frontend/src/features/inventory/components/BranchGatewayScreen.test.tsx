import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { BranchGatewayScreen } from './BranchGatewayScreen';

describe('BranchGatewayScreen Component', () => {
  const mockOrg = {
    id: 'org-1',
    name: 'Apex Supermarkets',
    subdomain: 'apex',
    currency: 'NGN',
  };

  const mockBranches = [
    {
      id: 'branch-1',
      name: 'Lagos Main Store',
      code: 'LOS-01',
      type: 'store',
      status: 'active' as const,
      is_primary: true,
      phone: null,
      email: null,
      address: { city: 'Victoria Island', state: 'Lagos', country: 'Nigeria' },
      total_products: 42,
      total_on_hand: 520,
      total_reserved: 10,
      created_at: '2026-01-01',
      updated_at: '2026-01-01',
    },
    {
      id: 'branch-2',
      name: 'Abuja Distribution Hub',
      code: 'ABJ-01',
      type: 'warehouse',
      status: 'active' as const,
      is_primary: false,
      phone: null,
      email: null,
      address: { city: 'Garki', state: 'FCT - Abuja', country: 'Nigeria' },
      total_products: 30,
      total_on_hand: 1200,
      total_reserved: 0,
      created_at: '2026-01-01',
      updated_at: '2026-01-01',
    },
  ];

  it('renders all branches and handles selection', () => {
    const onSelectBranch = vi.fn();
    const onOpenAddBranch = vi.fn();

    render(
      <MemoryRouter>
        <BranchGatewayScreen
          organization={mockOrg}
          branches={mockBranches}
          onSelectBranch={onSelectBranch}
          onOpenAddBranch={onOpenAddBranch}
        />
      </MemoryRouter>
    );

    expect(screen.getByText('Select Your Branch Workspace')).toBeInTheDocument();
    expect(screen.getByText('Lagos Main Store')).toBeInTheDocument();
    expect(screen.getByText('Abuja Distribution Hub')).toBeInTheDocument();
    expect(screen.getByText('Primary')).toBeInTheDocument();

    // Select Lagos Store
    fireEvent.click(screen.getByText('Lagos Main Store'));
    expect(onSelectBranch).toHaveBeenCalledWith('branch-1');

    // Click Add Branch
    fireEvent.click(screen.getByRole('button', { name: /Add Branch/i }));
    expect(onOpenAddBranch).toHaveBeenCalled();
  });

  it('filters branches by search query', () => {
    const onSelectBranch = vi.fn();
    const onOpenAddBranch = vi.fn();

    render(
      <MemoryRouter>
        <BranchGatewayScreen
          organization={mockOrg}
          branches={mockBranches}
          onSelectBranch={onSelectBranch}
          onOpenAddBranch={onOpenAddBranch}
        />
      </MemoryRouter>
    );

    const searchInput = screen.getByPlaceholderText(/Search branches by name, code, or type/i);
    fireEvent.change(searchInput, { target: { value: 'Abuja' } });

    expect(screen.getByText('Abuja Distribution Hub')).toBeInTheDocument();
    expect(screen.queryByText('Lagos Main Store')).not.toBeInTheDocument();
  });
});
