import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AccessRevocationModal } from './AccessRevocationModal';

describe('AccessRevocationModal', () => {
  it('renders nothing when isOpen is false', () => {
    const { container } = render(
      <AccessRevocationModal
        isOpen={false}
        type="organization"
        onProceed={vi.fn()}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders organization revocation variant with sign out button and triggers callback', () => {
    const handleProceed = vi.fn();
    render(
      <AccessRevocationModal
        isOpen={true}
        type="organization"
        organizationName="Acme Corp"
        onProceed={handleProceed}
      />
    );

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Organization Access Revoked')).toBeInTheDocument();
    expect(screen.getByText(/Your staff access to/i)).toBeInTheDocument();
    expect(screen.getByText('Acme Corp')).toBeInTheDocument();
    expect(screen.getByText(/Your personal account remains intact/i)).toBeInTheDocument();

    const signOutBtn = screen.getByRole('button', { name: /Sign Out of Organization/i });
    expect(signOutBtn).toBeInTheDocument();

    fireEvent.click(signOutBtn);
    expect(handleProceed).toHaveBeenCalledTimes(1);
  });

  it('renders branch revocation variant with remaining branch redirection and triggers callback', () => {
    const handleProceed = vi.fn();
    render(
      <AccessRevocationModal
        isOpen={true}
        type="branch"
        branchName="Lekki Branch"
        remainingBranchName="HQ Central"
        onProceed={handleProceed}
      />
    );

    expect(screen.getByText('Branch Access Revoked')).toBeInTheDocument();
    expect(screen.getByText('Lekki Branch')).toBeInTheDocument();
    expect(screen.getByText(/redirected to your assigned branch \(HQ Central\)/i)).toBeInTheDocument();

    const proceedBtn = screen.getByRole('button', { name: /Continue to HQ Central/i });
    expect(proceedBtn).toBeInTheDocument();

    fireEvent.click(proceedBtn);
    expect(handleProceed).toHaveBeenCalledTimes(1);
  });

  it('renders branch revocation fallback to launchpad when no remaining branch exists', () => {
    const handleProceed = vi.fn();
    render(
      <AccessRevocationModal
        isOpen={true}
        type="branch"
        branchName="Warehouse Alpha"
        onProceed={handleProceed}
      />
    );

    expect(screen.getByText(/redirected to the main launchpad/i)).toBeInTheDocument();
    const proceedBtn = screen.getByRole('button', { name: /Return to Launchpad/i });
    expect(proceedBtn).toBeInTheDocument();

    fireEvent.click(proceedBtn);
    expect(handleProceed).toHaveBeenCalledTimes(1);
  });
});
