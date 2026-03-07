import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';

export interface ProfileWallet {
  id: string;
  profileId: string;
  chain: string;
  address: string;
  ensName: string | null;
  snsName: string | null;
  verified: boolean;
  createdAt: string;
}

export interface TokenBalance {
  symbol: string;
  name: string;
  balance: string;
  decimals: number;
  usdPrice: number;
  usdValue: number;
}

export interface ChainBalance {
  chain: string;
  address: string;
  balanceUsd: number;
  tokens: TokenBalance[];
}

export interface NetWorthResult {
  totalUsd: number;
  breakdown: ChainBalance[];
}

export function useProfileWallets(profileId: string) {
  return useQuery({
    queryKey: ['profile', profileId, 'wallets'],
    queryFn: () => apiClient.get<ProfileWallet[]>(`/profiles/${profileId}/wallets`),
    enabled: !!profileId,
  });
}

export function useAddWallet() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      profileId,
      ...data
    }: {
      profileId: string;
      chain: string;
      address: string;
    }) => apiClient.post<ProfileWallet>(`/profiles/${profileId}/wallets`, data),
    onSuccess: (_, { profileId }) => {
      queryClient.invalidateQueries({ queryKey: ['profile', profileId, 'wallets'] });
      queryClient.invalidateQueries({ queryKey: ['profile', profileId, 'net-worth'] });
    },
  });
}

export function useRemoveWallet() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ profileId, walletId }: { profileId: string; walletId: string }) =>
      apiClient.delete<{ success: boolean }>(`/profiles/${profileId}/wallets/${walletId}`),
    onSuccess: (_, { profileId }) => {
      queryClient.invalidateQueries({ queryKey: ['profile', profileId, 'wallets'] });
      queryClient.invalidateQueries({ queryKey: ['profile', profileId, 'net-worth'] });
    },
  });
}

export function useNetWorth(profileId: string) {
  return useQuery({
    queryKey: ['profile', profileId, 'net-worth'],
    queryFn: () => apiClient.get<NetWorthResult>(`/profiles/${profileId}/net-worth`),
    enabled: !!profileId,
  });
}
