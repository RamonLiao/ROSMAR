import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';

export interface VaultSecret {
  key: string;
  blobId: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export function useVaultSecrets(profileId?: string) {
  return useQuery({
    queryKey: ['vault', 'secrets', profileId],
    queryFn: () => apiClient.get<{ secrets: VaultSecret[] }>(`/vault/secrets/${profileId}`),
    enabled: !!profileId,
  });
}

export function useGetSecret(profileId: string, key?: string) {
  return useQuery({
    queryKey: ['vault', 'secrets', profileId, key],
    queryFn: () => apiClient.get<{ blobId: string; downloadUrl: string; version: number }>(
      `/vault/secrets/${profileId}/${key}`,
    ),
    enabled: !!profileId && !!key,
  });
}

export function useStoreSecret() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { profileId: string; key: string; encryptedData: string }) =>
      apiClient.post<{ blobId: string; url: string }>('/vault/secrets', data),
    onSuccess: (_, { profileId }) => {
      queryClient.invalidateQueries({ queryKey: ['vault', 'secrets', profileId] });
    },
  });
}
