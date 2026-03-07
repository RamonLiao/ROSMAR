import { render, screen } from '@/test/test-utils';
import { describe, it, expect, vi } from 'vitest';
import { EscrowPanel } from '../escrow-panel';
import type { EscrowData } from '@/lib/hooks/use-escrow';

const baseMock: EscrowData = {
  id: 'esc1',
  state: 'FUNDED',
  payer: '0xabc0000000000000000000000000000000000000000000000000000000000def',
  payee: '0x1230000000000000000000000000000000000000000000000000000000000456',
  totalAmount: '10000',
  releasedAmount: '3000',
  refundedAmount: '0',
  tokenType: 'SUI',
  arbiterThreshold: 2,
  createdAt: '2026-03-07',
  arbitrators: [
    { address: '0xarb1000000000000000000000000000000000000000000000000000000000001' },
    { address: '0xarb2000000000000000000000000000000000000000000000000000000000002' },
    { address: '0xarb3000000000000000000000000000000000000000000000000000000000003' },
  ],
  vestingSchedule: null,
  saftTemplates: [],
};

describe('EscrowPanel', () => {
  it('renders escrow state badge', () => {
    render(<EscrowPanel escrow={baseMock} />);
    expect(screen.getByText('FUNDED')).toBeInTheDocument();
  });

  it('shows fund progress bar at 30%', () => {
    render(<EscrowPanel escrow={baseMock} />);
    const bar = screen.getByRole('progressbar');
    expect(bar).toHaveAttribute('aria-valuenow', '30');
  });

  it('shows payer and payee addresses truncated', () => {
    render(<EscrowPanel escrow={baseMock} />);
    expect(screen.getByText('0xabc0...0def')).toBeInTheDocument();
    expect(screen.getByText('0x1230...0456')).toBeInTheDocument();
  });

  it('does NOT show Fund button when state=FUNDED', () => {
    render(
      <EscrowPanel
        escrow={baseMock}
        currentUserAddress={baseMock.payer}
      />
    );
    expect(screen.queryByRole('button', { name: /fund/i })).not.toBeInTheDocument();
  });

  it('shows Release button when state=FUNDED and user is payer', () => {
    render(
      <EscrowPanel
        escrow={baseMock}
        currentUserAddress={baseMock.payer}
      />
    );
    expect(screen.getByRole('button', { name: /release/i })).toBeInTheDocument();
  });

  it('shows Dispute button when state=FUNDED and user is payer', () => {
    render(
      <EscrowPanel
        escrow={baseMock}
        currentUserAddress={baseMock.payer}
      />
    );
    expect(screen.getByRole('button', { name: /dispute/i })).toBeInTheDocument();
  });

  it('renders vesting milestones when present', () => {
    const withVesting: EscrowData = {
      ...baseMock,
      vestingSchedule: {
        type: 'MILESTONE',
        startDate: '2026-01-01',
        endDate: '2026-12-31',
        milestones: [
          { description: 'MVP Launch', basisPoints: 2500, completed: true },
          { description: 'Token Gen', basisPoints: 7500, completed: false },
        ],
      },
    };
    render(<EscrowPanel escrow={withVesting} />);
    expect(screen.getByText('MVP Launch')).toBeInTheDocument();
    expect(screen.getByText('Token Gen')).toBeInTheDocument();
    expect(screen.getByText('25.0%')).toBeInTheDocument();
    expect(screen.getByText('75.0%')).toBeInTheDocument();
  });
});
