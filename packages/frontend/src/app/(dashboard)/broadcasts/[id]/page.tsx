"use client";

import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import { type Broadcast } from "@/lib/hooks/use-broadcasts";
import { BroadcastEditor } from "@/components/broadcast/broadcast-editor";
import { BroadcastAnalytics } from "@/components/broadcast/broadcast-analytics";
import { Loader2, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function BroadcastDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const { data: broadcast, isLoading } = useQuery({
    queryKey: ["broadcast", id],
    queryFn: () => apiClient.get<Broadcast>(`/broadcasts/${id}`),
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.push("/broadcasts")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {broadcast?.title ?? "Broadcast"}
          </h1>
          <p className="text-sm text-muted-foreground capitalize">
            Status: {broadcast?.status ?? "unknown"}
          </p>
        </div>
      </div>

      {broadcast && (
        <BroadcastEditor
          broadcast={broadcast}
          onSaved={() => router.push("/broadcasts")}
        />
      )}

      {broadcast && broadcast.status === "sent" && (
        <div className="rounded-lg border p-4 space-y-2">
          <h2 className="text-lg font-medium">Delivery Analytics</h2>
          <BroadcastAnalytics broadcastId={id} sentAt={broadcast.sentAt} />
        </div>
      )}
    </div>
  );
}
