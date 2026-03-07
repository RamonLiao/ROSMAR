import { render, screen, fireEvent } from '@/test/test-utils';
import { describe, it, expect, vi } from 'vitest';
import { LookalikeDialog } from '../lookalike-dialog';
import { LookalikeResults } from '../lookalike-results';
import { FeatureRadarChart } from '../feature-radar-chart';

// Mock Radix Dialog — always render all children regardless of open state
vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children }: any) => <div>{children}</div>,
  DialogTrigger: ({ children, asChild }: any) => <>{children}</>,
  DialogContent: ({ children }: any) => <div>{children}</div>,
  DialogHeader: ({ children }: any) => <div>{children}</div>,
  DialogTitle: ({ children }: any) => <h2>{children}</h2>,
  DialogDescription: ({ children }: any) => <p>{children}</p>,
}));

vi.mock('@/components/ui/slider', () => ({
  Slider: ({ value, onValueChange, ...props }: any) => (
    <input
      type="range"
      value={value?.[0]}
      onChange={(e) => onValueChange?.([Number(e.target.value)])}
      data-testid={props['data-testid']}
    />
  ),
}));

// Mock recharts to avoid canvas issues in jsdom
vi.mock('recharts', () => ({
  RadarChart: ({ children }: any) => <div data-testid="radar-chart-inner">{children}</div>,
  Radar: () => <div data-testid="radar-line" />,
  PolarGrid: () => <div />,
  PolarAngleAxis: ({ dataKey }: any) => <div data-testid={`axis-${dataKey}`} />,
  PolarRadiusAxis: () => <div />,
  ResponsiveContainer: ({ children }: any) => <div>{children}</div>,
}));

describe('LookalikeDialog — T20', () => {
  it('"Find Lookalike Audience" button renders', () => {
    const onSubmit = vi.fn();
    render(<LookalikeDialog segmentId="s1" onSubmit={onSubmit} />);
    // Button + dialog title both contain text — use getByRole for the trigger button
    expect(screen.getByRole('button', { name: 'Find Lookalike Audience' })).toBeInTheDocument();
  });

  it('dialog shows loading state when isPending', () => {
    const onSubmit = vi.fn();
    render(
      <LookalikeDialog segmentId="s1" onSubmit={onSubmit} isPending={true} />,
    );
    expect(screen.getByText('Searching...')).toBeInTheDocument();
  });

  it('submit fires callback with params', () => {
    const onSubmit = vi.fn();
    render(<LookalikeDialog segmentId="s1" onSubmit={onSubmit} />);
    fireEvent.click(screen.getByText('Find Similar Profiles'));
    expect(onSubmit).toHaveBeenCalledWith({ topK: 20, minSimilarity: 0.7 });
  });
});

describe('LookalikeResults — T20', () => {
  const mockProfiles = [
    { profileId: 'p1', similarity: 0.95 },
    { profileId: 'p2', similarity: 0.82 },
  ];

  it('results show similarity score per profile', () => {
    render(
      <LookalikeResults
        profiles={mockProfiles}
        onCreateSegment={vi.fn()}
      />,
    );
    expect(screen.getByText('95.0%')).toBeInTheDocument();
    expect(screen.getByText('82.0%')).toBeInTheDocument();
  });

  it('"Create Segment from Results" button triggers callback', () => {
    const onCreateSegment = vi.fn();
    render(
      <LookalikeResults
        profiles={mockProfiles}
        onCreateSegment={onCreateSegment}
      />,
    );
    fireEvent.click(screen.getByText('Create Segment from Results'));
    expect(onCreateSegment).toHaveBeenCalledWith(['p1', 'p2']);
  });
});

describe('FeatureRadarChart — T20', () => {
  it('renders radar chart with 6 axes', () => {
    const centroid = [0.8, 0.6, 0.4, 0.7, 0.3, 0.5];
    render(<FeatureRadarChart centroid={centroid} />);
    expect(screen.getByTestId('feature-radar-chart')).toBeInTheDocument();
    expect(screen.getByTestId('radar-chart-inner')).toBeInTheDocument();
  });
});
