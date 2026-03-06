import { render, screen } from '@/test/test-utils';
import { describe, it, expect, vi } from 'vitest';
import DashboardPage from '../page';

vi.mock('@/lib/hooks/use-dashboard-stats', () => ({
  useDashboardStats: () => ({
    data: {
      profileCount: 42,
      dealCount: 15,
      pipelineTotal: 125000,
      segmentCount: 8,
    },
    isLoading: false,
  }),
}));

vi.mock('@/lib/hooks/use-deals', () => ({
  useDeals: () => ({
    data: {
      deals: [
        {
          id: '1',
          title: 'Deal 1',
          stage: 'New',
          amountUsd: '10000',
          version: 1,
        },
      ],
    },
  }),
}));

vi.mock('@/lib/hooks/use-analytics', () => ({
  useScoreDistribution: () => ({
    data: [{ score: 80, count: 10 }],
  }),
  useActivityHeatmap: () => ({
    data: [{ date: '2024-01-01', count: 5 }],
  }),
  usePipelineSummary: () => ({
    data: [{ stage: 'New', count: 5, value: 50000 }],
  }),
}));

describe('DashboardPage', () => {
  it('renders dashboard title', () => {
    render(<DashboardPage />);
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
  });

  it('renders welcome message', () => {
    render(<DashboardPage />);
    expect(screen.getByText('Welcome to ROSMAR CRM')).toBeInTheDocument();
  });

  it('renders Total Profiles card with count', () => {
    render(<DashboardPage />);
    expect(screen.getByText('Total Profiles')).toBeInTheDocument();
    expect(screen.getByText('42')).toBeInTheDocument();
  });

  it('renders Active Deals card with count', () => {
    render(<DashboardPage />);
    expect(screen.getByText('Active Deals')).toBeInTheDocument();
    expect(screen.getByText('15')).toBeInTheDocument();
  });

  it('renders Pipeline Total card with formatted value', () => {
    render(<DashboardPage />);
    expect(screen.getByText('Pipeline Total')).toBeInTheDocument();
    expect(screen.getByText('$125K')).toBeInTheDocument();
  });

  it('renders Segments card with count', () => {
    render(<DashboardPage />);
    expect(screen.getByText('Segments')).toBeInTheDocument();
    expect(screen.getByText('8')).toBeInTheDocument();
  });

  it('renders chart tabs', () => {
    render(<DashboardPage />);
    expect(screen.getByText('Engagement')).toBeInTheDocument();
    expect(screen.getByText('Activity')).toBeInTheDocument();
    expect(screen.getByText('Pipeline')).toBeInTheDocument();
  });
});
