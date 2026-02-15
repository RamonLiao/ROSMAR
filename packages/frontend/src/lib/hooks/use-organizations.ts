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

export function useOrganizations(limit?: number, offset?: number) {
  return useQuery({
    queryKey: ['organizations', { limit, offset }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (limit) params.set('limit', limit.toString());
      if (offset) params.set('offset', offset.toString());

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
