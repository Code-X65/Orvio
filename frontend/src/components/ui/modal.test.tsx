import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { Button } from './button';
import { Modal, ModalContent, ModalTitle, ModalTrigger } from './modal';

describe('Modal', () => {
  it('opens and closes with Escape', async () => {
    const user = userEvent.setup();
    render(<Modal><ModalTrigger asChild><Button>Open modal</Button></ModalTrigger><ModalContent><ModalTitle>Dialog title</ModalTitle></ModalContent></Modal>);
    await user.click(screen.getByRole('button', { name: 'Open modal' }));
    expect(screen.getByRole('dialog')).toHaveTextContent('Dialog title');
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
