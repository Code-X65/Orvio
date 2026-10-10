import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ProductForm } from './ProductForm';
import type { CategoryTreeNode } from '../categories-api';

describe('ProductForm Component', () => {
  const mockCategories: CategoryTreeNode[] = [
    {
      id: 'cat-1',
      org_id: 'org-1',
      name: 'Beverages',
      slug: 'beverages',
      description: null,
      parent_id: null,
      sort_order: 0,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      children: [],
    },
  ];

  it('renders form inputs and generates SKU/barcode helpers', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();

    render(
      <ProductForm
        isOpen={true}
        onClose={onClose}
        onSubmit={onSubmit}
        categories={mockCategories}
        currency="NGN"
      />
    );

    // Check title
    expect(screen.getByText('Add New Product')).toBeInTheDocument();

    // Type name
    const nameInput = screen.getByPlaceholderText(/Golden Penny Spaghetti/i);
    fireEvent.change(nameInput, { target: { value: 'Fresh Whole Milk' } });

    // Click Auto SKU button
    const autoSkuBtn = screen.getByTitle('Auto-generate from product name');
    fireEvent.click(autoSkuBtn);

    const skuInput = screen.getByPlaceholderText(/Auto-generated if empty/i) as HTMLInputElement;
    expect(skuInput.value).toMatch(/^FWM-\d{3}$/);

    // Click Gen Barcode button
    const genBarcodeBtn = screen.getByTitle('Generate random barcode');
    fireEvent.click(genBarcodeBtn);

    const barcodeInput = screen.getByPlaceholderText(/Optional barcode/i) as HTMLInputElement;
    expect(barcodeInput.value).toMatch(/^20\d{10,12}$/);
  });

  it('auto-formats price inputs with commas as user types', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();

    render(
      <ProductForm
        isOpen={true}
        onClose={onClose}
        onSubmit={onSubmit}
        categories={mockCategories}
        currency="NGN"
      />
    );

    const [costInput, sellingInput] = screen.getAllByPlaceholderText('0.00') as HTMLInputElement[];

    // Type 15000 into cost
    fireEvent.change(costInput, { target: { value: '15000' } });
    expect(costInput.value).toBe('15,000');

    // Type 2500000.5 into selling
    fireEvent.change(sellingInput, { target: { value: '2500000.5' } });
    expect(sellingInput.value).toBe('2,500,000.5');
  });

  it('enforces mandatory category selection', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();

    render(
      <ProductForm
        isOpen={true}
        onClose={onClose}
        onSubmit={onSubmit}
        categories={mockCategories}
        currency="NGN"
      />
    );

    const nameInput = screen.getByPlaceholderText(/Golden Penny Spaghetti/i);
    fireEvent.change(nameInput, { target: { value: 'Mineral Water' } });

    const [costInput, sellingInput] = screen.getAllByPlaceholderText('0.00');
    fireEvent.change(costInput, { target: { value: '100' } });
    fireEvent.change(sellingInput, { target: { value: '200' } });

    // Submit without selecting category
    const submitBtn = screen.getByRole('button', { name: /Create Product/i });
    fireEvent.click(submitBtn);

    // Error message should appear
    expect(screen.getByText(/Category or subcategory is mandatory/i)).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('submits valid payload when category and prices are filled', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();

    render(
      <ProductForm
        isOpen={true}
        onClose={onClose}
        onSubmit={onSubmit}
        categories={mockCategories}
        currency="NGN"
      />
    );

    // Fill fields
    const nameInput = screen.getByPlaceholderText(/Golden Penny Spaghetti/i);
    fireEvent.change(nameInput, { target: { value: 'Crispy Salted Crackers' } });

    // Select category (mandatory)
    const categorySelect = screen.getAllByRole('combobox')[0];
    fireEvent.change(categorySelect, { target: { value: 'cat-1' } });

    const [costInput, sellingInput] = screen.getAllByPlaceholderText('0.00');
    fireEvent.change(costInput, { target: { value: '1,250' } });
    fireEvent.change(sellingInput, { target: { value: '2,500' } });

    // Submit
    const submitBtn = screen.getByRole('button', { name: /Create Product/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1);
    });

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Crispy Salted Crackers',
        categoryId: 'cat-1',
        costPrice: 1250,
        sellingPrice: 2500,
        unitOfMeasure: 'pcs',
        trackQuantity: true,
      })
    );
  });
});
