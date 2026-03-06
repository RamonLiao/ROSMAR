import { render, screen, waitFor } from '@/test/test-utils';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CreateOrganizationDialog } from '../create-organization-dialog';

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }: any) => children,
}));

const mockMutateAsync = vi.fn();

vi.mock('@/lib/hooks/use-organizations', () => ({
  useCreateOrganization: () => ({ mutateAsync: mockMutateAsync, isPending: false }),
}));

describe('CreateOrganizationDialog', () => {
  beforeEach(() => {
    mockMutateAsync.mockReset();
    mockMutateAsync.mockResolvedValue({ organizationId: 'o1', txDigest: 'abc' });
  });

  it('renders trigger button', () => {
    render(<CreateOrganizationDialog />);
    expect(screen.getByRole('button', { name: /new organization/i })).toBeInTheDocument();
  });

  it('opens dialog on click', async () => {
    const user = userEvent.setup();
    render(<CreateOrganizationDialog />);
    await user.click(screen.getByRole('button', { name: /new organization/i }));
    expect(screen.getByText('Create Organization')).toBeInTheDocument();
  });

  it('submit disabled when name empty', async () => {
    const user = userEvent.setup();
    render(<CreateOrganizationDialog />);
    await user.click(screen.getByRole('button', { name: /new organization/i }));
    expect(screen.getByRole('button', { name: /create/i })).toBeDisabled();
  });

  it('calls mutateAsync with correct payload on submit', async () => {
    const user = userEvent.setup();
    render(<CreateOrganizationDialog />);
    await user.click(screen.getByRole('button', { name: /new organization/i }));

    await user.type(screen.getByLabelText(/^name/i), 'Acme Corp');
    await user.type(screen.getByLabelText(/domain/i), 'acme.com');
    await user.type(screen.getByLabelText(/tags/i), 'enterprise, partner');

    await user.click(screen.getByRole('button', { name: /create/i }));

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith({
        name: 'Acme Corp',
        domain: 'acme.com',
        tags: ['enterprise', 'partner'],
      });
    });
  });
});
