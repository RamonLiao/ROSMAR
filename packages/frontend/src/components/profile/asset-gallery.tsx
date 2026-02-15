"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface Asset {
  id: string;
  name: string;
  collection: string;
  imageUrl?: string;
  type: "nft" | "token";
}

interface AssetGalleryProps {
  assets: Asset[];
}

export function AssetGallery({ assets }: AssetGalleryProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Assets</CardTitle>
      </CardHeader>
      <CardContent>
        {assets.length === 0 ? (
          <p className="text-center text-muted-foreground">No assets found</p>
        ) : (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
            {assets.map((asset) => (
              <div
                key={asset.id}
                className="group relative overflow-hidden rounded-lg border"
              >
                <div className="aspect-square bg-muted">
                  {asset.imageUrl ? (
                    <img
                      src={asset.imageUrl}
                      alt={asset.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-muted-foreground">
                      No image
                    </div>
                  )}
                </div>
                <div className="p-2">
                  <p className="truncate font-medium text-sm">{asset.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {asset.collection}
                  </p>
                  <Badge variant="secondary" className="mt-1 text-xs">
                    {asset.type.toUpperCase()}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
