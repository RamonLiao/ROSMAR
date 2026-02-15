import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';

export interface Segment {
  id: string;
  name: string;
  description: string | null;
  rules: unknown;
  version: number;
  lastRefreshedAt: string | null;
  createdAt: string;
  updatedAt: string;
  _count?: { memberships: number };
  [key: string]: unknown;
}

export function useSegments(limit?: number, offset?: number) {
  return useQuery({
    queryKey: ['segments', { limit, offset }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (limit) params.set('limit', limit.toString());
      if (offset) params.set('offset', offset.toString());

      const query = params.toString();
      return apiClient.get<{ segments: Segment[]; total: number }>(
        `/segments${query ? `?${query}` : ''}`
      );
    },
  });
}

export function useSegment(id: string) {
  return useQuery({
    queryKey: ['segment', id],
    queryFn: () => apiClient.get<Segment>(`/segments/${id}`),
    enabled: !!id,
  });
}

export function useCreateSegment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { name: string; description?: string; rules: unknown }) =>
      apiClient.post<{ segmentId: string; txDigest: string }>('/segments', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['segments'] });
    },
  });
}

export function useUpdateSegment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; name?: string; description?: string; rules?: unknown; expectedVersion: number }) =>
      apiClient.put<{ success: boolean; txDigest: string }>(`/segments/${id}`, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['segment', id] });
      queryClient.invalidateQueries({ queryKey: ['segments'] });
    },
  });
}

export function useRefreshSegment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) =>
      apiClient.post<{ success: boolean; profileCount: number }>(`/segments/${id}/refresh`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['segments'] });
    },
  });
}
