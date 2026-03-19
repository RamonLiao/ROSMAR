import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import { useWorkspaceStore } from "@/stores/workspace-store";

export interface WhaleThreshold {
  token: string;
  amount: number;
}

export interface WhaleAlert {
  id: string;
  type: string;
  title: string;
  body: string;
  isRead: boolean;
  createdAt: string;
  metadata?: {
    address?: string;
    amount?: number;
    token?: string;
    txType?: string;
    txDigest?: string;
    profileId?: string;
  };
}

export interface TopWhale {
  profileId: string;
  primaryAddress: string;
  suinsName: string | null;
  tags: string[];
  totalRawBalance: string;
}

export function useWhaleThresholds() {
  const workspaceId = useWorkspaceStore((s) => s.activeWorkspace?.id);

  return useQuery({
    queryKey: ["workspace", workspaceId, "whale-thresholds"],
    queryFn: () =>
      apiClient.get<WhaleThreshold[]>(
        `/workspaces/${workspaceId}/whale-thresholds`,
      ),
    enabled: !!workspaceId,
  });
}

export function useSetWhaleThresholds() {
  const workspaceId = useWorkspaceStore((s) => s.activeWorkspace?.id);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (thresholds: WhaleThreshold[]) =>
      apiClient.put<WhaleThreshold[]>(
        `/workspaces/${workspaceId}/whale-thresholds`,
        { thresholds },
      ),
    onSuccess: (saved) => {
      queryClient.setQueryData(
        ["workspace", workspaceId, "whale-thresholds"],
        saved,
      );
    },
  });
}

export function useWhaleAlerts(limit = 50) {
  const workspaceId = useWorkspaceStore((s) => s.activeWorkspace?.id);

  return useQuery({
    queryKey: ["workspace", workspaceId, "whale-alerts", limit],
    queryFn: () =>
      apiClient.get<WhaleAlert[]>(
        `/workspaces/${workspaceId}/whale-alerts?limit=${limit}`,
      ),
    enabled: !!workspaceId,
    refetchInterval: 30000,
  });
}

export function useTopWhales(limit = 20) {
  const workspaceId = useWorkspaceStore((s) => s.activeWorkspace?.id);

  return useQuery({
    queryKey: ["workspace", workspaceId, "top-whales", limit],
    queryFn: () =>
      apiClient.get<TopWhale[]>(
        `/workspaces/${workspaceId}/top-whales?limit=${limit}`,
      ),
    enabled: !!workspaceId,
  });
}
