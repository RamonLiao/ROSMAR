"use client";

import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/shared/data-table";
import { Badge } from "@/components/ui/badge";
import { Plus, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCampaigns, type Campaign } from "@/lib/hooks/use-campaigns";

const statusColors: Record<string, string> = {
  active: "bg-green-500",
  draft: "bg-gray-500",
  completed: "bg-blue-500",
  paused: "bg-yellow-500",
};

export default function CampaignsPage() {
  const router = useRouter();
  const { data, isLoading, error } = useCampaigns();

  const campaigns = data?.campaigns ?? [];

  const columns = [
    {
      key: "name",
      label: "Campaign",
      render: (item: Campaign) => (
        <span className="font-medium">{item.name}</span>
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (item: Campaign) => (
        <Badge className={statusColors[item.status] || "bg-gray-500"}>
          {item.status}
        </Badge>
      ),
    },
    {
      key: "segment",
      label: "Segment",
      render: (item: Campaign) => item.segment?.name ?? "—",
    },
    {
      key: "createdAt",
      label: "Created",
      render: (item: Campaign) =>
        new Date(item.createdAt).toLocaleDateString(),
    },
    {
      key: "actions",
      label: "Actions",
      render: (item: Campaign) => (
        <Button
          variant="outline"
          size="sm"
          onClick={() => router.push(`/campaigns/${item.id}`)}
        >
          View
        </Button>
      ),
    },
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive">
        Failed to load campaigns: {error.message}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Campaigns</h1>
          <p className="text-muted-foreground">
            Create and manage marketing campaigns
          </p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          New Campaign
        </Button>
      </div>

      <DataTable
        data={campaigns}
        columns={columns}
        searchable
        searchPlaceholder="Search campaigns..."
      />
    </div>
  );
}
