import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CategoryForm, flattenCategoriesForSelection } from './CategoryForm';
import type { CategoryTreeNode } from '../categories-api';

describe('CategoryForm Component', () => {
  const mockCategories: CategoryTreeNode[] = [
    {
      id: 'cat-1',
      org_id: 'org-1',
      name: 'Beverages',
      slug: 'beverages',
      description: 'Drinks and liquids',
      parent_id: null,
      sort_order: 0,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      children: [
        {
          id: 'cat-2',
          org_id: 'org-1',
          name: 'Fruit Juices',
          slug: 'fruit-juices',
          description: null,
          parent_id: 'cat-1',
          sort_order: 0,
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          children: [],
        },
      ],
    },
    {
      id: 'cat-3',
      org_id: 'org-1',
      name: 'Snacks',
      slug: 'snacks',
      description: 'Quick bites',
      parent_id: null,
      sort_order: 1,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      children: [],
    },
  ];

  it('renders create modal, fills fields, and submits successfully', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();

    render(
      <CategoryForm
        isOpen={true}
        onClose={onClose}
        onSubmit={onSubmit}
        categories={mockCategories}
      />
    );

    expect(screen.getByRole('heading', { name: 'Create Category' })).toBeInTheDocument();

    const nameInput = screen.getByTestId('category-name-input');
    const descInput = screen.getByTestId('category-description-input');
    const parentSelect = screen.getByTestId('category-parent-select');

    fireEvent.change(nameInput, { target: { value: 'Organic Tea' } });
    fireEvent.change(descInput, { target: { value: 'Herbal infusions and organic tea' } });
    fireEvent.change(parentSelect, { target: { value: 'cat-1' } });

    const submitBtn = screen.getByTestId('category-submit-button');
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        name: 'Organic Tea',
        description: 'Herbal infusions and organic tea',
        parentId: 'cat-1',
        isActive: true,
      });
      expect(onClose).toHaveBeenCalled();
    });
  });

  it('renders edit modal pre-filled with existing category data', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();
    const editingCategory = mockCategories[0]; // Beverages

    render(
      <CategoryForm
        isOpen={true}
        onClose={onClose}
        onSubmit={onSubmit}
        editingCategory={editingCategory}
        categories={mockCategories}
      />
    );

    expect(screen.getByRole('heading', { name: 'Edit Category' })).toBeInTheDocument();
    expect(screen.getByDisplayValue('Beverages')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Drinks and liquids')).toBeInTheDocument();

    // Verify self is excluded from parent options
    const flatOptions = flattenCategoriesForSelection(mockCategories, editingCategory.id);
    const optionLabels = flatOptions.map((o) => o.label);
    expect(optionLabels).not.toContain('Beverages');
    expect(optionLabels).not.toContain('Beverages > Fruit Juices');
    expect(optionLabels).toContain('Snacks');
  });

  it('validates required name field before submission', async () => {
    const onSubmit = vi.fn();
    const onClose = vi.fn();

    render(
      <CategoryForm
        isOpen={true}
        onClose={onClose}
        onSubmit={onSubmit}
        categories={mockCategories}
      />
    );

    const submitBtn = screen.getByTestId('category-submit-button');
    fireEvent.click(submitBtn);

    expect(screen.getByText('Category name is required.')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('calls onClose when cancel button is clicked', async () => {
    const onSubmit = vi.fn();
    const onClose = vi.fn();

    render(
      <CategoryForm
        isOpen={true}
        onClose={onClose}
        onSubmit={onSubmit}
        categories={mockCategories}
      />
    );

    const cancelBtn = screen.getByTestId('category-cancel-button');
    fireEvent.click(cancelBtn);

    await waitFor(() => {
      expect(onClose).toHaveBeenCalled();
    });
  });
});
