/**
 * Seal SDK wrapper — encrypt/decrypt via Seal key servers.
 * Replaces the old Web Crypto AES-GCM approach entirely.
 */

import { SealClient, SessionKey } from "@mysten/seal";
import type { SealCompatibleClient } from "@mysten/seal";
import { Transaction } from "@mysten/sui/transactions";
import {
  SEAL_KEY_SERVERS_TESTNET,
  SEAL_THRESHOLD,
  SEAL_SESSION_TTL_MIN,
  CRM_VAULT_PACKAGE_ID,
} from "./seal-config";

// --------------- Singletons ---------------

let _sealClient: SealClient | null = null;
let _sessionKey: SessionKey | null = null;

/**
 * Get or create a SealClient singleton bound to the given SuiClient.
 */
export function getSealClient(suiClient: SealCompatibleClient): SealClient {
  if (!_sealClient) {
    _sealClient = new SealClient({
      suiClient,
      serverConfigs: SEAL_KEY_SERVERS_TESTNET,
      verifyKeyServers: false,
    });
  }
  return _sealClient;
}

// --------------- Session Key ---------------

/**
 * Create a new SessionKey (not yet signed — call finalizeSessionKey after wallet sign).
 */
export async function createSessionKey(
  address: string,
  packageId: string,
  suiClient: SealCompatibleClient,
): Promise<SessionKey> {
  const sk = await SessionKey.create({
    address,
    packageId,
    ttlMin: SEAL_SESSION_TTL_MIN,
    suiClient,
  });
  _sessionKey = sk;
  return sk;
}

/**
 * Finalize a SessionKey by providing the wallet personal-message signature.
 */
export async function finalizeSessionKey(
  sessionKey: SessionKey,
  signature: string,
): Promise<void> {
  await sessionKey.setPersonalMessageSignature(signature);
}

/**
 * Returns true when the session key exists and is not expired.
 */
export function isSessionKeyValid(sessionKey: SessionKey | null): boolean {
  if (!sessionKey) return false;
  return !sessionKey.isExpired();
}

/**
 * Get the cached session key (may be null).
 */
export function getCachedSessionKey(): SessionKey | null {
  return _sessionKey;
}

// --------------- Encrypt / Decrypt ---------------

/**
 * Encrypt arbitrary data with Seal.
 * Returns the BCS-encoded encrypted object bytes and the 256-bit backup key.
 */
export async function sealEncrypt(
  sealClient: SealClient,
  packageId: string,
  policyObjectId: string,
  data: Uint8Array,
): Promise<{ encryptedBytes: Uint8Array; backupKey: Uint8Array }> {
  const { encryptedObject, key } = await sealClient.encrypt({
    threshold: SEAL_THRESHOLD,
    packageId,
    id: policyObjectId,
    data,
  });
  return { encryptedBytes: encryptedObject, backupKey: key };
}

/**
 * Decrypt a Seal-encrypted blob.
 */
export async function sealDecrypt(
  sealClient: SealClient,
  encryptedBytes: Uint8Array,
  sessionKey: SessionKey,
  txBytes: Uint8Array,
): Promise<Uint8Array> {
  return sealClient.decrypt({
    data: encryptedBytes,
    sessionKey,
    txBytes,
  });
}

// --------------- TX Builder ---------------

/**
 * Build the `seal_approve` PTB that the key servers verify.
 * Returns raw txBytes (onlyTransactionKind: true).
 *
 * @param innerIds - The `id` values parsed from Seal EncryptedObject blobs
 *                   (i.e. `EncryptedObject.parse(bytes).id`).
 */
export async function buildSealApproveTx(
  vaultPackageId: string,
  policyObjectId: string,
  workspaceObjectId: string,
  suiClient: SealCompatibleClient,
  innerIds: string[],
): Promise<Uint8Array> {
  const tx = new Transaction();

  for (const id of innerIds) {
    tx.moveCall({
      target: `${vaultPackageId}::policy::seal_approve`,
      arguments: [
        tx.pure.vector("u8", Array.from(new TextEncoder().encode(id))),
        tx.object(policyObjectId),
        tx.object(workspaceObjectId),
        tx.object("0x6"), // SUI system Clock
      ],
    });
  }

  const txBytes = await tx.build({
    client: suiClient,
    onlyTransactionKind: true,
  });
  return txBytes;
}

// --------------- Cleanup ---------------

/**
 * Reset all singletons — call on logout.
 */
export function resetSealInstances(): void {
  _sealClient = null;
  _sessionKey = null;
}
