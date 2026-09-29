import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { Button } from './button';

describe('Button', () => {
  it('supports keyboard activation and disabled state', async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    render(<><Button onClick={onClick}>Save</Button><Button disabled>Disabled</Button></>);

    await user.tab();
    await user.keyboard('{Enter}');

    expect(onClick).toHaveBeenCalledOnce();
    expect(screen.getByRole('button', { name: 'Disabled' })).toBeDisabled();
  });
});
