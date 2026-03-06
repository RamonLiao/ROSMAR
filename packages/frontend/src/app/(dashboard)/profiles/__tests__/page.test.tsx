import { render, screen } from '@/test/test-utils';
import { describe, it, expect, vi } from 'vitest';
import ProfilesPage from '../page';

vi.mock('@/lib/hooks/use-profiles', () => ({
  useCreateProfile: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useProfiles: () => ({
    data: {
      profiles: [
        {
          id: '1',
          suinsName: 'Alice',
          primaryAddress: '0x1234567890abcdef',
          tier: 2,
          engagementScore: 85,
          createdAt: '2024-01-15T00:00:00Z',
        },
        {
          id: '2',
          suinsName: 'Bob',
          primaryAddress: '0xabcdef1234567890',
          tier: 1,
          engagementScore: 65,
          createdAt: '2024-01-20T00:00:00Z',
        },
      ],
      total: 2,
    },
    isLoading: false,
    error: null,
  }),
}));

describe('ProfilesPage', () => {
  it('renders profiles page title', () => {
    render(<ProfilesPage />);
    expect(screen.getByText('Profiles')).toBeInTheDocument();
  });

  it('renders page description', () => {
    render(<ProfilesPage />);
    expect(screen.getByText('Manage your customer profiles')).toBeInTheDocument();
  });

  it('renders Add Profile button', () => {
    render(<ProfilesPage />);
    expect(screen.getByText('Add Profile')).toBeInTheDocument();
  });

  it('renders profile names in table', () => {
    render(<ProfilesPage />);
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
  });

  it('renders table column headers', () => {
    render(<ProfilesPage />);
    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Address')).toBeInTheDocument();
    expect(screen.getByText('Tier')).toBeInTheDocument();
    expect(screen.getByText('Engagement')).toBeInTheDocument();
  });

  it('renders View buttons for each profile', () => {
    render(<ProfilesPage />);
    const viewButtons = screen.getAllByText('View');
    expect(viewButtons).toHaveLength(2);
  });
});
