import { render, screen } from '@/test/test-utils';
import { describe, it, expect } from 'vitest';
import { EngagementBadge } from '../engagement-badge';

describe('EngagementBadge', () => {
  it('renders score value', () => {
    render(<EngagementBadge score={85} />);
    expect(screen.getByText('85')).toBeInTheDocument();
  });

  it('applies green color for high score (>= 80)', () => {
    const { container } = render(<EngagementBadge score={85} />);
    const badge = container.querySelector('.bg-green-500');
    expect(badge).toBeInTheDocument();
  });

  it('applies blue color for good score (60-79)', () => {
    const { container } = render(<EngagementBadge score={65} />);
    const badge = container.querySelector('.bg-blue-500');
    expect(badge).toBeInTheDocument();
  });

  it('applies yellow color for medium score (40-59)', () => {
    const { container } = render(<EngagementBadge score={45} />);
    const badge = container.querySelector('.bg-yellow-500');
    expect(badge).toBeInTheDocument();
  });

  it('applies orange color for low score (20-39)', () => {
    const { container } = render(<EngagementBadge score={25} />);
    const badge = container.querySelector('.bg-orange-500');
    expect(badge).toBeInTheDocument();
  });

  it('applies red color for very low score (< 20)', () => {
    const { container } = render(<EngagementBadge score={10} />);
    const badge = container.querySelector('.bg-red-500');
    expect(badge).toBeInTheDocument();
  });

  it('does not render trend icon when trend not provided', () => {
    const { container } = render(<EngagementBadge score={75} />);
    const icon = container.querySelector('svg');
    expect(icon).not.toBeInTheDocument();
  });

  it('renders up trend icon when trend is up', () => {
    const { container } = render(<EngagementBadge score={75} trend="up" />);
    const icon = container.querySelector('svg');
    expect(icon).toBeInTheDocument();
  });
});
