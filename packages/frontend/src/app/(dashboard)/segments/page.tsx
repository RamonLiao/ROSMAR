"use client";

import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/shared/data-table";
import { Badge } from "@/components/ui/badge";
import { Plus, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useSegments, type Segment } from "@/lib/hooks/use-segments";

export default function SegmentsPage() {
  const router = useRouter();
  const { data, isLoading, error } = useSegments();

  const segments = data?.segments ?? [];

  const columns = [
    {
      key: "name",
      label: "Name",
      render: (item: Segment) => (
        <span className="font-medium">{item.name}</span>
      ),
    },
    {
      key: "members",
      label: "Members",
      render: (item: Segment) => (
        <span>{(item._count?.memberships ?? 0).toLocaleString()}</span>
      ),
    },
    {
      key: "description",
      label: "Description",
      render: (item: Segment) => item.description || "—",
    },
    {
      key: "createdAt",
      label: "Created",
      render: (item: Segment) =>
        new Date(item.createdAt).toLocaleDateString(),
    },
    {
      key: "actions",
      label: "Actions",
      render: (item: Segment) => (
        <Button
          variant="outline"
          size="sm"
          onClick={() => router.push(`/segments/${item.id}`)}
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
        Failed to load segments: {error.message}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Segments</h1>
          <p className="text-muted-foreground">
            Create and manage customer segments
          </p>
        </div>
        <Button onClick={() => router.push("/segments/new")}>
          <Plus className="mr-2 h-4 w-4" />
          New Segment
        </Button>
      </div>

      <DataTable
        data={segments}
        columns={columns}
        searchable
        searchPlaceholder="Search segments..."
      />
    </div>
  );
}
