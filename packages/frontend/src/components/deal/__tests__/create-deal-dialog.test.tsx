import { render, screen, waitFor, fireEvent } from '@/test/test-utils';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CreateDealDialog } from '../create-deal-dialog';

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }: any) => children,
}));

// Mock Radix Select with native <select> to avoid jsdom pointer-capture issues
vi.mock('@/components/ui/select', () => ({
  Select: ({ children, value, onValueChange }: any) => (
    <select
      value={value}
      onChange={(e) => onValueChange?.(e.target.value)}
      data-testid="select"
    >
      {children}
    </select>
  ),
  SelectTrigger: ({ children }: any) => <>{children}</>,
  SelectValue: ({ placeholder }: any) => <option value="">{placeholder}</option>,
  SelectContent: ({ children }: any) => <>{children}</>,
  SelectItem: ({ value, children }: any) => <option value={value}>{children}</option>,
}));

const mockMutateAsync = vi.fn();

vi.mock('@/lib/hooks/use-deals', () => ({
  useCreateDeal: () => ({ mutateAsync: mockMutateAsync, isPending: false }),
}));

vi.mock('@/lib/hooks/use-profiles', () => ({
  useProfiles: () => ({
    data: { profiles: [{ id: 'p1', primaryAddress: '0xabcdefghij', suinsName: null }] },
    isLoading: false,
  }),
}));

describe('CreateDealDialog', () => {
  beforeEach(() => {
    mockMutateAsync.mockReset();
    mockMutateAsync.mockResolvedValue({ dealId: 'd1', txDigest: 'abc' });
  });

  it('renders trigger button', () => {
    render(<CreateDealDialog />);
    expect(screen.getByRole('button', { name: /new deal/i })).toBeInTheDocument();
  });

  it('opens dialog on click', async () => {
    const user = userEvent.setup();
    render(<CreateDealDialog />);
    await user.click(screen.getByRole('button', { name: /new deal/i }));
    expect(screen.getByText('Create Deal')).toBeInTheDocument();
  });

  it('submit disabled when required fields empty', async () => {
    const user = userEvent.setup();
    render(<CreateDealDialog />);
    await user.click(screen.getByRole('button', { name: /new deal/i }));
    expect(screen.getByRole('button', { name: /create/i })).toBeDisabled();
  });

  it('shows profile options in select dropdown', async () => {
    const user = userEvent.setup();
    render(<CreateDealDialog />);
    await user.click(screen.getByRole('button', { name: /new deal/i }));

    // With native select mock, options are rendered as <option> elements
    expect(screen.getByText(/0xabcdefg/)).toBeInTheDocument();
  });

  it('calls mutateAsync with correct payload on submit', async () => {
    const user = userEvent.setup();
    render(<CreateDealDialog />);
    await user.click(screen.getByRole('button', { name: /new deal/i }));

    // Select profile via native select
    const selects = screen.getAllByTestId('select');
    fireEvent.change(selects[0], { target: { value: 'p1' } });

    // Fill title
    await user.type(screen.getByLabelText(/title/i), 'Enterprise Q2');

    // Fill amount
    await user.type(screen.getByLabelText(/amount usd/i), '50000');

    // Submit form
    const form = screen.getByRole('button', { name: /create/i }).closest('form')!;
    fireEvent.submit(form);

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          profileId: 'p1',
          title: 'Enterprise Q2',
          amountUsd: 50000,
          stage: 'prospecting',
        })
      );
    });
  });
});
