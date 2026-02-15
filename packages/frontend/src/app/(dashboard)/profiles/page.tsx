"use client";

import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/shared/data-table";
import { TierBadge } from "@/components/shared/tier-badge";
import { EngagementBadge } from "@/components/profile/engagement-badge";
import { AddressDisplay } from "@/components/shared/address-display";
import { Plus, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useProfiles, type Profile } from "@/lib/hooks/use-profiles";

export default function ProfilesPage() {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const { data, isLoading, error } = useProfiles({
    limit: pageSize,
    offset: (page - 1) * pageSize,
  });

  const profiles = data?.profiles ?? [];
  const total = data?.total ?? 0;

  const columns = [
    {
      key: "suinsName",
      label: "Name",
      render: (item: Profile) => (
        <span className="font-medium">{item.suinsName || "Unknown"}</span>
      ),
    },
    {
      key: "primaryAddress",
      label: "Address",
      render: (item: Profile) => (
        <AddressDisplay address={item.primaryAddress} />
      ),
    },
    {
      key: "tier",
      label: "Tier",
      render: (item: Profile) => <TierBadge tier={item.tier} />,
    },
    {
      key: "engagementScore",
      label: "Engagement",
      render: (item: Profile) => (
        <EngagementBadge score={item.engagementScore} />
      ),
    },
    {
      key: "createdAt",
      label: "Created",
      render: (item: Profile) =>
        new Date(item.createdAt).toLocaleDateString(),
    },
    {
      key: "actions",
      label: "Actions",
      render: (item: Profile) => (
        <Button
          variant="outline"
          size="sm"
          onClick={() => router.push(`/profiles/${item.id}`)}
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
        Failed to load profiles: {error.message}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Profiles</h1>
          <p className="text-muted-foreground">
            Manage your customer profiles
          </p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Add Profile
        </Button>
      </div>

      <DataTable
        data={profiles}
        columns={columns}
        searchable
        searchPlaceholder="Search profiles..."
        pagination={{
          page,
          pageSize,
          total,
          onPageChange: setPage,
        }}
      />
    </div>
  );
}
