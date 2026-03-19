import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import { useWorkspaceStore } from "@/stores/workspace-store";

export interface CollectionEntry {
  name: string;
  contractAddress: string;
  chain: "sui" | "evm" | "solana";
}

export function useCollectionWatchlist() {
  const workspaceId = useWorkspaceStore((s) => s.activeWorkspace?.id);

  return useQuery({
    queryKey: ["workspace", workspaceId, "collection-watchlist"],
    queryFn: () =>
      apiClient.get<CollectionEntry[]>(
        `/workspaces/${workspaceId}/collection-watchlist`,
      ),
    enabled: !!workspaceId,
  });
}

export function useSetCollectionWatchlist() {
  const workspaceId = useWorkspaceStore((s) => s.activeWorkspace?.id);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (collections: CollectionEntry[]) =>
      apiClient.put<CollectionEntry[]>(
        `/workspaces/${workspaceId}/collection-watchlist`,
        { collections },
      ),
    onSuccess: (saved) => {
      queryClient.setQueryData(
        ["workspace", workspaceId, "collection-watchlist"],
        saved,
      );
    },
  });
}
