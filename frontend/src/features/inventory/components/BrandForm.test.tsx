import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrandForm } from './BrandForm';
import { brandApi } from '../brands-api';

vi.mock('../brands-api', () => ({
  brandApi: {
    createBrand: vi.fn(),
    updateBrand: vi.fn(),
  },
}));

describe('BrandForm (Slide-over Drawer)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders as a right-side slide-over drawer when open', async () => {
    render(
      <BrandForm
        isOpen={true}
        onClose={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('brand-form-drawer')).toBeInTheDocument();
      expect(screen.getByText('Add New Brand')).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/Nike, Apple, Sony/i)).toBeInTheDocument();
    });
  });

  it('auto-generates slug from brand name', async () => {
    render(
      <BrandForm
        isOpen={true}
        onClose={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('brand-form-drawer')).toBeInTheDocument();
    });

    const nameInput = screen.getByPlaceholderText(/Nike, Apple, Sony/i);
    fireEvent.change(nameInput, { target: { value: 'Acme Premium Coffee' } });

    const slugInput = screen.getByPlaceholderText('auto-generated-from-name');
    expect(slugInput).toHaveValue('acme-premium-coffee');
  });

  it('submits new brand and calls onSuccess and onClose', async () => {
    const handleSuccess = vi.fn();
    const handleClose = vi.fn();

    vi.mocked(brandApi.createBrand).mockResolvedValue({
      brand: {
        id: 'brand-101',
        org_id: 'org-1',
        name: 'Zara Home',
        slug: 'zara-home',
        is_active: true,
        is_deleted: false,
        sort_order: 0,
        description: null,
        logo_url: null,
        website_url: null,
        product_count: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    });

    render(
      <BrandForm
        isOpen={true}
        onClose={handleClose}
        onSuccess={handleSuccess}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('brand-form-drawer')).toBeInTheDocument();
    });

    const nameInput = screen.getByPlaceholderText(/Nike, Apple, Sony/i);
    fireEvent.change(nameInput, { target: { value: 'Zara Home' } });

    const submitBtn = screen.getByRole('button', { name: /Create Brand/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(brandApi.createBrand).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Zara Home',
          slug: 'zara-home',
        })
      );
      expect(handleSuccess).toHaveBeenCalled();
    });

    await waitFor(
      () => {
        expect(handleClose).toHaveBeenCalled();
      },
      { timeout: 500 }
    );
  });

  it('closes drawer when close button is clicked', async () => {
    const handleClose = vi.fn();

    render(
      <BrandForm
        isOpen={true}
        onClose={handleClose}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('brand-drawer-close')).toBeInTheDocument();
    });

    const closeBtn = screen.getByTestId('brand-drawer-close');
    fireEvent.click(closeBtn);

    await waitFor(
      () => {
        expect(handleClose).toHaveBeenCalled();
      },
      { timeout: 500 }
    );
  });
});
