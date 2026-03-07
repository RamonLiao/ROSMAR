"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, DollarSign } from "lucide-react";
import { useNetWorth, type ChainBalance } from "@/lib/hooks/use-profile-wallets";

const CHAIN_LABELS: Record<string, string> = {
  sui: "SUI",
  evm: "Ethereum",
  solana: "Solana",
};

const CHAIN_BAR_COLORS: Record<string, string> = {
  sui: "bg-blue-500",
  evm: "bg-purple-500",
  solana: "bg-green-500",
};

function formatUsd(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);
}

function BreakdownBar({
  breakdown,
  totalUsd,
}: {
  breakdown: ChainBalance[];
  totalUsd: number;
}) {
  if (totalUsd === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted">
        {breakdown
          .filter((b) => b.balanceUsd > 0)
          .map((b, i) => (
            <div
              key={i}
              className={`${CHAIN_BAR_COLORS[b.chain] ?? "bg-gray-500"} transition-all`}
              style={{ width: `${(b.balanceUsd / totalUsd) * 100}%` }}
            />
          ))}
      </div>
      <div className="space-y-1">
        {breakdown.map((b, i) => (
          <div key={i} className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <div
                className={`h-2 w-2 rounded-full ${CHAIN_BAR_COLORS[b.chain] ?? "bg-gray-500"}`}
              />
              <span className="text-muted-foreground">
                {CHAIN_LABELS[b.chain] ?? b.chain}
              </span>
              <span className="text-xs text-muted-foreground font-mono truncate max-w-[120px]">
                {b.address}
              </span>
            </div>
            <span className="font-medium">{formatUsd(b.balanceUsd)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function NetWorthCard({ profileId }: { profileId: string }) {
  const { data, isLoading } = useNetWorth(profileId);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DollarSign className="h-5 w-5" />
          Net Worth
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : !data ? (
          <p className="text-sm text-muted-foreground">
            Unable to load net worth
          </p>
        ) : (
          <div className="space-y-4">
            <div className="text-3xl font-bold tracking-tight">
              {formatUsd(data.totalUsd)}
            </div>
            {data.breakdown.length > 0 ? (
              <BreakdownBar
                breakdown={data.breakdown}
                totalUsd={data.totalUsd}
              />
            ) : (
              <p className="text-sm text-muted-foreground">
                Link wallets to see balance breakdown
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
