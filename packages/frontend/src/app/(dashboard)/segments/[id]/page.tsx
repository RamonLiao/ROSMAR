"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/shared/data-table";
import { TierBadge } from "@/components/shared/tier-badge";
import { AddressDisplay } from "@/components/shared/address-display";
import { ArrowLeft, Users } from "lucide-react";
import { useRouter } from "next/navigation";

const mockSegment = {
  id: "1",
  name: "Whale Collectors",
  member_count: 45,
  is_dynamic: true,
  created_at: "2026-02-10T10:00:00Z",
};

const mockMembers = [
  {
    id: "1",
    primary_address: "0x1234567890abcdef1234567890abcdef12345678",
    suins_name: "alice.sui",
    tier: 3,
    engagement_score: 85,
  },
  {
    id: "2",
    primary_address: "0xabcdef1234567890abcdef1234567890abcdef12",
    suins_name: "bob.sui",
    tier: 4,
    engagement_score: 92,
  },
];

export default function SegmentDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const router = useRouter();

  const columns = [
    {
      key: "suins_name",
      label: "Name",
      render: (item: typeof mockMembers[0]) => (
        <span className="font-medium">{item.suins_name || "Unknown"}</span>
      ),
    },
    {
      key: "primary_address",
      label: "Address",
      render: (item: typeof mockMembers[0]) => (
        <AddressDisplay address={item.primary_address} />
      ),
    },
    {
      key: "tier",
      label: "Tier",
      render: (item: typeof mockMembers[0]) => <TierBadge tier={item.tier} />,
    },
    {
      key: "engagement_score",
      label: "Score",
      render: (item: typeof mockMembers[0]) => (
        <span>{item.engagement_score}</span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold">{mockSegment.name}</h1>
          <p className="text-muted-foreground">
            Created {new Date(mockSegment.created_at).toLocaleDateString()}
          </p>
        </div>
        <Badge variant={mockSegment.is_dynamic ? "default" : "secondary"}>
          {mockSegment.is_dynamic ? "Dynamic" : "Static"}
        </Badge>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Members</CardTitle>
          <Users className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{mockSegment.member_count}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Members</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable data={mockMembers} columns={columns} searchable />
        </CardContent>
      </Card>
    </div>
  );
}
