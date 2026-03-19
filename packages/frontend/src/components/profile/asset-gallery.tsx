"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  useProfileAssets,
  useNftTraits,
  useDefiPositions,
  NftWithTraits,
  StakePosition,
  LpPosition,
} from "@/lib/hooks/use-profile-assets";

interface AssetGalleryProps {
  profileId: string;
}

function getRarityLabel(score: number | null): {
  label: string;
  className: string;
} {
  if (score === null) return { label: "N/A", className: "bg-muted text-muted-foreground" };
  if (score >= 80) return { label: "Legendary", className: "bg-amber-500/20 text-amber-600 border-amber-500/30" };
  if (score >= 60) return { label: "Rare", className: "bg-purple-500/20 text-purple-600 border-purple-500/30" };
  if (score >= 30) return { label: "Uncommon", className: "bg-blue-500/20 text-blue-600 border-blue-500/30" };
  return { label: "Common", className: "bg-zinc-500/20 text-zinc-600 border-zinc-500/30" };
}

function NftTraitCard({ nft }: { nft: NftWithTraits }) {
  const [expanded, setExpanded] = useState(false);
  const rarity = getRarityLabel(nft.rarityScore);

  return (
    <div className="rounded-lg border overflow-hidden group">
      <div className="aspect-square bg-muted relative">
        {nft.imageUrl ? (
          <img
            src={nft.imageUrl}
            alt={nft.name}
            loading="lazy"
            className="h-full w-full object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
              (e.target as HTMLImageElement).nextElementSibling?.classList.remove("hidden");
            }}
          />
        ) : null}
        <div
          className={`absolute inset-0 flex items-center justify-center text-muted-foreground text-xs ${nft.imageUrl ? "hidden" : ""}`}
        >
          No image
        </div>
        {nft.rarityScore !== null && (
          <div className="absolute top-1.5 right-1.5">
            <Badge variant="outline" className={`text-[10px] font-semibold ${rarity.className}`}>
              {rarity.label} ({nft.rarityScore})
            </Badge>
          </div>
        )}
      </div>
      <div className="p-2 space-y-1">
        <p className="font-medium text-sm truncate">{nft.name}</p>
        <p className="text-[10px] text-muted-foreground truncate">{nft.collection}</p>
        {nft.traits.length > 0 && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-xs text-primary hover:underline"
          >
            {expanded ? "Hide" : "Show"} {nft.traits.length} traits
          </button>
        )}
        {expanded && (
          <div className="space-y-0.5 pt-1">
            {nft.traits.map((t) => (
              <div key={t.name} className="flex justify-between text-[11px]">
                <span className="text-muted-foreground">{t.name}</span>
                <span className="font-medium truncate ml-2 max-w-[60%] text-right">{t.value}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function AssetGallery({ profileId }: AssetGalleryProps) {
  const { data: assets, isLoading } = useProfileAssets(profileId);
  const { data: nftTraits, isLoading: traitsLoading } = useNftTraits(profileId);
  const { data: defiPositions, isLoading: defiLoading } = useDefiPositions(profileId);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Assets</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-24 w-full rounded-lg" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const hasData =
    assets &&
    (assets.nfts.length > 0 ||
      assets.nftGallery?.length > 0 ||
      assets.defi.length > 0 ||
      assets.governance.length > 0);

  const sortedTraits = nftTraits
    ? [...nftTraits].sort((a, b) => (b.rarityScore ?? 0) - (a.rarityScore ?? 0))
    : [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Assets</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="overview">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="defi">
              DeFi Positions
              {defiPositions && (defiPositions.stakes.length + defiPositions.lpPositions.length) > 0 && (
                <Badge variant="secondary" className="ml-1.5 text-[10px] px-1.5">
                  {defiPositions.stakes.length + defiPositions.lpPositions.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="traits">
              Traits & Rarity
              {sortedTraits.length > 0 && (
                <Badge variant="secondary" className="ml-1.5 text-[10px] px-1.5">
                  {sortedTraits.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-4">
            {!hasData ? (
              <p className="text-center text-muted-foreground">No assets found</p>
            ) : (
              <div className="space-y-6">
                {assets.nftGallery?.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-2">
                      NFT Gallery
                    </h4>
                    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
                      {assets.nftGallery.map((nft) => (
                        <div
                          key={nft.objectId}
                          className="rounded-lg border overflow-hidden group"
                        >
                          <div className="aspect-square bg-muted relative">
                            {nft.imageUrl ? (
                              <img
                                src={nft.imageUrl}
                                alt={nft.name ?? "NFT"}
                                loading="lazy"
                                className="h-full w-full object-cover"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).style.display = "none";
                                  (e.target as HTMLImageElement).nextElementSibling?.classList.remove("hidden");
                                }}
                              />
                            ) : null}
                            <div
                              className={`absolute inset-0 flex items-center justify-center text-muted-foreground text-xs ${nft.imageUrl ? "hidden" : ""}`}
                            >
                              No image
                            </div>
                          </div>
                          <div className="p-2 space-y-0.5">
                            <p className="font-medium text-sm truncate">
                              {nft.name ?? "Unnamed"}
                            </p>
                            {nft.description && (
                              <p className="text-xs text-muted-foreground line-clamp-2">
                                {nft.description}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {assets.nfts.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-2">
                      NFT Collections
                    </h4>
                    <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                      {assets.nfts.map((nft, i) => (
                        <div
                          key={i}
                          className="rounded-lg border p-3 space-y-1"
                        >
                          <p className="font-medium text-sm truncate">
                            {nft.collection}
                          </p>
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary" className="text-xs">
                              {nft.count} items
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {assets.defi.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-2">
                      DeFi Activity
                    </h4>
                    <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                      {assets.defi.map((pos, i) => (
                        <div
                          key={i}
                          className="rounded-lg border p-3 space-y-1"
                        >
                          <p className="font-medium text-sm">{pos.type}</p>
                          <p className="text-xs text-muted-foreground">
                            {pos.count} txns &middot; $
                            {pos.totalAmount.toLocaleString()}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {assets.governance.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-2">
                      Governance
                    </h4>
                    <div className="flex gap-3">
                      {assets.governance.map((g, i) => (
                        <Badge key={i} variant="outline">
                          {g.type}: {g.count}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </TabsContent>

          <TabsContent value="defi" className="mt-4">
            {defiLoading ? (
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-24 w-full rounded-lg" />
                ))}
              </div>
            ) : !defiPositions ||
              (defiPositions.stakes.length === 0 && defiPositions.lpPositions.length === 0) ? (
              <p className="text-center text-muted-foreground">
                No DeFi positions found
              </p>
            ) : (
              <div className="space-y-6">
                {/* Total Staked Summary */}
                {defiPositions.totalStakedSui !== "0" && (
                  <div className="rounded-lg border p-4 bg-muted/50">
                    <p className="text-sm text-muted-foreground">Total Staked SUI</p>
                    <p className="text-2xl font-bold">
                      {(Number(defiPositions.totalStakedSui) / 1e9).toLocaleString(undefined, {
                        maximumFractionDigits: 4,
                      })}{" "}
                      SUI
                    </p>
                  </div>
                )}

                {/* Staking Positions */}
                {defiPositions.stakes.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-2">
                      Staking Positions
                    </h4>
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      {defiPositions.stakes.map((s, i) => (
                        <div key={i} className="rounded-lg border p-3 space-y-1.5">
                          <div className="flex items-center justify-between">
                            <p className="text-xs text-muted-foreground font-mono truncate max-w-[60%]">
                              {s.validatorAddress.slice(0, 8)}...{s.validatorAddress.slice(-6)}
                            </p>
                            <Badge
                              variant="outline"
                              className={
                                s.status === "active"
                                  ? "bg-green-500/20 text-green-600 border-green-500/30"
                                  : "bg-yellow-500/20 text-yellow-600 border-yellow-500/30"
                              }
                            >
                              {s.status}
                            </Badge>
                          </div>
                          <p className="font-medium text-sm">
                            {(Number(s.stakeAmount) / 1e9).toLocaleString(undefined, {
                              maximumFractionDigits: 4,
                            })}{" "}
                            SUI
                          </p>
                          {Number(s.estimatedReward) > 0 && (
                            <p className="text-xs text-green-600">
                              +{(Number(s.estimatedReward) / 1e9).toLocaleString(undefined, {
                                maximumFractionDigits: 4,
                              })}{" "}
                              SUI reward
                            </p>
                          )}
                          <p className="text-[10px] text-muted-foreground">
                            Active since epoch {s.stakeActivationEpoch}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* LP Positions */}
                {defiPositions.lpPositions.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-2">
                      LP Positions
                    </h4>
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      {defiPositions.lpPositions.map((lp, i) => (
                        <div key={i} className="rounded-lg border p-3 space-y-1.5">
                          <div className="flex items-center justify-between">
                            <Badge variant="secondary" className="text-xs">
                              {lp.protocol}
                            </Badge>
                            {lp.tokenA && lp.tokenB && (
                              <span className="text-sm font-medium">
                                {lp.tokenA}/{lp.tokenB}
                              </span>
                            )}
                          </div>
                          <p className="text-sm">
                            Liquidity: <span className="font-medium">{lp.liquidity}</span>
                          </p>
                          <p className="text-[10px] text-muted-foreground font-mono truncate">
                            Pool: {lp.poolId.slice(0, 8)}...{lp.poolId.slice(-6)}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </TabsContent>

          <TabsContent value="traits" className="mt-4">
            {traitsLoading ? (
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-48 w-full rounded-lg" />
                ))}
              </div>
            ) : sortedTraits.length === 0 ? (
              <p className="text-center text-muted-foreground">
                No NFTs with trait data found
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
                {sortedTraits.map((nft) => (
                  <NftTraitCard key={nft.objectId} nft={nft} />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
