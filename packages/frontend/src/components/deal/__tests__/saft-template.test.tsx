import { render, screen, fireEvent, waitFor } from '@/test/test-utils';
import { describe, it, expect, vi } from 'vitest';
import { SaftTemplatePicker } from '../saft-template-picker';
import { SaftTermsForm } from '../saft-terms-form';
import type { SaftTemplate } from '@/lib/hooks/use-escrow';

const mockTemplates: SaftTemplate[] = [
  {
    id: 't1',
    name: 'Standard SAFT',
    tokenSymbol: 'ABC',
    totalTokens: 100000,
    pricePerToken: 0.5,
    cliffMonths: 6,
    vestingMonths: 24,
    jurisdiction: 'Cayman Islands',
  },
  {
    id: 't2',
    name: 'Seed Round',
    tokenSymbol: 'XYZ',
    totalTokens: 500000,
    pricePerToken: 0.1,
    cliffMonths: 12,
    vestingMonths: 36,
    jurisdiction: 'BVI',
  },
];

describe('SaftTemplatePicker', () => {
  it('renders list of templates', () => {
    render(
      <SaftTemplatePicker
        templates={mockTemplates}
        onSelect={vi.fn()}
        onCreate={vi.fn()}
      />
    );
    expect(screen.getByText('Standard SAFT')).toBeInTheDocument();
    expect(screen.getByText('Seed Round')).toBeInTheDocument();
  });

  it('selecting a template calls onSelect', () => {
    const onSelect = vi.fn();
    render(
      <SaftTemplatePicker
        templates={mockTemplates}
        onSelect={onSelect}
        onCreate={vi.fn()}
      />
    );
    fireEvent.click(screen.getByText('Standard SAFT'));
    expect(onSelect).toHaveBeenCalledWith(mockTemplates[0]);
  });
});

describe('SaftTermsForm', () => {
  it('validates required fields on submit', async () => {
    const onSubmit = vi.fn();
    render(<SaftTermsForm onSubmit={onSubmit} />);

    fireEvent.click(screen.getByRole('button', { name: /save saft terms/i }));

    await waitFor(() => {
      expect(screen.getByText(/token symbol is required/i)).toBeInTheDocument();
    });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('submits correct payload with valid data', async () => {
    const onSubmit = vi.fn();
    render(
      <SaftTermsForm
        initialValues={{
          tokenSymbol: 'ABC',
          totalTokens: 100000,
          pricePerToken: 0.5,
          cliffMonths: 6,
          vestingMonths: 24,
          jurisdiction: 'Cayman Islands',
        }}
        onSubmit={onSubmit}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /save saft terms/i }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(
        {
          tokenSymbol: 'ABC',
          totalTokens: 100000,
          pricePerToken: 0.5,
          cliffMonths: 6,
          vestingMonths: 24,
          jurisdiction: 'Cayman Islands',
        },
        expect.anything()
      );
    });
  });
});
