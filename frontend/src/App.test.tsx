import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { App } from './App';

describe('Marketing Website App', () => {
  it('renders the Orvio Hub marketing site headline and brand', () => {
    render(<App />);
    expect(screen.getAllByText(/Multiple Apps\./i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Total Control\./i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Orvio/i).length).toBeGreaterThan(0);
  });
});
