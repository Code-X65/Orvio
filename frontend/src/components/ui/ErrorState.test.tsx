import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ErrorState } from './ErrorState';
import { ApiError } from '../../lib/api/client';

describe('ErrorState Component', () => {
  it('renders user-friendly database unavailable error state', () => {
    const error = new ApiError('Database service is temporarily unavailable. Please try again shortly.', {
      code: 'DATABASE_UNAVAILABLE',
      status: 503,
      requestId: 'req-db-999',
    });

    render(
      <MemoryRouter>
        <ErrorState error={error} title="Unable to Load Inventory" onRetry={vi.fn()} />
      </MemoryRouter>
    );

    expect(screen.getByText('Unable to Load Inventory')).toBeInTheDocument();
    expect(screen.getByText('Database service is temporarily unavailable. Please try again shortly.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
    expect(screen.getByText('Return to Launchpad')).toBeInTheDocument();
  });

  it('triggers onRetry callback when Retry button is clicked', () => {
    const onRetry = vi.fn();
    render(
      <MemoryRouter>
        <ErrorState title="Error" description="Something failed" onRetry={onRetry} />
      </MemoryRouter>
    );

    const retryBtn = screen.getByRole('button', { name: /retry/i });
    fireEvent.click(retryBtn);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('reveals technical details accordion when toggled', () => {
    const error = new ApiError('Custom error message', {
      code: 'DATABASE_UNAVAILABLE',
      status: 503,
      requestId: 'req-test-uuid',
    });

    render(
      <MemoryRouter>
        <ErrorState error={error} />
      </MemoryRouter>
    );

    // Accordion starts closed
    expect(screen.queryByText('req-test-uuid')).not.toBeInTheDocument();

    // Click toggle
    const toggleBtn = screen.getByRole('button', { name: /technical details/i });
    fireEvent.click(toggleBtn);

    // Diagnostics visible
    expect(screen.getByText('req-test-uuid')).toBeInTheDocument();
    expect(screen.getByText('503')).toBeInTheDocument();
    expect(screen.getByText('DATABASE_UNAVAILABLE')).toBeInTheDocument();
  });
});
