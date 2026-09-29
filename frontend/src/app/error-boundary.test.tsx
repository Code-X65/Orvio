import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AppErrorBoundary } from './error-boundary';

function BrokenComponent({ broken }: { broken: boolean }) {
  if (broken) throw new Error('Expected test failure');
  return <p>Recovered</p>;
}

describe('AppErrorBoundary', () => {
  const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  afterEach(() => consoleError.mockClear());

  it('shows a recovery action after a rendering failure', async () => {
    const user = userEvent.setup();
    const view = render(<AppErrorBoundary><BrokenComponent broken /></AppErrorBoundary>);
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    view.rerender(<AppErrorBoundary><BrokenComponent broken={false} /></AppErrorBoundary>);
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(screen.getByText('Recovered')).toBeInTheDocument();
  });
});
