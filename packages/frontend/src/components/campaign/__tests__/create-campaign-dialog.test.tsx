import { render, screen, waitFor, fireEvent } from '@/test/test-utils';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CreateCampaignDialog } from '../create-campaign-dialog';

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

vi.mock('@/lib/hooks/use-campaigns', () => ({
  useCreateCampaign: () => ({ mutateAsync: mockMutateAsync, isPending: false }),
}));

vi.mock('@/lib/hooks/use-segments', () => ({
  useSegments: () => ({
    data: { segments: [{ id: 's1', name: 'VIP' }] },
    isLoading: false,
  }),
}));

describe('CreateCampaignDialog', () => {
  beforeEach(() => {
    mockMutateAsync.mockReset();
    mockMutateAsync.mockResolvedValue({ campaignId: 'c1', txDigest: 'abc' });
  });

  it('renders trigger button', () => {
    render(<CreateCampaignDialog />);
    expect(screen.getByRole('button', { name: /new campaign/i })).toBeInTheDocument();
  });

  it('opens dialog on click', async () => {
    const user = userEvent.setup();
    render(<CreateCampaignDialog />);
    await user.click(screen.getByRole('button', { name: /new campaign/i }));
    expect(screen.getByText('Create Campaign')).toBeInTheDocument();
  });

  it('submit disabled when required fields empty', async () => {
    const user = userEvent.setup();
    render(<CreateCampaignDialog />);
    await user.click(screen.getByRole('button', { name: /new campaign/i }));
    expect(screen.getByRole('button', { name: /create/i })).toBeDisabled();
  });

  it('calls mutateAsync with correct payload on submit', async () => {
    const user = userEvent.setup();
    render(<CreateCampaignDialog />);
    await user.click(screen.getByRole('button', { name: /new campaign/i }));

    // Fill name
    await user.type(screen.getByLabelText(/^name/i), 'Q2 Outreach');

    // Fill description
    await user.type(screen.getByLabelText(/description/i), 'Summer promo');

    // Select segment via native select mock
    const segmentSelect = screen.getByTestId('select');
    fireEvent.change(segmentSelect, { target: { value: 's1' } });

    // Submit form
    const form = screen.getByRole('button', { name: /create/i }).closest('form')!;
    fireEvent.submit(form);

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith({
        name: 'Q2 Outreach',
        description: 'Summer promo',
        segmentId: 's1',
        workflowSteps: [],
      });
    });
  });
});
