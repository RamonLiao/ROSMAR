"use client";

import {
  createNetworkConfig,
  SuiClientProvider,
  useSuiClientContext,
  WalletProvider,
} from "@mysten/dapp-kit";
import { isEnokiNetwork, registerEnokiWallets } from "@mysten/enoki";
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
    const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

    if (!enokiApiKey || !googleClientId) {
      console.warn(
        "Missing NEXT_PUBLIC_ENOKI_API_KEY or NEXT_PUBLIC_GOOGLE_CLIENT_ID — Enoki wallets not registered",
      );
      return;
    }

    const { unregister } = registerEnokiWallets({
      apiKey: enokiApiKey,
      providers: {
        google: { clientId: googleClientId },
      },
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
