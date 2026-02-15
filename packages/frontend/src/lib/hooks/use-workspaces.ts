import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';

export interface Workspace {
  id: string;
  name: string;
  role_level: number;
  permissions: number;
}

export interface WorkspaceDetail {
  id: string;
  name: string;
  owner_address: string;
  member_count: number;
  created_at: string;
}

export function useWorkspaces() {
  return useQuery({
    queryKey: ['workspaces'],
    queryFn: () => apiClient.get<{ workspaces: Workspace[] }>('/workspaces'),
  });
}

export function useWorkspace(id: string) {
  return useQuery({
    queryKey: ['workspace', id],
    queryFn: () => apiClient.get<WorkspaceDetail>(`/workspaces/${id}`),
    enabled: !!id,
  });
}

export function useCreateWorkspace() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { name: string }) =>
      apiClient.post<{ success: boolean; workspace: WorkspaceDetail }>('/workspaces', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspaces'] });
    },
  });
}

export function useAddMember() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ workspaceId, ...data }: { workspaceId: string; address: string; roleLevel: number; permissions: number }) =>
      apiClient.post<{ success: boolean; txDigest: string }>(`/workspaces/${workspaceId}/members`, data),
    onSuccess: (_, { workspaceId }) => {
      queryClient.invalidateQueries({ queryKey: ['workspace', workspaceId] });
    },
  });
}

export function useRemoveMember() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ workspaceId, address }: { workspaceId: string; address: string }) =>
      apiClient.delete<{ success: boolean; txDigest: string }>(`/workspaces/${workspaceId}/members/${address}`),
    onSuccess: (_, { workspaceId }) => {
      queryClient.invalidateQueries({ queryKey: ['workspace', workspaceId] });
    },
  });
}
