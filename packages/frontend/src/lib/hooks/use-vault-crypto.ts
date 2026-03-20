"use client";

import { useCallback } from "react";
import { toBase64, fromBase64 } from "@mysten/sui/utils";
import { useSealSession } from "./use-seal-session";
import {
  sealEncrypt,
  sealDecrypt,
  buildSealApproveTx,
} from "@/lib/crypto/seal-crypto";
import { SEAL_PACKAGE_ID, CRM_VAULT_PACKAGE_ID } from "@/lib/crypto/seal-config";
import { apiClient } from "@/lib/api/client";
import { useSuiClient } from "@mysten/dapp-kit";
import { useWorkspaceStore } from "@/stores/workspace-store";

interface StoreResult {
  blobId: string;
  url: string;
}

interface EncryptAndStoreParams {
  profileId: string;
  key: string;
  plaintext: Uint8Array;
  sealPolicyId: string;
}

interface DecryptSecretParams {
  profileId: string;
  key: string;
  sealPolicyId: string;
}

interface RemoveSecretParams {
  profileId: string;
  key: string;
  expectedVersion: number;
}

/**
 * Hook providing Seal-based encrypt, decrypt, and delete operations for vault secrets.
 */
export function useVaultCrypto() {
  const { ensureSession, clearSession, isInitializing } = useSealSession();
  const suiClient = useSuiClient();
  const workspaceId = useWorkspaceStore((s) => s.activeWorkspace?.id);

  /**
   * Encrypt data with Seal and store the encrypted blob via BFF -> Walrus.
   */
  const encryptAndStore = useCallback(
    async ({ profileId, key, plaintext, sealPolicyId }: EncryptAndStoreParams): Promise<StoreResult> => {
      const { sealClient } = await ensureSession();

      // Encrypt with Seal using the policy object as identity
      const { encryptedBytes } = await sealEncrypt(
        sealClient,
        SEAL_PACKAGE_ID,
        sealPolicyId,
        plaintext,
      );

      // Base64 encode for JSON transport
      const encryptedB64 = toBase64(encryptedBytes);

      // Store via BFF
      const result = await apiClient.post<StoreResult>("/vault/secrets", {
        profileId,
        key,
        encryptedData: encryptedB64,
        sealPolicyId,
      });

      return result;
    },
    [ensureSession],
  );

  /**
   * Fetch an encrypted blob from BFF/Walrus, then decrypt with Seal.
   */
  const decryptSecret = useCallback(
    async ({ profileId, key, sealPolicyId }: DecryptSecretParams): Promise<Uint8Array> => {
      const { sealClient, sessionKey } = await ensureSession();

      // Fetch encrypted blob metadata
      const meta = await apiClient.get<{ blobId: string; downloadUrl: string; version: number; sealPolicyId?: string }>(
        `/vault/secrets/${profileId}/${key}`,
      );

      if (!meta) {
        throw new Error("Secret not found");
      }

      const policyId = sealPolicyId || meta.sealPolicyId;
      if (!policyId) {
        throw new Error("No sealPolicyId available for this secret");
      }

      // Download the encrypted blob
      const response = await fetch(meta.downloadUrl);
      if (!response.ok) {
        throw new Error(`Failed to download blob: ${response.status}`);
      }
      const encryptedBytes = new Uint8Array(await response.arrayBuffer());

      if (!workspaceId) {
        throw new Error("No active workspace — cannot build seal_approve tx");
      }

      // Build the seal_approve PTB for key server verification
      // The ID extracted from the encrypted object is used by the key servers
      const txBytes = await buildSealApproveTx(
        CRM_VAULT_PACKAGE_ID,
        policyId,
        workspaceId,
        suiClient,
        [policyId],
      );

      // Decrypt
      const decrypted = await sealDecrypt(sealClient, encryptedBytes, sessionKey, txBytes);
      return decrypted;
    },
    [ensureSession, suiClient, workspaceId],
  );

  /**
   * Delete a vault secret via BFF.
   */
  const removeSecret = useCallback(
    async ({ profileId, key, expectedVersion }: RemoveSecretParams) => {
      return apiClient.delete(`/vault/secrets/${profileId}/${key}?expectedVersion=${expectedVersion}`);
    },
    [],
  );

  return {
    encryptAndStore,
    decryptSecret,
    removeSecret,
    clearSession,
    isInitializing,
  };
}
