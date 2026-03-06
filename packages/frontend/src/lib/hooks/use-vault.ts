import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';

export type VaultType = 'note' | 'file';

export interface VaultSecret {
  key: string;
  blobId: string;
  version: number;
  vaultType: VaultType;
  fileName?: string;
  mimeType?: string;
  fileSize?: number;
  createdAt: string;
  updatedAt: string;
}

export interface VaultSecretDetail {
  blobId: string;
  downloadUrl: string;
  version: number;
  vaultType: VaultType;
  fileName?: string;
  mimeType?: string;
  fileSize?: number;
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
    queryFn: () => apiClient.get<VaultSecretDetail>(`/vault/secrets/${profileId}/${key}`),
    enabled: !!profileId && !!key,
  });
}

export function useStoreSecret() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: {
      profileId: string;
      key: string;
      encryptedData: string;
      vaultType: VaultType;
      fileName?: string;
      mimeType?: string;
      fileSize?: number;
    }) => apiClient.post<{ blobId: string; url: string }>('/vault/secrets', data),
    onSuccess: (_, { profileId }) => {
      queryClient.invalidateQueries({ queryKey: ['vault', 'secrets', profileId] });
    },
  });
}

export function useDeleteSecret() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { profileId: string; key: string; expectedVersion: number }) =>
      apiClient.delete<{ success: boolean }>(
        `/vault/secrets/${data.profileId}/${data.key}`,
        { expectedVersion: data.expectedVersion },
      ),
    onSuccess: (_, { profileId }) => {
      queryClient.invalidateQueries({ queryKey: ['vault', 'secrets', profileId] });
    },
  });
}
