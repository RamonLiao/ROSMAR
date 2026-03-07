import { render, screen } from '@/test/test-utils';
import { describe, it, expect, vi } from 'vitest';
import BroadcastsPage from '../page';

vi.mock('@/lib/hooks/use-broadcasts', () => ({
  useCreateBroadcast: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useBroadcasts: () => ({
    data: [
      {
        id: '1',
        title: 'Product Launch',
        content: 'Hello world',
        channels: ['telegram', 'discord'],
        status: 'sent',
        sentAt: '2026-03-01T10:00:00Z',
        createdAt: '2026-03-01T09:00:00Z',
        _count: { deliveries: 5 },
      },
      {
        id: '2',
        title: 'Weekly Update',
        content: 'News this week',
        channels: ['x'],
        status: 'draft',
        sentAt: null,
        createdAt: '2026-03-02T09:00:00Z',
        _count: { deliveries: 0 },
      },
    ],
    isLoading: false,
    error: null,
  }),
}));

describe('BroadcastsPage', () => {
  it('renders page title', () => {
    render(<BroadcastsPage />);
    expect(screen.getByText('Broadcasts')).toBeInTheDocument();
  });

  it('renders page description', () => {
    render(<BroadcastsPage />);
    expect(
      screen.getByText('Create and send messages across channels')
    ).toBeInTheDocument();
  });

  it('renders New Broadcast button', () => {
    render(<BroadcastsPage />);
    expect(screen.getByText('New Broadcast')).toBeInTheDocument();
  });

  it('renders broadcast titles in table', () => {
    render(<BroadcastsPage />);
    expect(screen.getByText('Product Launch')).toBeInTheDocument();
    expect(screen.getByText('Weekly Update')).toBeInTheDocument();
  });

  it('renders table column headers', () => {
    render(<BroadcastsPage />);
    expect(screen.getByText('Title')).toBeInTheDocument();
    expect(screen.getByText('Channels')).toBeInTheDocument();
    expect(screen.getByText('Status')).toBeInTheDocument();
    expect(screen.getByText('Sent')).toBeInTheDocument();
    expect(screen.getByText('Deliveries')).toBeInTheDocument();
  });

  it('renders channel badges', () => {
    render(<BroadcastsPage />);
    expect(screen.getByText('telegram')).toBeInTheDocument();
    expect(screen.getByText('discord')).toBeInTheDocument();
    expect(screen.getByText('x')).toBeInTheDocument();
  });

  it('renders status badges', () => {
    render(<BroadcastsPage />);
    expect(screen.getByText('sent')).toBeInTheDocument();
    expect(screen.getByText('draft')).toBeInTheDocument();
  });

  it('renders View buttons for each broadcast', () => {
    render(<BroadcastsPage />);
    const viewButtons = screen.getAllByText('View');
    expect(viewButtons).toHaveLength(2);
  });
});
