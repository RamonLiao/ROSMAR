import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import { useWorkspaceStore } from "@/stores/workspace-store";

export interface GasStationSettings {
  enabled: boolean;
  thresholdMist: string;
  dailyLimit: number;
}

export function useGasSettings() {
  const workspaceId = useWorkspaceStore((s) => s.activeWorkspace?.id);

  const { data, isLoading } = useQuery({
    queryKey: ["gas-config", workspaceId],
    queryFn: () =>
      apiClient.get<GasStationSettings>(
        `/workspaces/${workspaceId}/gas-config`,
      ),
    enabled: !!workspaceId,
  });

  const settings: GasStationSettings = data ?? {
    enabled: false,
    thresholdMist: "100000000",
    dailyLimit: 5,
  };

  // Convert MIST to SUI for display
  const thresholdSui = Number(settings.thresholdMist) / 1_000_000_000;

  return {
    settings: {
      enabled: settings.enabled,
      thresholdSui,
      dailyLimit: settings.dailyLimit,
    },
    isLoading,
    workspaceId,
  };
}

export function useUpdateGasSettings() {
  const queryClient = useQueryClient();
  const workspaceId = useWorkspaceStore((s) => s.activeWorkspace?.id);

  return useMutation({
    mutationFn: (data: {
      enabled?: boolean;
      thresholdMist?: string;
      dailyLimit?: number;
    }) =>
      apiClient.put<GasStationSettings>(
        `/workspaces/${workspaceId}/gas-config`,
        data,
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gas-config", workspaceId] });
    },
  });
}
