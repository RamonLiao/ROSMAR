"use client";

import { motion } from "framer-motion";
import { staggerContainer, staggerItem } from "@/lib/motion";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/shared/data-table";
import { Badge } from "@/components/ui/badge";
import { Loader2, AlertCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCampaigns, type Campaign } from "@/lib/hooks/use-campaigns";
import { CreateCampaignDialog } from "@/components/campaign/create-campaign-dialog";

const statusColors: Record<string, string> = {
  active: "bg-emerald-100 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-400 dark:border-emerald-400/30",
  draft: "bg-slate-100 text-slate-600 border border-slate-200 dark:bg-muted dark:text-muted-foreground dark:border-border",
  completed: "bg-teal-100 text-teal-700 border border-teal-200 dark:bg-primary/15 dark:text-primary dark:border-primary/30",
  paused: "bg-amber-100 text-amber-700 border border-amber-200 dark:bg-amber-500/15 dark:text-amber-400 dark:border-amber-400/30",
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
        <Badge variant="outline" className={statusColors[item.status] || statusColors.draft}>
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

  return (
    <motion.div className="space-y-6" variants={staggerContainer} initial="hidden" animate="visible">
      <motion.div variants={staggerItem} className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Campaigns</h1>
          <p className="text-muted-foreground tracking-tight">
            Create and manage marketing campaigns
          </p>
        </div>
        <CreateCampaignDialog />
      </motion.div>

      {error && (
        <div className="flex items-center gap-2 rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          Failed to load campaigns
        </div>
      )}

      <motion.div variants={staggerItem}>
      <DataTable
        data={campaigns}
        columns={columns}
        searchable
        searchPlaceholder="Search campaigns..."
      />
      </motion.div>
    </motion.div>
  );
}
