import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Select } from './select';

describe('Select Component', () => {
  const options = [
    { value: 'ngn', label: 'Nigerian Naira (NGN)' },
    { value: 'usd', label: 'US Dollar (USD)' },
    { value: 'gbp', label: 'British Pound (GBP)' },
  ];

  it('renders with label and options', () => {
    render(
      <Select
        label="Currency"
        options={options}
        defaultValue="ngn"
      />
    );

    expect(screen.getByLabelText('Currency')).toBeInTheDocument();
    expect(screen.getByRole('combobox')).toHaveValue('ngn');
    expect(screen.getAllByRole('option')).toHaveLength(3);
  });

  it('renders placeholder option when provided', () => {
    render(
      <Select
        label="Select Plan"
        placeholder="Choose a plan..."
        options={options}
        defaultValue=""
      />
    );

    expect(screen.getByText('Choose a plan...')).toBeInTheDocument();
  });

  it('displays error message when error prop is passed', () => {
    render(
      <Select
        label="Currency"
        options={options}
        error="Please select a valid currency"
      />
    );

    expect(screen.getByText('Please select a valid currency')).toBeInTheDocument();
  });

  it('handles value changes accurately', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();

    render(
      <Select
        label="Currency"
        options={options}
        onChange={handleChange}
        defaultValue="ngn"
      />
    );

    const select = screen.getByRole('combobox');
    await user.selectOptions(select, 'usd');

    expect(handleChange).toHaveBeenCalled();
    expect(select).toHaveValue('usd');
  });
});
