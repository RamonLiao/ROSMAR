import { useSignPersonalMessage } from '@mysten/dapp-kit';
import { useCallback, useRef } from 'react';
import { apiClient } from '@/lib/api/client';
import { useAuthStore } from '@/stores/auth-store';
import { useWorkspaceStore } from '@/stores/workspace-store';

/**
 * Hook that establishes a BFF session after wallet connection.
 * Flow: GET challenge → sign with wallet → POST /auth/login → httpOnly cookie set
 */
export function useAuthSession() {
  const { mutateAsync: signPersonalMessage } = useSignPersonalMessage();
  const login = useAuthStore((s) => s.login);
  const setActiveWorkspace = useWorkspaceStore((s) => s.setActiveWorkspace);
  const isPending = useRef(false);

  const authenticate = useCallback(
    async (address: string) => {
      if (isPending.current) return;
      isPending.current = true;

      try {
        // 1. Get challenge nonce from BFF
        const { challenge } = await apiClient.get<{ challenge: string }>(
          '/auth/challenge',
        );

        // 2. Sign the challenge with the connected wallet
        const { signature } = await signPersonalMessage({
          message: new TextEncoder().encode(challenge),
        });

        // 3. POST to BFF — sets httpOnly cookies
        const result = await apiClient.post<{
          success: boolean;
          user: { address: string; workspaceId?: string; workspaceName?: string };
        }>('/auth/login', {
          address,
          signature,
          message: challenge,
        });

        // 4. Update zustand stores
        login(result.user.address);

        // 5. Store workspace info from login response
        if (result.user.workspaceId && result.user.workspaceName) {
          setActiveWorkspace({
            id: result.user.workspaceId,
            name: result.user.workspaceName,
          });
        }

        return result;
      } finally {
        isPending.current = false;
      }
    },
    [signPersonalMessage, login, setActiveWorkspace],
  );

  return { authenticate };
}
