"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

interface TimelineEvent {
  time: string;
  eventType: string;
  collection?: string;
  token?: string;
  amount?: number;
  txDigest: string;
}

interface ProfileTimelineProps {
  events: TimelineEvent[];
}

const eventTypeColors: Record<string, string> = {
  transfer: "bg-blue-500",
  mint: "bg-green-500",
  burn: "bg-red-500",
  swap: "bg-purple-500",
  stake: "bg-yellow-500",
};

export function ProfileTimeline({ events }: ProfileTimelineProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Activity Timeline</CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px]">
          <div className="space-y-4">
            {events.length === 0 ? (
              <p className="text-center text-muted-foreground">No activity yet</p>
            ) : (
              events.map((event, index) => (
                <div key={index} className="flex gap-4 border-l-2 pl-4">
                  <div className="flex-shrink-0">
                    <Badge
                      className={eventTypeColors[event.eventType] || "bg-gray-500"}
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
                    {event.amount && (
                      <p className="text-sm text-muted-foreground">
                        Amount: {event.amount}
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
      </CardContent>
    </Card>
  );
}
