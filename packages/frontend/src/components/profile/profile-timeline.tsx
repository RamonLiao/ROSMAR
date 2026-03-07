"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useProfileTimeline } from "@/lib/hooks/use-profile-assets";

interface ProfileTimelineProps {
  profileId: string;
}

const eventTypeColors: Record<string, string> = {
  SwapEvent: "bg-purple-500",
  MintNFTEvent: "bg-green-500",
  TransferObject: "bg-blue-500",
  StakeEvent: "bg-yellow-500",
  UnstakeEvent: "bg-orange-500",
  VoteEvent: "bg-indigo-500",
  DelegateEvent: "bg-teal-500",
  AddLiquidityEvent: "bg-pink-500",
};

export function ProfileTimeline({ profileId }: ProfileTimelineProps) {
  const [limit, setLimit] = useState(20);
  const { data, isLoading } = useProfileTimeline(profileId, limit);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Activity Timeline</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const events = data?.events ?? [];
  const total = data?.total ?? 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Activity Timeline</CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px]">
          <div className="space-y-4">
            {events.length === 0 ? (
              <p className="text-center text-muted-foreground">
                No activity yet
              </p>
            ) : (
              events.map((event) => (
                <div key={event.id} className="flex gap-4 border-l-2 pl-4">
                  <div className="flex-shrink-0">
                    <Badge
                      className={
                        eventTypeColors[event.eventType] || "bg-gray-500"
                      }
                    >
                      {event.eventType}
                    </Badge>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <p className="font-medium">
                        {event.collection && `${event.collection}`}
                        {event.token && ` #${event.token}`}
                      </p>
                      <span className="text-sm text-muted-foreground">
                        {new Date(event.time).toLocaleDateString()}
                      </span>
                    </div>
                    {event.amount != null && (
                      <p className="text-sm text-muted-foreground">
                        Amount: {Number(event.amount).toLocaleString()}
                      </p>
                    )}
                    <p className="text-xs font-mono text-muted-foreground">
                      {event.txDigest.slice(0, 8)}...{event.txDigest.slice(-6)}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
        {events.length < total && (
          <div className="mt-4 text-center">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setLimit((prev) => prev + 20)}
            >
              Load more ({total - events.length} remaining)
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
