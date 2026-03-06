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
import { useEffect, useMemo, useRef, useState } from "react";
import { ThemeLogo } from "@/components/ui/theme-logo";
import { useAuthSession } from "@/hooks/use-auth-session";
import { ConnectModal, useDisconnectWallet } from "@mysten/dapp-kit";
import { ChevronDown, LogOut, Loader2, Fingerprint } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { usePasskeyLoginOptions, usePasskeyLoginVerify } from "@/lib/hooks/use-passkey";
import { startAuthentication } from "@simplewebauthn/browser";

function formatAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export default function LoginPage() {
  const router = useRouter();
  const currentAccount = useCurrentAccount();
  const { isAuthenticated } = useAuthStore();
  const { mutateAsync: connectWallet } = useConnectWallet();
  const { mutate: disconnectWallet } = useDisconnectWallet();
  const { authenticate } = useAuthSession();
  const authenticatingRef = useRef(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [passkeyLoading, setPasskeyLoading] = useState(false);
  const passkeyLoginOptions = usePasskeyLoginOptions();
  const passkeyLoginVerify = usePasskeyLoginVerify();

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

  // Auto-authenticate when wallet connects (only once per account)
  useEffect(() => {
    if (currentAccount?.address && !isAuthenticated && !authenticatingRef.current && !authError) {
      authenticatingRef.current = true;
      setAuthError(null);
      authenticate(currentAccount.address)
        .then(() => router.push("/"))
        .catch((err) => {
          console.error("Auth session failed:", err);
          setAuthError(err.message ?? "Authentication failed");
          authenticatingRef.current = false;
        });
    }
  }, [currentAccount?.address, isAuthenticated]); // eslint-disable-line react-hooks/exhaustive-deps

  const handlePasskeyLogin = async () => {
    try {
      setPasskeyLoading(true);
      setAuthError(null);
      const options = await passkeyLoginOptions.mutateAsync();
      const credential = await startAuthentication({ optionsJSON: options });
      const result = await passkeyLoginVerify.mutateAsync(credential);
      if (result.success && result.user) {
        useAuthStore.getState().login(result.user.address);
        router.push("/");
      }
    } catch (err: any) {
      setAuthError(err.message ?? "Passkey authentication failed");
    } finally {
      setPasskeyLoading(false);
    }
  };

  const handleGoogleLogin = () => {
    if (!googleWallet) {
      console.warn("Google Enoki wallet not registered — check env vars");
      return;
    }
    connectWallet({ wallet: googleWallet });
  };


  return (
    <Card className="backdrop-blur-2xl bg-white/70 dark:bg-white/5 border border-white/40 dark:border-white/10 shadow-xl shadow-[inset_0_1px_0_0_rgba(255,255,255,0.1)] hover:shadow-2xl transition-all duration-500 w-full">
      <CardHeader className="flex flex-col items-center text-center space-y-1 pb-8 pt-8">
        <div className="bg-[length:200%_100%] bg-gradient-to-r from-transparent via-white/20 to-transparent animate-crystal-shimmer">
          <ThemeLogo width={64} height={64} className="mb-4" />
        </div>
        <CardTitle className="text-2xl">Sign in</CardTitle>
        <CardDescription className="text-sm tracking-tight">
          Choose your preferred authentication method
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 px-8 pb-8">
        <Button
          variant="outline"
          className="w-full bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-primary-foreground transition-all duration-[var(--duration-normal)] active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={handleGoogleLogin}
          disabled={!googleWallet}
          title={!googleWallet ? "Requires Enoki API key configuration" : undefined}
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
          {!googleWallet && <span className="ml-1 text-[10px] opacity-70">(Coming soon)</span>}
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

        {currentAccount ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="w-full justify-between bg-white/10 dark:bg-white/5 backdrop-blur border border-white/30 dark:border-white/10 hover:bg-white/20 transition-all duration-[var(--duration-normal)] active:scale-[0.97]">
                <span>{formatAddress(currentAccount.address)}</span>
                {authenticatingRef.current ? (
                  <Loader2 className="h-4 w-4 animate-spin opacity-50" />
                ) : (
                  <ChevronDown className="h-4 w-4 opacity-50" />
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[var(--radix-dropdown-menu-trigger-width)]">
              <DropdownMenuItem onClick={() => disconnectWallet()}>
                <LogOut className="mr-2 h-4 w-4" />
                Disconnect
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <ConnectModal
            trigger={
              <Button variant="outline" className="w-full bg-white/10 dark:bg-white/5 backdrop-blur border border-white/30 dark:border-white/10 hover:bg-white/20 transition-all duration-[var(--duration-normal)] active:scale-[0.97]">
                Connect Wallet
              </Button>
            }
          />
        )}

        <Button
          variant="outline"
          className="w-full bg-white/10 dark:bg-white/5 backdrop-blur border border-white/30 dark:border-white/10 hover:bg-white/20 transition-all duration-[var(--duration-normal)] active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={handlePasskeyLogin}
          disabled={passkeyLoading}
        >
          {passkeyLoading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Fingerprint className="mr-2 h-4 w-4" />
          )}
          Use Passkey
        </Button>

        {authError && (
          <p className="text-sm text-destructive text-center">{authError}</p>
        )}
      </CardContent>
    </Card>
  );
}
