import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { TierBadge } from '../tier-badge';

describe('TierBadge', () => {
  it('renders bronze tier badge', () => {
    render(<TierBadge tier={0} />);
    expect(screen.getByText('Bronze')).toBeInTheDocument();
  });

  it('renders silver tier badge', () => {
    render(<TierBadge tier={1} />);
    expect(screen.getByText('Silver')).toBeInTheDocument();
  });

  it('renders gold tier badge', () => {
    render(<TierBadge tier={2} />);
    expect(screen.getByText('Gold')).toBeInTheDocument();
  });

  it('renders platinum tier badge', () => {
    render(<TierBadge tier={3} />);
    expect(screen.getByText('Platinum')).toBeInTheDocument();
  });

  it('renders diamond tier badge', () => {
    render(<TierBadge tier={4} />);
    expect(screen.getByText('Diamond')).toBeInTheDocument();
  });

  it('defaults to bronze for unknown tier', () => {
    render(<TierBadge tier={99} />);
    expect(screen.getByText('Bronze')).toBeInTheDocument();
  });
});
