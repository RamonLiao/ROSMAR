import { render, screen } from '@/test/test-utils';
import { describe, it, expect, vi } from 'vitest';
import { DealCard } from '../deal-card';

vi.mock('@dnd-kit/sortable', () => ({
  useSortable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    transition: null,
    isDragging: false,
  }),
}));

vi.mock('@dnd-kit/utilities', () => ({
  CSS: { Transform: { toString: () => '' } },
}));

describe('DealCard', () => {
  const mockDeal = {
    id: '1',
    title: 'Enterprise Deal',
    value: 50000,
    stage: 'Qualified',
    profileName: 'Alice Corp',
    probability: 75,
  };

  it('renders deal title', () => {
    render(<DealCard {...mockDeal} />);
    expect(screen.getByText('Enterprise Deal')).toBeInTheDocument();
  });

  it('renders formatted value with dollar sign', () => {
    render(<DealCard {...mockDeal} />);
    expect(screen.getByText('$50,000')).toBeInTheDocument();
  });

  it('renders profile name', () => {
    render(<DealCard {...mockDeal} />);
    expect(screen.getByText('Alice Corp')).toBeInTheDocument();
  });

  it('renders probability percentage', () => {
    render(<DealCard {...mockDeal} />);
    expect(screen.getByText('75%')).toBeInTheDocument();
  });

  it('does not render value when not provided', () => {
    render(<DealCard id="1" title="No Value Deal" stage="New" />);
    expect(screen.queryByText(/\$/)).not.toBeInTheDocument();
  });

  it('does not render profile name when not provided', () => {
    render(<DealCard id="1" title="No Profile Deal" stage="New" value={1000} />);
    expect(screen.queryByText(/Alice/)).not.toBeInTheDocument();
  });
});
