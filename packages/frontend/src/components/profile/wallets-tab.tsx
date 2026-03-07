"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, Trash2, Wallet } from "lucide-react";
import {
  useProfileWallets,
  useAddWallet,
  useRemoveWallet,
  type ProfileWallet,
} from "@/lib/hooks/use-profile-wallets";

const CHAIN_OPTIONS = [
  { value: "sui", label: "SUI" },
  { value: "evm", label: "Ethereum" },
  { value: "solana", label: "Solana" },
] as const;

const CHAIN_COLORS: Record<string, string> = {
  sui: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  evm: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  solana: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
};

export function WalletsTab({ profileId }: { profileId: string }) {
  const { data: wallets, isLoading } = useProfileWallets(profileId);
  const addWallet = useAddWallet();
  const removeWallet = useRemoveWallet();

  const [showAdd, setShowAdd] = useState(false);
  const [chain, setChain] = useState("sui");
  const [address, setAddress] = useState("");

  const handleAdd = async () => {
    if (!address.trim()) return;
    await addWallet.mutateAsync({ profileId, chain, address: address.trim() });
    setAddress("");
    setShowAdd(false);
  };

  const handleRemove = (walletId: string) => {
    removeWallet.mutate({ profileId, walletId });
  };

  // Group wallets by chain
  const grouped = (wallets ?? []).reduce<Record<string, ProfileWallet[]>>(
    (acc, w) => {
      (acc[w.chain] ??= []).push(w);
      return acc;
    },
    {},
  );

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Wallet className="h-5 w-5" />
          Wallets
        </CardTitle>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowAdd(!showAdd)}
        >
          <Plus className="mr-1 h-4 w-4" />
          Add Wallet
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {showAdd && (
          <div className="flex gap-2 rounded-lg border p-3">
            <select
              value={chain}
              onChange={(e) => setChain(e.target.value)}
              className="flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              {CHAIN_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <Input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Wallet address"
              className="flex-1"
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            />
            <Button
              size="sm"
              onClick={handleAdd}
              disabled={!address.trim() || addWallet.isPending}
            >
              {addWallet.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Add"
              )}
            </Button>
          </div>
        )}

        {isLoading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : Object.keys(grouped).length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No wallets linked yet
          </p>
        ) : (
          Object.entries(grouped).map(([chainKey, chainWallets]) => (
            <div key={chainKey} className="space-y-2">
              <h4 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
                {chainKey}
              </h4>
              {chainWallets.map((w) => (
                <div
                  key={w.id}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Badge
                        className={CHAIN_COLORS[w.chain] ?? ""}
                        variant="secondary"
                      >
                        {w.chain.toUpperCase()}
                      </Badge>
                      {w.ensName && (
                        <span className="text-sm font-medium">
                          {w.ensName}
                        </span>
                      )}
                      {w.snsName && (
                        <span className="text-sm font-medium">
                          {w.snsName}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground break-all font-mono">
                      {w.address}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="ml-2 shrink-0"
                    onClick={() => handleRemove(w.id)}
                    disabled={removeWallet.isPending}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
