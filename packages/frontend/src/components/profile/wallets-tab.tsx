"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, Trash2, Wallet, Search, Link2 } from "lucide-react";
import {
  useProfileWallets,
  useAddWallet,
  useRemoveWallet,
  useFundingPatterns,
  type ProfileWallet,
  type FundingCluster,
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

function truncateAddress(addr: string) {
  if (addr.length <= 14) return addr;
  return `${addr.slice(0, 8)}...${addr.slice(-6)}`;
}

function confidenceLabel(c: number): { text: string; className: string } {
  if (c >= 0.7) return { text: "High", className: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200" };
  if (c >= 0.5) return { text: "Medium", className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200" };
  return { text: "Low", className: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200" };
}

export function WalletsTab({ profileId }: { profileId: string }) {
  const { data: wallets, isLoading } = useProfileWallets(profileId);
  const addWallet = useAddWallet();
  const removeWallet = useRemoveWallet();
  const { data: clusters, isFetching: isFetchingPatterns, refetch: fetchPatterns } = useFundingPatterns(profileId);

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
    <div className="space-y-4">
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

    {/* Funding Pattern Analysis */}
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Link2 className="h-5 w-5" />
          Funding Pattern Analysis
        </CardTitle>
        <Button
          variant="outline"
          size="sm"
          onClick={() => fetchPatterns()}
          disabled={isFetchingPatterns}
        >
          {isFetchingPatterns ? (
            <Loader2 className="mr-1 h-4 w-4 animate-spin" />
          ) : (
            <Search className="mr-1 h-4 w-4" />
          )}
          Analyze Funding Patterns
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {isFetchingPatterns ? (
          <div className="flex justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : clusters === undefined ? (
          <p className="text-sm text-muted-foreground">
            Click &quot;Analyze Funding Patterns&quot; to detect wallets funded by the same source address.
          </p>
        ) : clusters.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No funding patterns detected
          </p>
        ) : (
          clusters.map((cluster, idx) => {
            const conf = confidenceLabel(cluster.confidence);
            return (
              <div
                key={`${cluster.funderAddress}-${idx}`}
                className="space-y-2 rounded-lg border p-4"
              >
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-sm font-medium">
                      Funder:{" "}
                      <span className="font-mono text-xs">
                        {truncateAddress(cluster.funderAddress)}
                      </span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Funded {cluster.ownWallets.length} of your wallet{cluster.ownWallets.length !== 1 ? "s" : ""}
                    </p>
                  </div>
                  <Badge className={conf.className} variant="secondary">
                    {conf.text} confidence
                  </Badge>
                </div>

                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Own Wallets Funded
                  </p>
                  {cluster.ownWallets.map((addr) => (
                    <p key={addr} className="text-xs font-mono text-muted-foreground">
                      {truncateAddress(addr)}
                    </p>
                  ))}
                </div>

                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Related Profiles (same funder)
                  </p>
                  {cluster.relatedProfiles.map((rp) => (
                    <a
                      key={rp.id}
                      href={`/profiles/${rp.id}`}
                      className="flex items-center gap-2 text-sm hover:underline text-primary"
                    >
                      {rp.suinsName ?? truncateAddress(rp.primaryAddress)}
                    </a>
                  ))}
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
    </div>
  );
}
