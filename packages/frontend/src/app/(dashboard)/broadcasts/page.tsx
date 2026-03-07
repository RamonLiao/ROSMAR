"use client";

import { motion } from "framer-motion";
import { staggerContainer, staggerItem } from "@/lib/motion";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/shared/data-table";
import { Badge } from "@/components/ui/badge";
import { Loader2, AlertCircle, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useBroadcasts, useCreateBroadcast, type Broadcast } from "@/lib/hooks/use-broadcasts";

const statusColors: Record<string, string> = {
  draft: "bg-slate-100 text-slate-600 border border-slate-200 dark:bg-muted dark:text-muted-foreground dark:border-border",
  scheduled: "bg-blue-100 text-blue-700 border border-blue-200 dark:bg-blue-500/15 dark:text-blue-400 dark:border-blue-400/30",
  sending: "bg-amber-100 text-amber-700 border border-amber-200 dark:bg-amber-500/15 dark:text-amber-400 dark:border-amber-400/30",
  sent: "bg-emerald-100 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-400 dark:border-emerald-400/30",
  failed: "bg-red-100 text-red-700 border border-red-200 dark:bg-red-500/15 dark:text-red-400 dark:border-red-400/30",
};

export default function BroadcastsPage() {
  const router = useRouter();
  const { data: broadcasts, isLoading, error } = useBroadcasts();
  const createMutation = useCreateBroadcast();

  async function handleNew() {
    const result = await createMutation.mutateAsync({
      title: "New Broadcast",
      content: "",
      channels: [],
    });
    router.push(`/broadcasts/${result.id}`);
  }

  const columns = [
    {
      key: "title",
      label: "Title",
      render: (item: Broadcast) => (
        <span className="font-medium">{item.title}</span>
      ),
    },
    {
      key: "channels",
      label: "Channels",
      render: (item: Broadcast) => (
        <div className="flex gap-1">
          {(item.channels ?? []).map((ch) => (
            <Badge key={ch} variant="outline" className="text-xs capitalize">
              {ch}
            </Badge>
          ))}
        </div>
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (item: Broadcast) => (
        <Badge variant="outline" className={statusColors[item.status] || statusColors.draft}>
          {item.status}
        </Badge>
      ),
    },
    {
      key: "sentAt",
      label: "Sent",
      render: (item: Broadcast) =>
        item.sentAt ? new Date(item.sentAt).toLocaleString() : "--",
    },
    {
      key: "deliveries",
      label: "Deliveries",
      render: (item: Broadcast) => item._count?.deliveries ?? 0,
    },
    {
      key: "actions",
      label: "Actions",
      render: (item: Broadcast) => (
        <Button
          variant="outline"
          size="sm"
          onClick={() => router.push(`/broadcasts/${item.id}`)}
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
          <h1 className="text-3xl font-semibold tracking-tight">Broadcasts</h1>
          <p className="text-muted-foreground tracking-tight">
            Create and send messages across channels
          </p>
        </div>
        <Button onClick={handleNew} disabled={createMutation.isPending}>
          {createMutation.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Plus className="mr-2 h-4 w-4" />
          )}
          New Broadcast
        </Button>
      </motion.div>

      {error && (
        <div className="flex items-center gap-2 rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          Failed to load broadcasts
        </div>
      )}

      <motion.div variants={staggerItem}>
        <DataTable
          data={broadcasts ?? []}
          columns={columns}
          searchable
          searchPlaceholder="Search broadcasts..."
        />
      </motion.div>
    </motion.div>
  );
}
