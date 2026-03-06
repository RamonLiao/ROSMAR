import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';

export interface Organization {
  id: string;
  name: string;
  domain: string | null;
  tags: string[];
  version: number;
  createdAt: string;
  updatedAt: string;
  _count?: { profiles: number };
  [key: string]: unknown;
}

interface OrganizationFilters {
  limit?: number;
  offset?: number;
  search?: string;
}

export function useOrganizations(filters?: OrganizationFilters) {
  return useQuery({
    queryKey: ['organizations', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.limit) params.set('limit', filters.limit.toString());
      if (filters?.offset) params.set('offset', filters.offset.toString());
      if (filters?.search) params.set('search', filters.search);

      const query = params.toString();
      return apiClient.get<{ organizations: Organization[]; total: number }>(
        `/organizations${query ? `?${query}` : ''}`
      );
    },
  });
}

export function useOrganization(id: string) {
  return useQuery({
    queryKey: ['organization', id],
    queryFn: () => apiClient.get<Organization>(`/organizations/${id}`),
    enabled: !!id,
  });
}

export function useCreateOrganization() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { name: string; domain?: string; tags?: string[] }) =>
      apiClient.post<{ organizationId: string; txDigest: string }>('/organizations', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organizations'] });
    },
  });
}

export function useUpdateOrganization() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; name?: string; domain?: string; tags?: string[]; expectedVersion: number }) =>
      apiClient.put<{ success: boolean; txDigest: string }>(`/organizations/${id}`, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['organization', id] });
      queryClient.invalidateQueries({ queryKey: ['organizations'] });
    },
  });
}

export function useOrganizationProfiles(orgId: string) {
  return useQuery({
    queryKey: ['organization', orgId, 'profiles'],
    queryFn: () =>
      apiClient.get<Array<{ id: string; primaryAddress: string; suinsName: string | null; tags: string[]; tier: number }>>(
        `/organizations/${orgId}/profiles`
      ),
    enabled: !!orgId,
  });
}

export function useLinkProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ orgId, profileId }: { orgId: string; profileId: string }) =>
      apiClient.post<{ success: boolean; txDigest: string }>(
        `/organizations/${orgId}/profiles/${profileId}`,
        {}
      ),
    onSuccess: (_, { orgId }) => {
      queryClient.invalidateQueries({ queryKey: ['organization', orgId, 'profiles'] });
      queryClient.invalidateQueries({ queryKey: ['organization', orgId] });
    },
  });
}

export function useUnlinkProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ orgId, profileId }: { orgId: string; profileId: string }) =>
      apiClient.delete<{ success: boolean }>(
        `/organizations/${orgId}/profiles/${profileId}`
      ),
    onSuccess: (_, { orgId }) => {
      queryClient.invalidateQueries({ queryKey: ['organization', orgId, 'profiles'] });
      queryClient.invalidateQueries({ queryKey: ['organization', orgId] });
    },
  });
}
