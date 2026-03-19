import { useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import { useWorkspaceStore } from "@/stores/workspace-store";

export interface EngagementWeights {
  holdTime: number;
  txCount: number;
  txValue: number;
  voteCount: number;
  nftCount: number;
}

const DEFAULT_WEIGHTS: EngagementWeights = {
  holdTime: 0.3,
  txCount: 0.2,
  txValue: 0.2,
  voteCount: 0.2,
  nftCount: 0.1,
};

export function useEngagementSettings() {
  const workspaceId = useWorkspaceStore((s) => s.activeWorkspace?.id);
  const queryClient = useQueryClient();

  const queryKey = ["workspace", workspaceId, "engagement-weights"] as const;

  const { data: weights = DEFAULT_WEIGHTS, isLoading } = useQuery({
    queryKey,
    queryFn: () =>
      apiClient.get<EngagementWeights>(
        `/workspaces/${workspaceId}/engagement-weights`,
      ),
    enabled: !!workspaceId,
  });

  const mutation = useMutation({
    mutationFn: (newWeights: EngagementWeights) =>
      apiClient.put<EngagementWeights>(
        `/workspaces/${workspaceId}/engagement-weights`,
        newWeights,
      ),
    onSuccess: (saved) => {
      queryClient.setQueryData(queryKey, saved);
    },
  });

  const setWeight = useCallback(
    (key: keyof EngagementWeights, value: number) => {
      const updated = { ...weights, [key]: value };
      // Normalize so sum = 1.0
      const sum = Object.values(updated).reduce((a, b) => a + b, 0);
      if (sum > 0) {
        const normalized = Object.fromEntries(
          Object.entries(updated).map(([k, v]) => [
            k,
            Math.round((v / sum) * 100) / 100,
          ]),
        ) as unknown as EngagementWeights;
        mutation.mutate(normalized);
        return;
      }
    },
    [weights, mutation],
  );

  const reset = useCallback(() => {
    mutation.mutate(DEFAULT_WEIGHTS);
  }, [mutation]);

  const total = Object.values(weights).reduce((a, b) => a + b, 0);

  return {
    weights,
    setWeight,
    reset,
    total: Math.round(total * 10) / 10,
    isLoading,
    isSaving: mutation.isPending,
  };
}
