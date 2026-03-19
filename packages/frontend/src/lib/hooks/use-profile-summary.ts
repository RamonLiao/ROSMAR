import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import type { Profile } from './use-profiles';

interface ProfileSummary {
  profile: Profile;
  wallets: Array<{
    id: string;
    chain: string;
    address: string;
    ensName: string | null;
    snsName: string | null;
    createdAt: string;
  }>;
  netWorth: {
    totalUsd: number;
    chains: Record<string, number>;
  };
  recentActivity: Array<{
    id: string;
    eventType: string;
    collection: string | null;
    amount: number | null;
    time: string;
  }>;
  socialLinks: Array<{
    id: string;
    platform: string;
    platformUserId: string;
    linkedAt: string;
  }>;
  stats: {
    assetCount: number;
    organizationCount: number;
    messageCount: number;
  };
}

export function useProfileSummary(id: string) {
  return useQuery({
    queryKey: ['profile', id, 'summary'],
    queryFn: () => apiClient.get<ProfileSummary>(`/profiles/${id}/summary`),
    enabled: !!id,
    staleTime: 30_000, // 30s — summary is cached server-side for 60s
  });
}
