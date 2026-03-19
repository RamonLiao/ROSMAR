"use client";

import {
  createNetworkConfig,
  SuiClientProvider,
  useSuiClientContext,
  WalletProvider,
} from "@mysten/dapp-kit";
import { isEnokiNetwork, registerEnokiWallets, type AuthProvider } from "@mysten/enoki";
import { getJsonRpcFullnodeUrl } from "@mysten/sui/jsonRpc";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactNode, useEffect, useState } from "react";

const { networkConfig } = createNetworkConfig({
  testnet: { url: getJsonRpcFullnodeUrl("testnet"), network: "testnet" },
  mainnet: { url: getJsonRpcFullnodeUrl("mainnet"), network: "mainnet" },
});

function RegisterEnokiWallets() {
  const { client, network } = useSuiClientContext();

  useEffect(() => {
    if (!isEnokiNetwork(network)) return;

    const enokiApiKey = process.env.NEXT_PUBLIC_ENOKI_API_KEY;
    if (!enokiApiKey) {
      console.warn("Missing NEXT_PUBLIC_ENOKI_API_KEY — Enoki wallets not registered");
      return;
    }

    const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    const appleClientId = process.env.NEXT_PUBLIC_APPLE_CLIENT_ID;

    // Fix redirectUrl to /login so OAuth redirect_uri is stable
    const redirectUrl = `${window.location.origin}/login`;

    // Build providers object dynamically
    // Note: "apple" is not yet in AuthProvider union — cast until SDK adds it
    const providers: Partial<Record<AuthProvider, { clientId: string; redirectUrl: string }>> = {};
    if (googleClientId) {
      providers.google = { clientId: googleClientId, redirectUrl };
    }
    if (appleClientId) {
      (providers as Record<string, { clientId: string; redirectUrl: string }>).apple = {
        clientId: appleClientId,
        redirectUrl,
      };
    }

    if (Object.keys(providers).length === 0) {
      console.warn("No OAuth client IDs configured — Enoki wallets not registered");
      return;
    }

    const { unregister } = registerEnokiWallets({
      apiKey: enokiApiKey,
      providers,
      client,
      network,
    });

    return unregister;
  }, [client, network]);

  return null;
}

export default function SuiProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <SuiClientProvider
        networks={networkConfig}
        defaultNetwork={
          (process.env.NEXT_PUBLIC_SUI_NETWORK as "testnet" | "mainnet") ??
          "testnet"
        }
      >
        <RegisterEnokiWallets />
        <WalletProvider autoConnect>{children}</WalletProvider>
      </SuiClientProvider>
    </QueryClientProvider>
  );
}
