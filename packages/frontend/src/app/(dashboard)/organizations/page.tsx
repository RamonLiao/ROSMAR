"use client";

import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/shared/data-table";
import { Badge } from "@/components/ui/badge";
import { Plus, Loader2 } from "lucide-react";
import { useOrganizations, type Organization } from "@/lib/hooks/use-organizations";

export default function OrganizationsPage() {
  const { data, isLoading, error } = useOrganizations();

  const organizations = data?.organizations ?? [];

  const columns = [
    {
      key: "name",
      label: "Organization",
      render: (item: Organization) => (
        <span className="font-medium">{item.name}</span>
      ),
    },
    {
      key: "domain",
      label: "Domain",
      render: (item: Organization) => item.domain || "—",
    },
    {
      key: "tags",
      label: "Tags",
      render: (item: Organization) =>
        item.tags.length > 0
          ? item.tags.map((t) => (
              <Badge key={t} variant="secondary" className="mr-1">
                {t}
              </Badge>
            ))
          : "—",
    },
    {
      key: "members",
      label: "Members",
      render: (item: Organization) =>
        item._count?.profiles?.toLocaleString() ?? "0",
    },
    {
      key: "actions",
      label: "Actions",
      render: () => (
        <Button variant="outline" size="sm">
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
        Failed to load organizations: {error.message}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Organizations</h1>
          <p className="text-muted-foreground">
            Manage company and organization profiles
          </p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          New Organization
        </Button>
      </div>

      <DataTable
        data={organizations}
        columns={columns}
        searchable
        searchPlaceholder="Search organizations..."
      />
    </div>
  );
}
