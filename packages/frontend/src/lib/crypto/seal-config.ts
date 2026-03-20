/**
 * Seal SDK configuration for testnet.
 * Used by seal-crypto.ts and useSealSession hook.
 */

/** Seal Move package on testnet */
export const SEAL_PACKAGE_ID =
  "0x4016869413374eaa71df2a043d1660ed7bc927ab7962831f8b07efbc7efdb2c3";

/** Key-server object IDs (testnet) */
export const SEAL_KEY_SERVERS_TESTNET = [
  {
    objectId:
      "0x73d05d62c18d9374e3ea529e8e0ed6161da1a141a94d3f76ae3fe4e99356db75",
    weight: 1,
  },
  {
    objectId:
      "0xf5d14a81a982144ae441cd7d64b09027f116a468bd36e7eca494f750591623c8",
    weight: 1,
  },
];

/** Minimum number of key-server shares needed to reconstruct the key */
export const SEAL_THRESHOLD = 2;

/** Session key time-to-live in minutes */
export const SEAL_SESSION_TTL_MIN = 30;

/** CRM Vault Move package (testnet) */
export const CRM_VAULT_PACKAGE_ID =
  process.env.NEXT_PUBLIC_CRM_VAULT_PACKAGE_ID ??
  "0xfa439f01db88a3b16040ad746eb65ebf9ade7de3247084f98725a7f94eb0249a";
