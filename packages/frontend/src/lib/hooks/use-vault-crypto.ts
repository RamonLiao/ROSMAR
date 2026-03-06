'use client';

import { useCallback, useState } from 'react';
import { useSignPersonalMessage } from '@mysten/dapp-kit';
import { encrypt, decrypt, encryptBytes, decryptBytes, toBase64 } from '@/lib/crypto/vault-crypto';
import { useStoreSecret, useDeleteSecret, type VaultType } from './use-vault';
import { apiClient } from '@/lib/api/client';

const SIGN_MESSAGE = new TextEncoder().encode('ROSMAR Vault Encryption Key');
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

interface EncryptAndStoreParams {
  profileId: string;
  key: string;
  data: string | ArrayBuffer;
  vaultType: VaultType;
  fileName?: string;
  mimeType?: string;
  fileSize?: number;
}

interface DecryptResult {
  text?: string;
  bytes?: Uint8Array;
  vaultType: VaultType;
  fileName?: string;
  mimeType?: string;
}

export function useVaultCrypto() {
  const { mutateAsync: signMessage } = useSignPersonalMessage();
  const storeSecret = useStoreSecret();
  const deleteSecret = useDeleteSecret();
  const [signing, setSigning] = useState(false);

  const getSignature = useCallback(async () => {
    setSigning(true);
    try {
      const { signature } = await signMessage({ message: SIGN_MESSAGE });
      return signature;
    } finally {
      setSigning(false);
    }
  }, [signMessage]);

  const encryptAndStore = useCallback(
    async (params: EncryptAndStoreParams) => {
      if (params.vaultType === 'file' && params.fileSize && params.fileSize > MAX_FILE_SIZE) {
        throw new Error(`File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB.`);
      }

      const signature = await getSignature();

      let encrypted: Uint8Array;
      if (typeof params.data === 'string') {
        encrypted = await encrypt(params.data, signature);
      } else {
        encrypted = await encryptBytes(new Uint8Array(params.data), signature);
      }

      return storeSecret.mutateAsync({
        profileId: params.profileId,
        key: params.key,
        encryptedData: toBase64(encrypted),
        vaultType: params.vaultType,
        fileName: params.fileName,
        mimeType: params.mimeType,
        fileSize: params.fileSize,
      });
    },
    [getSignature, storeSecret],
  );

  const decryptSecret = useCallback(
    async (profileId: string, key: string): Promise<DecryptResult> => {
      // 1. Get secret metadata + download URL
      const detail = await apiClient.get<{
        downloadUrl: string;
        vaultType: VaultType;
        fileName?: string;
        mimeType?: string;
      }>(`/vault/secrets/${profileId}/${key}`);

      // 2. Download encrypted blob from Walrus
      const response = await fetch(detail.downloadUrl);
      if (!response.ok) throw new Error('Failed to download encrypted data');
      const encryptedBytes = new Uint8Array(await response.arrayBuffer());

      // 3. Sign to get decryption key
      const signature = await getSignature();

      // 4. Decrypt based on type
      if (detail.vaultType === 'note') {
        const text = await decrypt(encryptedBytes, signature);
        return { text, vaultType: 'note' };
      } else {
        const bytes = await decryptBytes(encryptedBytes, signature);
        return {
          bytes,
          vaultType: 'file',
          fileName: detail.fileName,
          mimeType: detail.mimeType,
        };
      }
    },
    [getSignature],
  );

  const removeSecret = useCallback(
    (profileId: string, key: string, expectedVersion: number) =>
      deleteSecret.mutateAsync({ profileId, key, expectedVersion }),
    [deleteSecret],
  );

  return {
    encryptAndStore,
    decryptSecret,
    removeSecret,
    signing,
    isStoring: storeSecret.isPending,
    isDeleting: deleteSecret.isPending,
  };
}
