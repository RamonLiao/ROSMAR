"use client";

import { useCallback, useRef, useState } from "react";
import { useSuiClient, useSignPersonalMessage, useCurrentAccount } from "@mysten/dapp-kit";
import type { SealClient, SessionKey } from "@mysten/seal";
import {
  getSealClient,
  createSessionKey,
  finalizeSessionKey,
  isSessionKeyValid,
  getCachedSessionKey,
  resetSealInstances,
} from "@/lib/crypto/seal-crypto";
import { SEAL_PACKAGE_ID } from "@/lib/crypto/seal-config";

interface SealSession {
  sealClient: SealClient;
  sessionKey: SessionKey;
}

/**
 * Hook that manages a Seal session key.
 * The wallet signs a personal message once, then the session key is reused
 * for all encrypt/decrypt operations until it expires.
 */
export function useSealSession() {
  const suiClient = useSuiClient();
  const account = useCurrentAccount();
  const { mutateAsync: signPersonalMessage } = useSignPersonalMessage();

  const sessionKeyRef = useRef<SessionKey | null>(getCachedSessionKey());
  const [isInitializing, setIsInitializing] = useState(false);

  /**
   * Returns a valid { sealClient, sessionKey }.
   * Creates + wallet-signs a new session key if none exists or the current one is expired.
   */
  const ensureSession = useCallback(async (): Promise<SealSession> => {
    if (!account?.address) {
      throw new Error("Wallet not connected");
    }

    const sealClient = getSealClient(suiClient);

    // Reuse existing session if still valid
    if (sessionKeyRef.current && isSessionKeyValid(sessionKeyRef.current)) {
      return { sealClient, sessionKey: sessionKeyRef.current };
    }

    setIsInitializing(true);
    try {
      const sk = await createSessionKey(account.address, SEAL_PACKAGE_ID, suiClient);

      // Get the personal message that needs to be signed
      const personalMessage = sk.getPersonalMessage();

      // Request wallet signature (one-time UX prompt)
      const { signature } = await signPersonalMessage({ message: personalMessage });

      // Finalize the session key with the signature
      await finalizeSessionKey(sk, signature);

      sessionKeyRef.current = sk;
      return { sealClient, sessionKey: sk };
    } finally {
      setIsInitializing(false);
    }
  }, [account?.address, suiClient, signPersonalMessage]);

  /**
   * Clear the session key and Seal singletons.
   */
  const clearSession = useCallback(() => {
    sessionKeyRef.current = null;
    resetSealInstances();
  }, []);

  return {
    ensureSession,
    clearSession,
    isInitializing,
  };
}
