"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useProfileAssets } from "@/lib/hooks/use-profile-assets";

interface AssetGalleryProps {
  profileId: string;
}

export function AssetGallery({ profileId }: AssetGalleryProps) {
  const { data: assets, isLoading } = useProfileAssets(profileId);

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
      assets.defi.length > 0 ||
      assets.governance.length > 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Assets</CardTitle>
      </CardHeader>
      <CardContent>
        {!hasData ? (
          <p className="text-center text-muted-foreground">No assets found</p>
        ) : (
          <div className="space-y-6">
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
      </CardContent>
    </Card>
  );
}
