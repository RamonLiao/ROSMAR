"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CampaignStats } from "@/components/campaign/campaign-stats";
import { ArrowLeft, Settings } from "lucide-react";
import { useRouter } from "next/navigation";

export default function CampaignDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const router = useRouter();

  const campaign = {
    id: params.id,
    name: "Welcome Series",
    status: "active",
    segment: "New Users",
    sent: 1250,
    opened: 875,
    converted: 234,
    description: "Automated welcome series for new users joining the platform",
    created_at: "2026-02-10T10:00:00Z",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold">{campaign.name}</h1>
          <p className="text-muted-foreground">
            Created {new Date(campaign.created_at).toLocaleDateString()}
          </p>
        </div>
        <Badge
          className={
            campaign.status === "active" ? "bg-green-500" : "bg-gray-500"
          }
        >
          {campaign.status}
        </Badge>
        <Button
          variant="outline"
          onClick={() => router.push(`/campaigns/${params.id}/workflow`)}
        >
          <Settings className="mr-2 h-4 w-4" />
          Edit Workflow
        </Button>
      </div>

      <CampaignStats
        sent={campaign.sent}
        opened={campaign.opened}
        converted={campaign.converted}
      />

      <Card>
        <CardHeader>
          <CardTitle>Description</CardTitle>
        </CardHeader>
        <CardContent>
          <p>{campaign.description}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Target Segment</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="font-medium">{campaign.segment}</p>
        </CardContent>
      </Card>
    </div>
  );
}
