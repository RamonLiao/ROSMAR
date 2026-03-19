import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';

export interface Profile {
  id: string;
  primaryAddress: string;
  suinsName: string | null;
  avatarUrl: string | null;
  primaryDomain: string | null;
  tags: string[];
  tier: number;
  engagementScore: number;
  version: number;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
  [key: string]: unknown;
}

interface ProfileFilters {
  search?: string;
  tags?: string[];
  limit?: number;
  offset?: number;
}

export function useProfiles(filters?: ProfileFilters) {
  return useQuery({
    queryKey: ['profiles', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.limit) params.set('limit', filters.limit.toString());
      if (filters?.offset) params.set('offset', filters.offset.toString());
      if (filters?.search) params.set('search', filters.search);

      const query = params.toString();
      return apiClient.get<{ profiles: Profile[]; total: number }>(
        `/profiles${query ? `?${query}` : ''}`
      );
    },
  });
}

export function useProfile(id: string) {
  return useQuery({
    queryKey: ['profile', id],
    queryFn: () => apiClient.get<Profile>(`/profiles/${id}`),
    enabled: !!id,
  });
}

export function useCreateProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { primaryAddress: string; suinsName?: string; tags?: string[] }) =>
      apiClient.post<{ profileId: string; txDigest: string }>('/profiles', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profiles'] });
    },
  });
}

export function useUpdateProfileTags() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; tags: string[]; expectedVersion: number }) =>
      apiClient.put<{ success: boolean; txDigest: string }>(`/profiles/${id}/tags`, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['profile', id] });
      queryClient.invalidateQueries({ queryKey: ['profiles'] });
    },
  });
}

export function useProfileOrganizations(profileId: string) {
  return useQuery({
    queryKey: ['profile', profileId, 'organizations'],
    queryFn: () =>
      apiClient.get<Array<{ id: string; name: string; domain: string | null; tags: string[] }>>(
        `/profiles/${profileId}/organizations`
      ),
    enabled: !!profileId,
  });
}
