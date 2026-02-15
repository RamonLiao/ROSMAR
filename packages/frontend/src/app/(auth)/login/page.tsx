"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useAuthStore } from "@/stores/auth-store";
import {
  ConnectButton,
  useConnectWallet,
  useCurrentAccount,
  useWallets,
} from "@mysten/dapp-kit";
import { isEnokiWallet, type EnokiWallet, type AuthProvider } from "@mysten/enoki";
import { useRouter } from "next/navigation";
import { useEffect, useMemo } from "react";
import { ThemeLogo } from "@/components/ui/theme-logo";

export default function LoginPage() {
  const router = useRouter();
  const currentAccount = useCurrentAccount();
  const { login, isAuthenticated } = useAuthStore();
  const { mutateAsync: connectWallet } = useConnectWallet();

  // Collect Enoki wallets by provider
  const wallets = useWallets();
  const enokiByProvider = useMemo(() => {
    const map = new Map<AuthProvider, EnokiWallet>();
    for (const w of wallets) {
      if (isEnokiWallet(w)) map.set(w.provider, w);
    }
    return map;
  }, [wallets]);

  const googleWallet = enokiByProvider.get("google");

  useEffect(() => {
    if (isAuthenticated) {
      router.push("/");
    }
  }, [isAuthenticated, router]);

  useEffect(() => {
    if (currentAccount?.address) {
      login(currentAccount.address);
      router.push("/");
    }
  }, [currentAccount, login, router]);

  const handleGoogleLogin = () => {
    if (!googleWallet) {
      console.warn("Google Enoki wallet not registered — check env vars");
      return;
    }
    connectWallet({ wallet: googleWallet });
  };

  const handlePasskeyLogin = () => {
    console.log("Passkey auth - not implemented yet");
  };

  return (
    <Card>
      <CardHeader className="items-center">
        <ThemeLogo width={48} height={48} className="mb-2" />
        <CardTitle>Sign in</CardTitle>
        <CardDescription>
          Choose your preferred authentication method
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button
          variant="outline"
          className="w-full"
          onClick={handleGoogleLogin}
          disabled={!googleWallet}
        >
          <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
            <path
              fill="currentColor"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="currentColor"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="currentColor"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="currentColor"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
          Continue with Google
        </Button>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <Separator />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground">
              Or
            </span>
          </div>
        </div>

        <ConnectButton className="w-full" />

        <Button
          variant="outline"
          className="w-full"
          onClick={handlePasskeyLogin}
        >
          Use Passkey
        </Button>
      </CardContent>
    </Card>
  );
}
