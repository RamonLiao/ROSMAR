import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';

export interface Broadcast {
  id: string;
  workspaceId: string;
  title: string;
  content: string;
  contentHtml: string | null;
  channels: string[];
  segmentId: string | null;
  status: string;
  scheduledAt: string | null;
  sentAt: string | null;
  createdAt: string;
  updatedAt: string;
  _count?: { deliveries: number };
  [key: string]: unknown;
}

export interface BroadcastAnalytics {
  channel: string;
  status: string;
  _count: { status: number };
}

export function useBroadcasts() {
  return useQuery({
    queryKey: ['broadcasts'],
    queryFn: () => apiClient.get<Broadcast[]>('/broadcasts'),
  });
}

export function useCreateBroadcast() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { title: string; content: string; channels: string[]; segmentId?: string }) =>
      apiClient.post<Broadcast>('/broadcasts', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['broadcasts'] });
    },
  });
}

export function useUpdateBroadcast() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; title?: string; content?: string; channels?: string[]; segmentId?: string }) =>
      apiClient.patch<Broadcast>(`/broadcasts/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['broadcasts'] });
    },
  });
}

export function useSendBroadcast() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) =>
      apiClient.post<{ success: boolean }>(`/broadcasts/${id}/send`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['broadcasts'] });
    },
  });
}

export function useScheduleBroadcast() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, scheduledAt }: { id: string; scheduledAt: string }) =>
      apiClient.post<Broadcast>(`/broadcasts/${id}/schedule`, { scheduledAt }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['broadcasts'] });
    },
  });
}

export function useBroadcastAnalytics(id: string) {
  return useQuery({
    queryKey: ['broadcast-analytics', id],
    queryFn: () => apiClient.get<BroadcastAnalytics[]>(`/broadcasts/${id}/analytics`),
    enabled: !!id,
  });
}
