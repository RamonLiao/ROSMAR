"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";

// ---------- Types ----------

export interface VaultSecretSummary {
  key: string;
  blobId: string;
  sealPolicyId?: string;
  version: number;
  releaseAt?: string | null;
  isReleased?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface VaultSecretDetail {
  blobId: string;
  downloadUrl: string;
  sealPolicyId?: string;
  version: number;
}

export interface StoreSecretPayload {
  profileId: string;
  key: string;
  encryptedData: string; // base64
  sealPolicyId?: string;
  releaseAt?: string; // ISO date string
}

export interface StoreSecretResult {
  blobId: string;
  url: string;
}

// ---------- Hooks ----------

/**
 * List all vault secrets for a profile.
 */
export function useVaultSecrets(profileId: string | undefined) {
  return useQuery({
    queryKey: ["vault-secrets", profileId],
    queryFn: () =>
      apiClient.get<{ secrets: VaultSecretSummary[] }>(
        `/vault/secrets/${profileId}`,
      ),
    enabled: !!profileId,
    select: (data) => data.secrets,
  });
}

/**
 * Get a single vault secret's metadata (blobId, downloadUrl, sealPolicyId).
 */
export function useVaultSecret(
  profileId: string | undefined,
  key: string | undefined,
) {
  return useQuery({
    queryKey: ["vault-secret", profileId, key],
    queryFn: () =>
      apiClient.get<VaultSecretDetail>(
        `/vault/secrets/${profileId}/${key}`,
      ),
    enabled: !!profileId && !!key,
  });
}

/**
 * Store (or overwrite) a vault secret.
 */
export function useStoreSecret() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (payload: StoreSecretPayload) =>
      apiClient.post<StoreSecretResult>("/vault/secrets", payload),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({
        queryKey: ["vault-secrets", variables.profileId],
      });
    },
  });
}

/**
 * Delete a vault secret.
 */
export function useDeleteSecret() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({
      profileId,
      key,
      expectedVersion,
    }: {
      profileId: string;
      key: string;
      expectedVersion: number;
    }) =>
      apiClient.delete(
        `/vault/secrets/${profileId}/${key}?expectedVersion=${expectedVersion}`,
      ),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({
        queryKey: ["vault-secrets", variables.profileId],
      });
    },
  });
}

/**
 * Manually release a time-locked vault secret.
 */
export function useReleaseSecret() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({
      profileId,
      key,
    }: {
      profileId: string;
      key: string;
    }) =>
      apiClient.post(`/vault/secrets/${profileId}/${key}/release`, {}),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({
        queryKey: ["vault-secrets", variables.profileId],
      });
    },
  });
}
