import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';

export interface Deal {
  id: string;
  title: string;
  amountUsd: number;
  stage: string;
  profileId: string;
  version: number;
  createdAt: string;
  updatedAt: string;
  [key: string]: unknown;
}

interface DealFilters {
  profileId?: string;
  stage?: string;
  limit?: number;
  offset?: number;
}

export function useDeals(filters?: DealFilters) {
  return useQuery({
    queryKey: ['deals', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.profileId) params.set('profileId', filters.profileId);
      if (filters?.stage) params.set('stage', filters.stage);
      if (filters?.limit) params.set('limit', filters.limit.toString());
      if (filters?.offset) params.set('offset', filters.offset.toString());

      const query = params.toString();
      return apiClient.get<{ deals: Deal[]; total: number }>(
        `/deals${query ? `?${query}` : ''}`
      );
    },
  });
}

export function useDeal(id: string) {
  return useQuery({
    queryKey: ['deal', id],
    queryFn: () => apiClient.get<Deal>(`/deals/${id}`),
    enabled: !!id,
  });
}

export function useCreateDeal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { profileId: string; title: string; amountUsd: number; stage: string }) =>
      apiClient.post<{ dealId: string; txDigest: string }>('/deals', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deals'] });
    },
  });
}

export function useUpdateDeal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; title?: string; amountUsd?: number; stage?: string; expectedVersion: number }) =>
      apiClient.put<{ success: boolean; txDigest: string }>(`/deals/${id}`, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['deal', id] });
      queryClient.invalidateQueries({ queryKey: ['deals'] });
    },
  });
}

export function useUpdateDealStage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, stage, expectedVersion }: { id: string; stage: string; expectedVersion: number }) =>
      apiClient.put<{ success: boolean; txDigest: string }>(`/deals/${id}/stage`, { stage, expectedVersion }),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['deal', id] });
      queryClient.invalidateQueries({ queryKey: ['deals'] });
    },
  });
}
