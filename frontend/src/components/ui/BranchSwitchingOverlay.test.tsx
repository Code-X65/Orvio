import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BranchSwitchingOverlay } from './BranchSwitchingOverlay';

describe('BranchSwitchingOverlay Component', () => {
  it('does not render when isVisible is false', () => {
    const { container } = render(
      <BranchSwitchingOverlay
        isVisible={false}
        fromBranchName="Lagos Store"
        toBranchName="Abuja Hub"
      />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders correctly when isVisible is true with from and to names', () => {
    render(
      <BranchSwitchingOverlay
        isVisible={true}
        fromBranchName="Lagos Store"
        toBranchName="Abuja Hub"
      />
    );

    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByText('Branch Context Switch')).toBeInTheDocument();
    expect(screen.getAllByText('Abuja Hub').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Lagos Store')).toBeInTheDocument();
    expect(
      screen.getByText(/Synchronizing isolated catalog, category trees, and stock records/i)
    ).toBeInTheDocument();
  });

  it('renders target branch title when fromBranchName is not provided', () => {
    render(
      <BranchSwitchingOverlay
        isVisible={true}
        toBranchName="Warehouse 01"
      />
    );

    expect(screen.getByText('Warehouse 01')).toBeInTheDocument();
  });
});
