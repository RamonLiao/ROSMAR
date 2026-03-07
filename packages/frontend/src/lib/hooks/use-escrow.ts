import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';

// ── Types ──────────────────────────────────────────────

export type EscrowState = 'CREATED' | 'FUNDED' | 'COMPLETED' | 'DISPUTED' | 'REFUNDED';
export type VestingType = 'LINEAR' | 'MILESTONE';

export interface Arbitrator {
  address: string;
}

export interface Milestone {
  description: string;
  basisPoints: number;
  completed: boolean;
}

export interface VestingSchedule {
  type: VestingType;
  startDate: string;
  endDate: string;
  milestones?: Milestone[];
}

export interface SaftTemplate {
  id: string;
  name: string;
  tokenSymbol: string;
  totalTokens: number;
  pricePerToken: number;
  cliffMonths: number;
  vestingMonths: number;
  jurisdiction: string;
  signedPdfUrl?: string;
}

export interface EscrowData {
  id: string;
  state: EscrowState;
  payer: string;
  payee: string;
  totalAmount: string;
  releasedAmount: string;
  refundedAmount: string;
  tokenType: string;
  arbiterThreshold: number;
  createdAt: string;
  arbitrators: Arbitrator[];
  vestingSchedule: VestingSchedule | null;
  saftTemplates: SaftTemplate[];
}

export interface CreateEscrowInput {
  dealId: string;
  payee: string;
  totalAmount: string;
  tokenType: string;
  arbitrators: string[];
  arbiterThreshold: number;
  vestingSchedule?: Partial<VestingSchedule>;
}

// ── Hooks ──────────────────────────────────────────────

export function useEscrow(dealId: string) {
  return useQuery({
    queryKey: ['escrow', dealId],
    queryFn: () => apiClient.get<EscrowData>(`/deals/${dealId}/escrow`),
    enabled: !!dealId,
  });
}

export function useCreateEscrow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ dealId, ...data }: CreateEscrowInput) =>
      apiClient.post<{ escrowId: string; txDigest: string }>(`/deals/${dealId}/escrow`, data),
    onSuccess: (_, { dealId }) => {
      qc.invalidateQueries({ queryKey: ['escrow', dealId] });
    },
  });
}

export function useFundEscrow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ dealId, amount }: { dealId: string; amount: string }) =>
      apiClient.post<{ txDigest: string }>(`/deals/${dealId}/escrow/fund`, { amount }),
    onSuccess: (_, { dealId }) => {
      qc.invalidateQueries({ queryKey: ['escrow', dealId] });
    },
  });
}

export function useReleaseEscrow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ dealId, amount }: { dealId: string; amount: string }) =>
      apiClient.post<{ txDigest: string }>(`/deals/${dealId}/escrow/release`, { amount }),
    onSuccess: (_, { dealId }) => {
      qc.invalidateQueries({ queryKey: ['escrow', dealId] });
    },
  });
}

export function useRefundEscrow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ dealId }: { dealId: string }) =>
      apiClient.post<{ txDigest: string }>(`/deals/${dealId}/escrow/refund`, {}),
    onSuccess: (_, { dealId }) => {
      qc.invalidateQueries({ queryKey: ['escrow', dealId] });
    },
  });
}

export function useRaiseDispute() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ dealId, reason }: { dealId: string; reason?: string }) =>
      apiClient.post<{ txDigest: string }>(`/deals/${dealId}/escrow/dispute`, { reason }),
    onSuccess: (_, { dealId }) => {
      qc.invalidateQueries({ queryKey: ['escrow', dealId] });
    },
  });
}

export function useVoteOnDispute() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ dealId, vote }: { dealId: string; vote: 'release' | 'refund' }) =>
      apiClient.post<{ txDigest: string }>(`/deals/${dealId}/escrow/dispute/vote`, { vote }),
    onSuccess: (_, { dealId }) => {
      qc.invalidateQueries({ queryKey: ['escrow', dealId] });
    },
  });
}
