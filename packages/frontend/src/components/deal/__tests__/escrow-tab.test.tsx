import { render, screen, fireEvent } from '@/test/test-utils';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ──────────────────────────────────────────────

const mockDeal = {
  id: 'deal-1',
  title: 'Test Deal',
  amountUsd: 50000,
  stage: 'negotiation',
  notes: 'Some notes',
  profileId: 'prof-1',
  suiObjectId: null,
  version: 1,
  isArchived: false,
  createdAt: '2026-03-07',
  updatedAt: '2026-03-07',
  workspaceId: 'ws-1',
};

const mockEscrow = {
  id: 'esc1',
  state: 'FUNDED' as const,
  payer: '0xabc0000000000000000000000000000000000000000000000000000000000def',
  payee: '0x1230000000000000000000000000000000000000000000000000000000000456',
  totalAmount: '10000',
  releasedAmount: '3000',
  refundedAmount: '0',
  tokenType: 'SUI',
  arbiterThreshold: 2,
  createdAt: '2026-03-07',
  arbitrators: [{ address: '0xarb1' }],
  vestingSchedule: null,
  saftTemplates: [],
};

let mockUseDeal: ReturnType<typeof vi.fn>;
let mockUseEscrow: ReturnType<typeof vi.fn>;

vi.mock('@/lib/hooks/use-deals', () => ({
  useDeal: (...args: unknown[]) => mockUseDeal(...args),
  useUpdateDeal: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

vi.mock('@/lib/hooks/use-escrow', () => ({
  useEscrow: (...args: unknown[]) => mockUseEscrow(...args),
  useCreateEscrow: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useFundEscrow: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useReleaseEscrow: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useRefundEscrow: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useRaiseDispute: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useVoteOnDispute: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

// We test the tab content via component-level imports,
// not the page itself (which uses `use(params)` and Next.js server primitives).
// Instead we test the EscrowTabContent component directly.
import { EscrowTabContent } from '../escrow-tab-content';

describe('Escrow Tab', () => {
  beforeEach(() => {
    mockUseDeal = vi.fn();
    mockUseEscrow = vi.fn();
  });

  it('shows "Create Escrow" CTA when no escrow exists', () => {
    mockUseEscrow.mockReturnValue({ data: null, isLoading: false, error: null });
    render(<EscrowTabContent dealId="deal-1" />);
    expect(screen.getByRole('button', { name: /create escrow/i })).toBeInTheDocument();
  });

  it('shows EscrowPanel when escrow exists', () => {
    mockUseEscrow.mockReturnValue({ data: mockEscrow, isLoading: false, error: null });
    render(<EscrowTabContent dealId="deal-1" />);
    expect(screen.getByText('FUNDED')).toBeInTheDocument();
    expect(screen.getByText('Escrow')).toBeInTheDocument();
  });

  it('shows loading state while fetching', () => {
    mockUseEscrow.mockReturnValue({ data: null, isLoading: true, error: null });
    render(<EscrowTabContent dealId="deal-1" />);
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it('shows SAFT section below escrow panel when escrow exists', () => {
    mockUseEscrow.mockReturnValue({
      data: { ...mockEscrow, saftTemplates: [] },
      isLoading: false,
      error: null,
    });
    render(<EscrowTabContent dealId="deal-1" />);
    expect(screen.getByText('SAFT Templates')).toBeInTheDocument();
  });
});
