import { render, screen } from '@/test/test-utils';
import { describe, it, expect, vi } from 'vitest';
import CampaignsPage from '../page';

vi.mock('@/lib/hooks/use-segments', () => ({
  useSegments: () => ({ data: [], isLoading: false }),
}));

vi.mock('@/lib/hooks/use-campaigns', () => ({
  useCreateCampaign: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useCampaigns: () => ({
    data: {
      campaigns: [
        {
          id: '1',
          name: 'Winter Campaign',
          status: 'active',
          segment: { name: 'VIP Users' },
          createdAt: '2024-01-10T00:00:00Z',
        },
        {
          id: '2',
          name: 'Spring Launch',
          status: 'draft',
          segment: null,
          createdAt: '2024-02-01T00:00:00Z',
        },
      ],
    },
    isLoading: false,
    error: null,
  }),
}));

describe('CampaignsPage', () => {
  it('renders campaigns page title', () => {
    render(<CampaignsPage />);
    expect(screen.getByText('Campaigns')).toBeInTheDocument();
  });

  it('renders page description', () => {
    render(<CampaignsPage />);
    expect(
      screen.getByText('Create and manage marketing campaigns')
    ).toBeInTheDocument();
  });

  it('renders New Campaign button', () => {
    render(<CampaignsPage />);
    expect(screen.getByText('New Campaign')).toBeInTheDocument();
  });

  it('renders campaign names in table', () => {
    render(<CampaignsPage />);
    expect(screen.getByText('Winter Campaign')).toBeInTheDocument();
    expect(screen.getByText('Spring Launch')).toBeInTheDocument();
  });

  it('renders table column headers', () => {
    render(<CampaignsPage />);
    expect(screen.getByText('Campaign')).toBeInTheDocument();
    expect(screen.getByText('Status')).toBeInTheDocument();
    expect(screen.getByText('Segment')).toBeInTheDocument();
    expect(screen.getByText('Created')).toBeInTheDocument();
  });

  it('renders campaign statuses', () => {
    render(<CampaignsPage />);
    expect(screen.getByText('active')).toBeInTheDocument();
    expect(screen.getByText('draft')).toBeInTheDocument();
  });

  it('renders View buttons for each campaign', () => {
    render(<CampaignsPage />);
    const viewButtons = screen.getAllByText('View');
    expect(viewButtons).toHaveLength(2);
  });
});
