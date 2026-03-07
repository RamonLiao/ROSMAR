"use client";

import { useBroadcastAnalytics, type BroadcastAnalytics as AnalyticsData } from "@/lib/hooks/use-broadcasts";
import { Loader2 } from "lucide-react";

interface BroadcastAnalyticsProps {
  broadcastId: string;
  sentAt?: string | null;
}

export function BroadcastAnalytics({ broadcastId, sentAt }: BroadcastAnalyticsProps) {
  const { data, isLoading } = useBroadcastAnalytics(broadcastId);

  if (isLoading) {
    return <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />;
  }

  if (!data || data.length === 0) {
    return <p className="text-sm text-muted-foreground">No delivery data yet.</p>;
  }

  // Group by channel
  const byChannel = new Map<string, { delivered: number; failed: number }>();
  for (const row of data) {
    const entry = byChannel.get(row.channel) ?? { delivered: 0, failed: 0 };
    if (row.status === "delivered") entry.delivered = row._count.status;
    if (row.status === "failed") entry.failed = row._count.status;
    byChannel.set(row.channel, entry);
  }

  return (
    <div className="space-y-4">
      {sentAt && (
        <p className="text-sm text-muted-foreground">
          Sent: {new Date(sentAt).toLocaleString()}
        </p>
      )}
      <div className="space-y-3">
        {Array.from(byChannel.entries()).map(([channel, stats]) => {
          const total = stats.delivered + stats.failed;
          const pct = total > 0 ? Math.round((stats.delivered / total) * 100) : 0;
          return (
            <div key={channel} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium capitalize">{channel}</span>
                <span className="text-muted-foreground">
                  {stats.delivered}/{total} delivered ({pct}%)
                </span>
              </div>
              <div className="h-2 w-full rounded-full bg-muted">
                <div
                  className="h-2 rounded-full bg-emerald-500"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
