"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { ProfileCard } from "@/components/profile/profile-card";
import { ProfileTimeline } from "@/components/profile/profile-timeline";
import { AssetGallery } from "@/components/profile/asset-gallery";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";

// Mock data
const mockProfile = {
  id: "1",
  primary_address: "0x1234567890abcdef1234567890abcdef12345678",
  suins_name: "alice.sui",
  tier: 3,
  engagement_score: 85,
};

const mockEvents = [
  {
    time: "2026-02-15T10:30:00Z",
    eventType: "mint",
    collection: "Sui Punks",
    token: "1234",
    txDigest: "0xabcdef1234567890abcdef1234567890abcdef1234567890",
  },
  {
    time: "2026-02-14T15:20:00Z",
    eventType: "swap",
    amount: 1000,
    txDigest: "0x1234567890abcdef1234567890abcdef1234567890abcdef",
  },
  {
    time: "2026-02-13T08:15:00Z",
    eventType: "transfer",
    collection: "Capy NFT",
    token: "5678",
    txDigest: "0x567890abcdef1234567890abcdef1234567890abcdef1234",
  },
];

const mockAssets = [
  {
    id: "1",
    name: "Sui Punk #1234",
    collection: "Sui Punks",
    type: "nft" as const,
  },
  {
    id: "2",
    name: "Capy #5678",
    collection: "Capy NFT",
    type: "nft" as const,
  },
  {
    id: "3",
    name: "SUI",
    collection: "Native",
    type: "token" as const,
  },
];

export default function ProfileDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const router = useRouter();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Profile Detail</h1>
          <p className="text-muted-foreground">
            360° view of {mockProfile.suins_name}
          </p>
        </div>
      </div>

      <ProfileCard
        address={mockProfile.primary_address}
        suinsName={mockProfile.suins_name}
        tier={mockProfile.tier}
        score={mockProfile.engagement_score}
      />

      <Tabs defaultValue="activity" className="space-y-4">
        <TabsList>
          <TabsTrigger value="activity">Activity</TabsTrigger>
          <TabsTrigger value="assets">Assets</TabsTrigger>
          <TabsTrigger value="notes">Notes</TabsTrigger>
          <TabsTrigger value="orgs">Related Orgs</TabsTrigger>
        </TabsList>

        <TabsContent value="activity">
          <ProfileTimeline profileId={params.id} />
        </TabsContent>

        <TabsContent value="assets">
          <AssetGallery profileId={params.id} />
        </TabsContent>

        <TabsContent value="notes">
          <Card>
            <CardHeader>
              <CardTitle>Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">No notes yet</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="orgs">
          <Card>
            <CardHeader>
              <CardTitle>Related Organizations</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">No related organizations</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
