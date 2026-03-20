import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { apiClient } from '@/lib/api/client';
import { useWorkspaceStore } from '@/stores/workspace-store';

export interface Workspace {
  id: string;
  name: string;
  suiObjectId?: string | null;
  role_level: number;
  permissions: number;
}

export interface WorkspaceDetail {
  id: string;
  name: string;
  description: string | null;
  owner_address: string;
  member_count: number;
  created_at: string;
}

export function useWorkspaces() {
  const setWorkspaces = useWorkspaceStore((s) => s.setWorkspaces);
  const setActiveWorkspace = useWorkspaceStore((s) => s.setActiveWorkspace);
  const activeWorkspace = useWorkspaceStore((s) => s.activeWorkspace);

  const query = useQuery({
    queryKey: ['workspaces'],
    queryFn: () => apiClient.get<{ workspaces: Workspace[] }>('/workspaces'),
  });

  useEffect(() => {
    if (query.data?.workspaces) {
      const mapped = query.data.workspaces.map((w) => ({
        id: w.id,
        name: w.name,
        suiObjectId: w.suiObjectId,
      }));
      setWorkspaces(mapped);

      // Auto-select first workspace if none active
      if (!activeWorkspace && mapped.length > 0) {
        setActiveWorkspace(mapped[0]);
      }
    }
  }, [query.data, setWorkspaces, setActiveWorkspace, activeWorkspace]);

  return query;
}

export function useWorkspace(id: string) {
  return useQuery({
    queryKey: ['workspace', id],
    queryFn: () => apiClient.get<WorkspaceDetail>(`/workspaces/${id}`),
    enabled: !!id,
  });
}

export function useUpdateWorkspace() {
  const queryClient = useQueryClient();
  const setActiveWorkspace = useWorkspaceStore((s) => s.setActiveWorkspace);
  const activeWorkspace = useWorkspaceStore((s) => s.activeWorkspace);

  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; name?: string; description?: string }) =>
      apiClient.patch<{ id: string; name: string; description: string | null }>(
        `/workspaces/${id}`,
        data,
      ),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['workspaces'] });
      queryClient.invalidateQueries({ queryKey: ['workspace', result.id] });
      // Update store if editing the active workspace
      if (activeWorkspace?.id === result.id) {
        setActiveWorkspace({ id: result.id, name: result.name });
      }
    },
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

/**
 * Switch active workspace — re-issues JWT cookie scoped to the target workspace,
 * then invalidates all cached queries so data reloads for the new workspace.
 */
export function useSwitchWorkspace() {
  const queryClient = useQueryClient();
  const setActiveWorkspace = useWorkspaceStore((s) => s.setActiveWorkspace);

  return useMutation({
    mutationFn: (workspace: { id: string; name: string }) =>
      apiClient.post<{ success: boolean; user: Record<string, unknown> }>('/auth/switch-workspace', {
        workspaceId: workspace.id,
      }),
    onSuccess: (_, workspace) => {
      setActiveWorkspace(workspace);
      // Invalidate everything — all data is workspace-scoped
      queryClient.invalidateQueries();
    },
  });
}

export interface WorkspaceMember {
  address: string;
  role_level: number;
  permissions: number;
  joined_at: string;
}

export function useWorkspaceMembers(workspaceId: string) {
  return useQuery({
    queryKey: ['workspace', workspaceId, 'members'],
    queryFn: () =>
      apiClient.get<{ members: WorkspaceMember[] }>(
        `/workspaces/${workspaceId}/members`,
      ),
    enabled: !!workspaceId,
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

/** Map roleLevel number to display label */
export const ROLE_LABELS: Record<number, string> = {
  3: 'owner',
  2: 'admin',
  1: 'member',
  0: 'viewer',
};
