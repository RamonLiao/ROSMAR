import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';

export interface WorkflowStep {
  type: string;
  config: Record<string, unknown>;
  delay?: number;
}

export interface Campaign {
  id: string;
  name: string;
  description: string | null;
  segmentId: string;
  status: string;
  workflowSteps: WorkflowStep[];
  version: number;
  startedAt: string | null;
  createdAt: string;
  updatedAt: string;
  segment?: { name: string };
  [key: string]: unknown;
}

interface CampaignFilters {
  status?: string;
  limit?: number;
  offset?: number;
}

export function useCampaigns(filters?: CampaignFilters) {
  return useQuery({
    queryKey: ['campaigns', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.status) params.set('status', filters.status);
      if (filters?.limit) params.set('limit', filters.limit.toString());
      if (filters?.offset) params.set('offset', filters.offset.toString());

      const query = params.toString();
      return apiClient.get<{ campaigns: Campaign[]; total: number }>(
        `/campaigns${query ? `?${query}` : ''}`
      );
    },
  });
}

export function useCampaign(id: string) {
  return useQuery({
    queryKey: ['campaign', id],
    queryFn: () => apiClient.get<Campaign>(`/campaigns/${id}`),
    enabled: !!id,
  });
}

export function useCreateCampaign() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { name: string; description?: string; segmentId: string; workflowSteps: unknown[] }) =>
      apiClient.post<{ campaignId: string; txDigest: string }>('/campaigns', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
    },
  });
}

export function useUpdateCampaign() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; name?: string; description?: string; status?: string; workflowSteps?: WorkflowStep[]; expectedVersion: number }) =>
      apiClient.put<{ success: boolean; txDigest: string }>(`/campaigns/${id}`, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['campaign', id] });
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
    },
  });
}

export function useStartCampaign() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) =>
      apiClient.post<{ success: boolean; profileCount: number }>(`/campaigns/${id}/start`),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['campaign', id] });
      queryClient.invalidateQueries({ queryKey: ['campaign-stats', id] });
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
    },
  });
}

export function usePauseCampaign() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) =>
      apiClient.post<{ success: boolean }>(`/campaigns/${id}/pause`),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['campaign', id] });
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
    },
  });
}

export function useCampaignStats(id: string) {
  return useQuery({
    queryKey: ['campaign-stats', id],
    queryFn: () => apiClient.get<{ campaignId: string; status: string; segmentSize: number }>(`/campaigns/${id}/stats`),
    enabled: !!id,
  });
}

// --- Trigger CRUD ---

export interface CampaignTrigger {
  id: string;
  campaignId: string;
  triggerType: string;
  triggerConfig: Record<string, unknown>;
  isEnabled: boolean;
}

export function useCampaignTriggers(campaignId: string) {
  return useQuery({
    queryKey: ['campaign-triggers', campaignId],
    queryFn: () => apiClient.get<CampaignTrigger[]>(`/campaigns/${campaignId}/triggers`),
    enabled: !!campaignId,
  });
}

export function useCreateTrigger() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ campaignId, ...data }: { campaignId: string; triggerType: string; triggerConfig: Record<string, unknown>; isEnabled?: boolean }) =>
      apiClient.post<CampaignTrigger>(`/campaigns/${campaignId}/triggers`, data),
    onSuccess: (_, { campaignId }) => {
      queryClient.invalidateQueries({ queryKey: ['campaign-triggers', campaignId] });
    },
  });
}

export function useUpdateTrigger() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ campaignId, triggerId, ...data }: { campaignId: string; triggerId: string; triggerConfig?: Record<string, unknown>; isEnabled?: boolean }) =>
      apiClient.patch<CampaignTrigger>(`/campaigns/${campaignId}/triggers/${triggerId}`, data),
    onSuccess: (_, { campaignId }) => {
      queryClient.invalidateQueries({ queryKey: ['campaign-triggers', campaignId] });
    },
  });
}

export function useDeleteTrigger() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ campaignId, triggerId }: { campaignId: string; triggerId: string }) =>
      apiClient.delete(`/campaigns/${campaignId}/triggers/${triggerId}`),
    onSuccess: (_, { campaignId }) => {
      queryClient.invalidateQueries({ queryKey: ['campaign-triggers', campaignId] });
    },
  });
}
