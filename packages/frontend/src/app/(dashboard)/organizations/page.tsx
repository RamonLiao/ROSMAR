"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { staggerContainer, staggerItem } from "@/lib/motion";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/shared/data-table";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useOrganizations, type Organization } from "@/lib/hooks/use-organizations";
import { CreateOrganizationDialog } from "@/components/organization/create-organization-dialog";

export default function OrganizationsPage() {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const { data, isLoading, error } = useOrganizations({
    limit: pageSize,
    offset: (page - 1) * pageSize,
    search: debouncedSearch || undefined,
  });

  const organizations = data?.organizations ?? [];
  const total = data?.total ?? 0;

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
      render: (item: Organization) => (
        <Button
          variant="outline"
          size="sm"
          onClick={() => router.push(`/organizations/${item.id}`)}
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
        Failed to load organizations: {error.message}
      </div>
    );
  }

  return (
    <motion.div className="space-y-6" variants={staggerContainer} initial="hidden" animate="visible">
      <motion.div variants={staggerItem} className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Organizations</h1>
          <p className="text-muted-foreground tracking-tight">
            Manage company and organization profiles
          </p>
        </div>
        <CreateOrganizationDialog />
      </motion.div>

      <motion.div variants={staggerItem}>
      <DataTable
        data={organizations}
        columns={columns}
        searchable
        searchPlaceholder="Search organizations..."
        onSearch={setSearch}
        pagination={{
          page,
          pageSize,
          total,
          onPageChange: setPage,
        }}
      />
      </motion.div>
    </motion.div>
  );
}
