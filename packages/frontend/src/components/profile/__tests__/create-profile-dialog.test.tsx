/* eslint-disable @typescript-eslint/no-explicit-any */
import { render, screen, waitFor } from '@/test/test-utils';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CreateProfileDialog } from '../create-profile-dialog';

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }: any) => children,
}));

const mockMutateAsync = vi.fn();

vi.mock('@/lib/hooks/use-profiles', () => ({
  useCreateProfile: () => ({ mutateAsync: mockMutateAsync, isPending: false }),
}));

describe('CreateProfileDialog', () => {
  beforeEach(() => {
    mockMutateAsync.mockReset();
    mockMutateAsync.mockResolvedValue({ profileId: 'p1', txDigest: 'abc' });
  });

  it('renders trigger button', () => {
    render(<CreateProfileDialog />);
    expect(screen.getByRole('button', { name: /add profile/i })).toBeInTheDocument();
  });

  it('opens dialog on click', async () => {
    const user = userEvent.setup();
    render(<CreateProfileDialog />);
    await user.click(screen.getByRole('button', { name: /add profile/i }));
    expect(screen.getByText('Create Profile')).toBeInTheDocument();
  });

  it('submit button disabled when primaryAddress is empty', async () => {
    const user = userEvent.setup();
    render(<CreateProfileDialog />);
    await user.click(screen.getByRole('button', { name: /add profile/i }));
    expect(screen.getByRole('button', { name: /create/i })).toBeDisabled();
  });

  it('calls mutateAsync with correct payload on submit', async () => {
    const user = userEvent.setup();
    render(<CreateProfileDialog />);
    await user.click(screen.getByRole('button', { name: /add profile/i }));

    await user.type(screen.getByLabelText(/wallet address/i), '0xdeadbeef');
    await user.type(screen.getByLabelText(/suins name/i), 'alice.sui');
    await user.type(screen.getByLabelText(/tags/i), 'vip, whale');

    await user.click(screen.getByRole('button', { name: /create/i }));

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith({
        primaryAddress: '0xdeadbeef',
        suinsName: 'alice.sui',
        tags: ['vip', 'whale'],
      });
    });
  });

  it('resets form and closes dialog on success', async () => {
    const user = userEvent.setup();
    render(<CreateProfileDialog />);
    await user.click(screen.getByRole('button', { name: /add profile/i }));

    await user.type(screen.getByLabelText(/wallet address/i), '0xdeadbeef');
    await user.click(screen.getByRole('button', { name: /create/i }));

    await waitFor(() => {
      expect(screen.queryByText('Create Profile')).not.toBeInTheDocument();
    });
  });
});
